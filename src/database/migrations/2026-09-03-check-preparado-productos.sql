-- =============================================================================
-- Migración: segundo check, el de la vista "Pedidos preparados"
-- Fecha: 2026-09-03
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- ###########################################################################
-- ORDEN: correr DESPUÉS de
--   * 2026-08-30-check-productos-pedido.sql     (columna is_check)
--   * 2026-08-31-vista-pedidos-preparados.sql   (/listProductForSaleStoreOrderPreparedV1)
--   * 2026-08-30-retroceder-preparado-a-en-curso.sql (/unprepareProductForSaleStoreOrder)
-- Los PASOS 2 y 4 derivan sus queries de las dos últimas: sin ellas los INSERT
-- no insertan nada y el front queda pidiendo endpoints que no existen.
-- ###########################################################################
--
-- Objetivo: dos pasadas de control sobre la misma lista de productos, una por
-- pantalla, independientes entre sí:
--
--   is_check        el tablero, con el pedido En curso(12). Lo marca bodega
--                   mientras ALISTA: "esto ya lo puse en la mesa".
--   prepared_check  la vista Pedidos preparados, con el pedido en Preparado(64).
--                   Lo marca quien REVISA contra la mesa antes de cerrar.
--
-- Son dos columnas y no una porque son dos preguntas distintas hechas por dos
-- personas en dos momentos. Reusar is_check haría que la segunda pasada arranque
-- con todo tildado por la primera, que es exactamente lo que una revisión no
-- puede hacer.
--
-- CUÁNDO SE PUEDE MARCAR
-- prepared_check solo con el pedido en Preparado(64), el único estado que lista
-- esa pantalla. Ni antes (no hay nada preparado que revisar) ni después (el
-- pedido ya se cerró y la lista es registro histórico).
--
-- QUÉ PASA AL RETROCEDER (PASO 4)
-- Volver de Preparado(64) a En curso(12) BORRA prepared_check y CONSERVA
-- is_check. Es el mismo criterio con el que ese endpoint ya borra la
-- verificación: se retrocede para corregir el pedido, así que la revisión quedó
-- vieja y hay que rehacerla; lo que bodega alistó, en cambio, sigue alistado.
--
-- Liberar el pedido (En curso -> Pendiente) no necesita tocar prepared_check:
-- desde Preparado no se llega a Pendiente sin pasar por En curso, y ese paso ya
-- lo dejó en false.
--
-- ENFOQUE 100% ADITIVO:
--   * Una columna nueva con DEFAULT. Los elementos existentes quedan sin marcar.
--   * Lectura y retroceso clonados a V2; las V1 quedan vivas e intactas.
--   * Escritura nueva. is_check y sus endpoints no se tocan.
-- =============================================================================


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- 0.a Las dos queries de las que salen los clones tienen que existir, con sus
--     anclas. Deben salir las dos filas con ancla = true.
SELECT "path",
       CASE "path"
           WHEN '/listProductForSaleStoreOrderPreparedV1'
               THEN consulta_sql LIKE '%''isCheck'', pfssoe.is_check,%'
           WHEN '/unprepareProductForSaleStoreOrder'
               THEN consulta_sql LIKE '%factory_status_id = 64%'
       END AS ancla
  FROM public.sql_queries
 WHERE "path" IN ('/listProductForSaleStoreOrderPreparedV1',
                  '/unprepareProductForSaleStoreOrder');

-- 0.b La columna is_check tiene que existir: prepared_check nace a su lado, no
--     en su lugar.
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_name = 'product_for_sale_store_order_element'
   AND column_name IN ('is_check', 'prepared_check');

-- 0.c El id del estado. Debe ser Preparado = 64; si acá sale otro número,
--     corregirlo en los PASOS 3 y 4.
SELECT s.id, s."name" FROM status s WHERE s.id = 64;


