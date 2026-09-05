-- =============================================================================
-- Migración: marcar productos de un pedido en el tablero de bodega
-- Fecha: 2026-08-30
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Objetivo: que bodega pueda ir tildando los productos de un pedido a medida que
-- los alista, para no perder la cuenta en pedidos largos. Es una AYUDA DE
-- CONTROL, no un estado: no cambia el estado del pedido, no mueve inventario y
-- no habilita ni bloquea ninguna transición del tablero. Un pedido se puede
-- marcar como Listo con cero productos tildados.
--
-- Vive en product_for_sale_store_order_element porque es una marca POR PRODUCTO;
-- la cabecera del pedido ya tiene sus propias marcas (verificación, encargado) y
-- ninguna sirve para esto.
--
-- CUÁNDO SE PUEDE MARCAR
-- Solo con el pedido En curso(12) o Preparado(64). Pendiente(11) queda afuera a
-- propósito: nadie lo está alistando todavía, y es el estado donde el pedido se
-- edita —ver "LOS CHECKS SE PIERDEN AL EDITAR"—. De Listo(13) en adelante el
-- pedido ya salió de bodega y la lista es un registro histórico.
--
-- El guard vive en el WHERE del PASO 3. El front esconde las casillas fuera de
-- esos dos estados, pero eso es comodidad: la regla real es la de la base.
--
-- LOS CHECKS SE PIERDEN AL EDITAR EL PEDIDO
-- update_product_for_sale_order_with_elements borra TODOS los elementos y los
-- vuelve a insertar (DELETE + INSERT, no un UPDATE fila por fila), y eso está
-- permitido en Pendiente(11) y En curso(12). O sea: si alguien edita un pedido
-- que bodega está alistando, las filas nuevas nacen con is_check = false y los
-- tildes se pierden.
--
-- Se deja así A PROPÓSITO y NO se toca ese procedure: si la lista de productos
-- cambió, lo que se había revisado ya no corresponde a lo que hay que alistar, y
-- volver a recorrerla es justamente lo que se quiere. Conservar los tildes por
-- product_for_sale_id daría un pedido "medio revisado" que nadie revisó.
--
-- QUIÉN PUEDE MARCAR
-- Cualquiera que vea el tablero. No se creó una capacidad "orders.check" ni se
-- valida al encargado: marcar no es destructivo, se deshace con otro click, y el
-- costo de un gate más (recordar habilitarlo en cada rol nuevo) no se justifica.
--
-- ENFOQUE 100% ADITIVO:
--   * Una columna nueva con DEFAULT. Los elementos existentes quedan sin marcar.
--   * Lectura NUEVA (V3); /getProductForSaleStoreOrderElementsV2 queda viva e
--     intacta.
--   * Escritura NUEVA. No se toca ningún procedure ni ninguna query existente.
-- =============================================================================


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- 0.a La lectura de la que sale el clon del PASO 2 tiene que existir. Si esta
--     consulta no devuelve la fila, correr antes
--     2026-08-18-query-productos-pedido-tablero.sql.
SELECT "path" FROM public.sql_queries
 WHERE "path" = '/getProductForSaleStoreOrderElementsV2';

-- 0.b Los ids de estado del tablero. Deben ser En curso = 12 y Preparado = 64;
--     si en esta base tienen otros números, corregirlos en el PASO 3.
SELECT s.id, s."name" FROM status s WHERE s.id IN (11, 12, 13, 64) ORDER BY s.id;

-- 0.c Cuántos elementos va a tocar el ALTER. Solo para dimensionar: con DEFAULT
--     y Postgres 11+ la tabla no se reescribe, así que el ALTER es instantáneo
--     sin importar este número.
SELECT COUNT(*) AS elementos FROM product_for_sale_store_order_element;


-- #############################################################################
-- PASO 1 — Columna is_check
--
-- NOT NULL con DEFAULT false, al revés que verified_by_user_id, que es NULLABLE.
-- Ahí el NULL significa algo ("nadie verificó"); acá no hay estado intermedio
-- entre marcado y sin marcar, y el default ahorra tener que distinguir NULL de
-- false en cada lectura del front.
--
-- Desde Postgres 11 un ADD COLUMN con DEFAULT no reescribe la tabla: el valor se
-- resuelve al leer las filas viejas. No hace falta ventana de mantenimiento.
-- #############################################################################

ALTER TABLE public.product_for_sale_store_order_element
    ADD COLUMN IF NOT EXISTS is_check boolean NOT NULL DEFAULT false;


-- #############################################################################
-- PASO 2 — /getProductForSaleStoreOrderElementsV3
--
-- Clon de la V2 con dos campos más:
--
--   'id'      -> la PK del elemento (int4, no uuid). Es lo que hacía falta y no
--                estaba: sin id no hay a qué dirigirle la marca. La V2 la omitía
--                porque el panel solo pintaba texto.
--   'isCheck' -> la columna del PASO 1.
--
-- Se agrega además ORDER BY pfssoe.id, que la V2 no tenía. Con una lista de solo
-- lectura el orden daba igual; con casillas no: una lista que se reordena entre
-- recargas hace dudar de lo que uno ya marcó. El id es el orden de inserción, o
-- sea el orden en que se cargó el pedido.
--
-- Sigue sin traer finished_product.photo, que es el motivo por el que existe
-- esta familia de queries.
--
-- El DELETE previo la hace idempotente: sql_queries no tiene unique en "path".
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderElementsV3';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('getProductForSaleStoreOrderElementsV3','/getProductForSaleStoreOrderElementsV3','SELECT json_build_object(
    ''id'', pfsso.id,
    ''comment'', pfsso.comment,
    ''productForSaleStoreOrderElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', pfssoe.id,
                ''isCheck'', pfssoe.is_check,
                ''quantity'', pfssoe.quantity,
                ''measure'', json_build_object(
                    ''identifier'', m.name
                ),
                ''productForSale'', json_build_object(
                    ''finishedProduct'', json_build_object(
                        ''name'', fp.name
                    )
                )
            ) ORDER BY pfssoe.id
        )
        FROM product_for_sale_store_order_element pfssoe
        LEFT JOIN product_for_sale pfs ON pfs.id = pfssoe.product_for_sale_id
        LEFT JOIN finished_product fp ON fp.id = pfs.finished_product_id
        LEFT JOIN measure m ON m.id = pfssoe.measure_id
        WHERE pfssoe.pfsso_id = pfsso.id
    )
) as json_result
from product_for_sale_store_order pfsso','product_for_sale_store_order','POST');