-- #############################################################################
-- PASO 1 — Columna prepared_check
--
-- NOT NULL con DEFAULT false, igual que is_check y por el mismo motivo: no hay
-- estado intermedio entre marcado y sin marcar, y el default ahorra distinguir
-- NULL de false en cada lectura del front.
--
-- Desde Postgres 11 un ADD COLUMN con DEFAULT no reescribe la tabla.
-- #############################################################################

ALTER TABLE public.product_for_sale_store_order_element
    ADD COLUMN IF NOT EXISTS prepared_check boolean NOT NULL DEFAULT false;


-- #############################################################################
-- PASO 2 — /listProductForSaleStoreOrderPreparedV2
--
-- Derivada con replace() de la V1. El ancla —la línea de isCheck— aparece una
-- sola vez, y es justo donde corresponde leer la columna nueva: al lado de la
-- otra marca del mismo elemento.
--
-- La V2 sigue trayendo isCheck aunque la pantalla pase a pintar preparedCheck:
-- es un campo más en un JSON que ya viaja, y tenerlo permite mostrar las dos
-- marcas juntas sin volver a tocar la base.
-- #############################################################################

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'listProductForSaleStoreOrderPreparedV2','/listProductForSaleStoreOrderPreparedV2',
       replace(consulta_sql,
           '''isCheck'', pfssoe.is_check,',
           '''isCheck'', pfssoe.is_check,
                    ''preparedCheck'', pfssoe.prepared_check,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/listProductForSaleStoreOrderPreparedV1'
  AND consulta_sql LIKE '%''isCheck'', pfssoe.is_check,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/listProductForSaleStoreOrderPreparedV2');


-- #############################################################################
-- PASO 3 — /updateProductForSaleStoreOrderElementsPreparedCheck
--
-- Gemela de /updateProductForSaleStoreOrderElementsCheck, con dos diferencias:
-- escribe prepared_check y el guard es factory_status_id = 64 a secas, no la
-- lista (12, 64). Preparado es el único estado en el que existe la pantalla que
-- la usa.
--
-- Los otros dos guards son los mismos y por los mismos motivos:
--   * e.id = c.id            -> solo las filas de la tanda.
--   * e.pfsso_id = $1::uuid  -> y solo si son de ESTE pedido. La PK es un serial
--     global: no es adivinable, pero sí enumerable.
--
-- Si el pedido ya no está en Preparado el UPDATE afecta 0 filas y NO falla, como
-- el resto de los UPDATE con guard de este módulo.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/updateProductForSaleStoreOrderElementsPreparedCheck';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('updateProductForSaleStoreOrderElementsPreparedCheck','/updateProductForSaleStoreOrderElementsPreparedCheck','update product_for_sale_store_order_element e
set prepared_check = c.prepared_check
from jsonb_to_recordset($2::jsonb) as c(id int, prepared_check boolean)
where e.id = c.id
  and e.pfsso_id = $1::uuid
  and exists (select 1 from product_for_sale_store_order o
               where o.id = $1::uuid
                 and o.factory_status_id = 64)','product_for_sale_store_order_element','PATCH');