-- #############################################################################
-- PASO 3 — /updateProductForSaleStoreOrderElementsCheck
--
-- UPDATE plano, sin procedure: no mueve inventario, no encadena estados y no
-- necesita transacción propia más allá de la sentencia. Un procedure acá sería
-- ceremonia sin nada que proteger.
--
-- Recibe la tanda entera en un solo PATCH ($2 es un array JSON). El front hace
-- los clicks en local y guarda cuando el usuario aprieta el botón, así que un
-- pedido de 20 productos son 20 clicks y UNA llamada.
--
-- Tres guards, y los tres importan:
--   * e.id = c.id            -> solo las filas que vinieron en la tanda.
--   * e.pfsso_id = $1::uuid  -> y solo si pertenecen a ESTE pedido. Sin esto, un
--     id de elemento armado a mano marcaría productos de cualquier otro pedido:
--     la PK es un serial global, no es adivinable pero sí enumerable.
--   * exists(...)            -> solo con el pedido En curso(12) o Preparado(64).
--
-- Si el pedido ya no está en esos estados el UPDATE afecta 0 filas y NO falla.
-- Es el mismo criterio que el resto de los UPDATE con guard del tablero: la
-- acción simplemente no se aplica. El front no deja llegar hasta acá salvo que
-- alguien mueva el pedido en el instante justo, y perder unos tildes en esa
-- carrera no rompe nada.
--
-- jsonb_to_recordset necesita la definición de columnas explícita; los nombres
-- (id, is_check) son los que arma el front en el payload.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/updateProductForSaleStoreOrderElementsCheck';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('updateProductForSaleStoreOrderElementsCheck','/updateProductForSaleStoreOrderElementsCheck','update product_for_sale_store_order_element e
set is_check = c.is_check
from jsonb_to_recordset($2::jsonb) as c(id int, is_check boolean)
where e.id = c.id
  and e.pfsso_id = $1::uuid
  and exists (select 1 from product_for_sale_store_order o
               where o.id = $1::uuid
                 and o.factory_status_id in (12, 64))','product_for_sale_store_order_element','PATCH');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- Columna nueva
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'product_for_sale_store_order_element'
--    AND column_name = 'is_check';
--
-- -- Endpoints nuevos (deben salir 2 filas, veces = 1)
-- SELECT "path", COUNT(*) AS veces FROM sql_queries
--  WHERE "path" IN ('/getProductForSaleStoreOrderElementsV3',
--                   '/updateProductForSaleStoreOrderElementsCheck')
--  GROUP BY "path" ORDER BY "path";
--
-- -- La V2 sigue viva y SIN los campos nuevos; la V3 los trae
-- SELECT "path",
--        consulta_sql LIKE '%is_check%' AS trae_check,
--        consulta_sql LIKE '%photo%'    AS trae_foto
--   FROM sql_queries
--  WHERE "path" IN ('/getProductForSaleStoreOrderElementsV2',
--                   '/getProductForSaleStoreOrderElementsV3');
--
-- -- Prueba de lectura con un pedido real (el front manda {"pfsso": {"id": "..."}}):
-- -- cada elemento debe traer id e isCheck.
--
-- -- Prueba de escritura. Tomar un pedido En curso(12) o Preparado(64):
-- --   SELECT o.id, o.factory_status_id, e.id AS elemento, e.is_check
-- --     FROM product_for_sale_store_order o
-- --     JOIN product_for_sale_store_order_element e ON e.pfsso_id = o.id
-- --    WHERE o.factory_status_id IN (12, 64) LIMIT 5;
-- -- y llamar al endpoint con {"$1": "<order_id>", "$2": "[{\"id\":<elemento>,\"is_check\":true}]"}
--
-- -- El guard de estado: sobre un pedido Listo(13) la misma llamada no debe
-- -- cambiar nada (0 filas afectadas, sin error).
--
-- -- El guard de pertenencia: un elemento de OTRO pedido no se toca aunque venga
-- -- en el payload.
--
-- -- Avance de los pedidos en curso, para ver la función andando:
-- SELECT o.order_number, o.factory_status_id,
--        COUNT(*) FILTER (WHERE e.is_check) AS marcados,
--        COUNT(*) AS total
--   FROM product_for_sale_store_order o
--   JOIN product_for_sale_store_order_element e ON e.pfsso_id = o.id
--  WHERE o.factory_status_id IN (12, 64)
--  GROUP BY o.order_number, o.factory_status_id
--  ORDER BY o.order_number DESC;
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve a la V2 con revertir el commit; la base se deja como estaba con:
--
-- DELETE FROM public.sql_queries WHERE "path" IN
--   ('/getProductForSaleStoreOrderElementsV3',
--    '/updateProductForSaleStoreOrderElementsCheck');
--
-- La columna se puede dejar: tiene default y, sin los endpoints de arriba, nadie
-- la lee ni la escribe. Si igual se quiere quitar:
-- ALTER TABLE public.product_for_sale_store_order_element DROP COLUMN IF EXISTS is_check;
-- #############################################################################