-- #############################################################################
-- PASO 4 — /unprepareProductForSaleStoreOrderV2
--
-- Retroceder de Preparado(64) a En curso(12) borra la revisión. La V1 ya borraba
-- prepared_date y la verificación; esto agrega los checks de preparado, que son
-- la tercera cara de lo mismo: todo lo que certifica que el pedido estaba listo
-- para salir.
--
-- is_check NO se toca: eso lo alistó bodega y sigue alistado.
--
-- El CTE es el mismo patrón de /releaseProductForSaleStoreOrderV3: el UPDATE de
-- los elementos cuelga del RETURNING del primero, así que un intento rechazado
-- por los guards —el pedido ya no está en 64, o quien llama no es el encargado—
-- no borra ninguna marca. El "and e.prepared_check" evita escribir en todas las
-- filas cuando no había nada marcado, que es el caso normal.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/unprepareProductForSaleStoreOrderV2';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('unprepareProductForSaleStoreOrderV2','/unprepareProductForSaleStoreOrderV2','with retrocedido as (
    update product_for_sale_store_order
    set factory_status_id = 12,
        prepared_date = null,
        verified_by_user_id = null,
        verified_date = null,
        updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
    where id = $1::uuid
      and factory_status_id = 64
      and (assigned_user_id = $2::uuid
           or assigned_user_id is null
           or exists (select 1 from "user" u where u.id = $2::uuid and u.role_id = 1))
    returning id
)
update product_for_sale_store_order_element e
set prepared_check = false
from retrocedido r
where e.pfsso_id = r.id
  and e.prepared_check','product_for_sale_store_order','PATCH');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- Columna nueva, al lado de is_check
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'product_for_sale_store_order_element'
--    AND column_name IN ('is_check', 'prepared_check')
--  ORDER BY column_name;
--
-- -- Endpoints nuevos (deben salir 3 filas, veces = 1)
-- SELECT "path", COUNT(*) AS veces FROM sql_queries
--  WHERE "path" IN ('/listProductForSaleStoreOrderPreparedV2',
--                   '/updateProductForSaleStoreOrderElementsPreparedCheck',
--                   '/unprepareProductForSaleStoreOrderV2')
--  GROUP BY "path" ORDER BY "path";
--
-- -- Los clones traen lo nuevo y los originales siguen sin ello
-- SELECT "path", consulta_sql LIKE '%prepared_check%' AS trae_prepared FROM sql_queries
--  WHERE "path" IN ('/listProductForSaleStoreOrderPreparedV1','/listProductForSaleStoreOrderPreparedV2',
--                   '/unprepareProductForSaleStoreOrder','/unprepareProductForSaleStoreOrderV2');
--
-- -- Prueba de las dos pasadas, de punta a punta:
-- --  1) Tablero: tomar un pedido, marcar 2 productos, guardar.
-- --  2) Pasarlo a PREPARADO y abrir la vista Pedidos preparados: el contador
-- --     debe arrancar en 0/N. Los tildes del paso 1 NO se heredan.
-- --  3) Marcar 1 producto ahí y guardar. Comprobar que son columnas distintas:
-- --     SELECT id, is_check, prepared_check FROM product_for_sale_store_order_element
-- --      WHERE pfsso_id = '<order_id>' ORDER BY id;
-- --     Deben verse 2 en is_check y 1 en prepared_check.
-- --  4) Devolver el pedido a EN CURSO desde el tablero y repetir la consulta:
-- --     prepared_check debe quedar en false en TODOS, is_check intacto.
--
-- -- El guard de estado: llamar al endpoint del PASO 3 sobre un pedido En
-- -- curso(12) no debe cambiar nada (0 filas, sin error).
--
-- -- Avance de las dos pasadas sobre los pedidos preparados:
-- SELECT o.order_number,
--        COUNT(*) FILTER (WHERE e.is_check)       AS alistados,
--        COUNT(*) FILTER (WHERE e.prepared_check) AS revisados,
--        COUNT(*) AS total
--   FROM product_for_sale_store_order o
--   JOIN product_for_sale_store_order_element e ON e.pfsso_id = o.id
--  WHERE o.factory_status_id = 64
--  GROUP BY o.order_number ORDER BY o.order_number DESC;
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve a las V1 con revertir el commit; la base se deja como estaba con:
--
-- DELETE FROM public.sql_queries WHERE "path" IN
--   ('/listProductForSaleStoreOrderPreparedV2',
--    '/updateProductForSaleStoreOrderElementsPreparedCheck',
--    '/unprepareProductForSaleStoreOrderV2');
--
-- La columna se puede dejar: tiene default y, sin esos endpoints, nadie la lee
-- ni la escribe. Si igual se quiere quitar:
-- ALTER TABLE public.product_for_sale_store_order_element DROP COLUMN IF EXISTS prepared_check;
-- #############################################################################
