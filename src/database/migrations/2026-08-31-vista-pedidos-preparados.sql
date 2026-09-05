-- =============================================================================
-- Migración: vista "Pedidos preparados" de bodega
-- Fecha: 2026-08-31
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Objetivo: una pantalla nueva (/finishedProduct/order/prepared) que muestre de
-- una sola vez TODOS los pedidos en Preparado(64) con su lista de productos, en
-- tarjetas iguales a las del panel "Productos" del tablero. Es la pantalla desde
-- la que se verifica: el tablero obliga a abrir pedido por pedido, y quien firma
-- necesita verlos todos juntos.
--
-- NO es un estado nuevo ni una transición nueva. Solo LEE los pedidos que ya
-- están en Preparado; para verificarlos reusa /verifyProductForSaleStoreOrderPrepared
-- (2026-08-29-verificacion-pedidos-bodega.sql), que no se toca.
--
-- POR QUÉ UN ENDPOINT NUEVO Y NO EL DEL TABLERO
-- /listProductForSaleStoreOrderBoardV6 trae la cabecera de los pedidos SIN sus
-- elementos: el tablero los pide aparte, uno por uno, cuando se abre una tarjeta.
-- Esta pantalla los abre TODOS, así que por ese camino cada recarga —y hay
-- recarga automática— serían 1 + N llamadas. Con esta query es UNA, y además el
-- resultado es un snapshot consistente: no puede pasar que la cabecera venga de
-- antes de un movimiento y los productos de después.
--
-- SOLO LO QUE LA TARJETA PINTA
-- A diferencia de la query del tablero, esta NO trae finalAmount, creatorUser,
-- storeStatus, updatedDate ni readyDate, y tampoco factory_status: el filtro deja
-- el estado fijo en Preparado, así que devolverlo sería repetir una constante en
-- cada fila. Sigue sin traer finished_product.photo, que es el motivo por el que
-- existe la familia de queries livianas de pedidos.
--
-- POR QUÉ EL FILTRO VA EN UN SUBSELECT Y NO EN UN WHERE
-- El Function App concatena su propio WHERE con lo que venga en el body. Un WHERE
-- escrito al final de la query se rompería en cuanto alguien mandara un filtro.
-- Con "from (select * from product_for_sale_store_order where ...) pfsso" el
-- filtro es de filas, los LEFT JOIN siguen siendo LEFT y el WHERE del backend cae
-- sobre el select externo. Es el mismo recurso que usa la V6; ver
-- 2026-08-30-tablero-filtrar-pedidos-entregados.sql.
--
-- El front llama con el wrapper vacío ({"pfsso": {}}), así que hoy no se concatena
-- ningún WHERE: el filtro por estado vive entero acá adentro.
--
-- ENFOQUE 100% ADITIVO: una fila nueva en sql_queries y, si hace falta, un patrón
-- nuevo en role.paths. No se toca ninguna query, procedure ni tabla existente.
-- =============================================================================

-- ###########################################################################
-- ORDEN: correr DESPUÉS de
--   * 2026-08-26-operadores-pedidos.sql        (columna operators)
--   * 2026-08-29-verificacion-pedidos-bodega.sql (verified_by_user_id/_date)
--   * 2026-08-30-check-productos-pedido.sql    (columna is_check)
-- La query del PASO 1 lee esas tres columnas: sin ellas falla al ejecutarse.
-- ###########################################################################


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- 0.a Las columnas que lee la query nueva tienen que existir. Deben salir 4 filas.
SELECT column_name
  FROM information_schema.columns
 WHERE table_name = 'product_for_sale_store_order'
   AND column_name IN ('operators', 'verified_by_user_id', 'verified_date', 'prepared_date')
 UNION ALL
SELECT column_name
  FROM information_schema.columns
 WHERE table_name = 'product_for_sale_store_order_element'
   AND column_name = 'is_check';

-- 0.b El id del estado. Debe ser Preparado = 64; si en esta base tiene otro
--     número, corregirlo en el PASO 1.
SELECT s.id, s."name" FROM status s WHERE s.id = 64;

-- 0.c Cuántos pedidos va a listar la pantalla hoy. Preparado es un estado de
--     paso, así que el número normal es de unos pocos; si sale grande, hay
--     pedidos preparados y olvidados, que es justamente lo que esta vista
--     destapa.
SELECT COUNT(*) AS preparados,
       COUNT(*) FILTER (WHERE verified_by_user_id IS NULL) AS sin_verificar
  FROM product_for_sale_store_order
 WHERE factory_status_id = 64;

-- 0.d Los permisos de ruta actuales, para el PASO 2.
SELECT id, "name", paths FROM "role";


-- #############################################################################
-- PASO 1 — /listProductForSaleStoreOrderPreparedV1
--
-- El V1 no es una versión de nada previo: el endpoint nace nuevo y toma el
-- sufijo por costumbre de la familia.
--
-- ORDER BY prepared_date ASC: primero lo que lleva más tiempo esperando. Es al
-- revés que el tablero (creation_date DESC) a propósito: acá la lista es una cola
-- de trabajo, y lo que se preparó hace tres horas y nadie verificó es lo que
-- tiene que aparecer arriba. NULLS LAST cubre los pedidos que hayan llegado a
-- Preparado sin fecha (no debería pasar: prepare_product_for_sale_order la
-- escribe siempre).
--
-- El DELETE previo la hace idempotente: sql_queries no tiene unique en "path",
-- así que re-ejecutar sin él duplicaría la fila y el router podría resolver la
-- equivocada.
--
-- El índice idx_pfsso_factory_status (2026-08-10-board-pedidos-bodega.sql) ya
-- existe y un "= 64" sí lo usa. No hace falta índice nuevo.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/listProductForSaleStoreOrderPreparedV1';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('listProductForSaleStoreOrderPreparedV1','/listProductForSaleStoreOrderPreparedV1','SELECT json_agg(
    json_build_object(
        ''id'', pfsso.id,
        ''orderNumber'', pfsso.order_number,
        ''name'', pfsso.name,
        ''comment'', pfsso.comment,
        ''creationDate'', pfsso.creation_date,
        ''startDate'', pfsso.start_date,
        ''preparedDate'', pfsso.prepared_date,
        ''verifiedDate'', pfsso.verified_date,
        ''operators'', pfsso.operators,
        ''establishment'', json_build_object(
            ''id'', e.id,
            ''name'', e."name",
            ''identifier'', e."name"
        ),
        ''assignedUser'', case when u.id is null then null else json_build_object(
            ''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        ) end,
        ''verifiedUser'', case when u2.id is null then null else json_build_object(
            ''id'', u2.id,
            ''name'', u2.username,
            ''email'', u2.email
        ) end,
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
    )
    ORDER BY pfsso.prepared_date ASC NULLS LAST
) AS json_result
from (select * from product_for_sale_store_order
       where factory_status_id = 64) pfsso
left join establishment e on e.id = pfsso.establishment_id
left join "user" u on u.id = pfsso.assigned_user_id
left join "user" u2 on u2.id = pfsso.verified_by_user_id','product_for_sale_store_order','POST');


-- #############################################################################
-- PASO 2 — Permisos de ruta para la vista nueva: /finishedProduct/order/prepared
--
-- El guard canActivateV2 valida la ruta contra role.paths, que es un JSON con
-- objetos { "matchPattern": "<regex>" }. Los mismos patrones deciden qué ítems
-- del menú se pintan, así que sin esto la entrada nueva NO aparece en el sidebar
-- y entrar por URL redirige.
--
-- Si el rol ya tiene un patrón amplio del módulo (ej. "^\/finishedProduct(\/.*)?$")
-- la ruta nueva YA queda cubierta y no hay nada que hacer. Revisar con el 0.d.
--
-- Si los patrones son exactos, agregarlo a los MISMOS roles que hoy ven el
-- tablero. Para saber cuáles son:
--
-- SELECT id, "name" FROM "role"
--  WHERE paths::text LIKE '%finishedProduct%order%board%';
--
-- UPDATE "role"
-- SET paths = (
--     paths::jsonb || '[{"matchPattern": "^\\/finishedProduct\\/order\\/prepared$"}]'::jsonb
-- )::text
-- WHERE id IN (1);   -- ajustar los ids con el resultado de arriba
--
-- Ojo: el guard solo valida la RUTA, no el rol. Quién puede APRETAR el botón
-- "Verificar" lo decide la capacidad orders.verify (perm:orders.verify en
-- role.paths, 2026-08-14-capacidades-por-rol.sql); sin ella la pantalla se ve
-- igual, en modo lectura.
-- #############################################################################


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- La ruta nueva existe una sola vez
-- SELECT "path", COUNT(*) AS veces FROM sql_queries
--  WHERE "path" = '/listProductForSaleStoreOrderPreparedV1' GROUP BY "path";
--
-- -- No trae la foto del producto
-- SELECT consulta_sql LIKE '%photo%' AS trae_foto FROM sql_queries
--  WHERE "path" = '/listProductForSaleStoreOrderPreparedV1';
--
-- -- Prueba real: llamar al endpoint con el body del front, que va vacío:
-- --   {"pfsso": {}}
-- -- Debe devolver un arreglo donde CADA elemento trae su lista
-- -- productForSaleStoreOrderElements, y ninguno un pedido fuera de Preparado.
-- -- Contrastar la cantidad contra el 0.c: deben coincidir.
--
-- -- Sin pedidos preparados json_agg devuelve NULL, no un arreglo vacío. El front
-- -- lo resuelve con "|| []", igual que el tablero; conviene comprobarlo:
-- SELECT count(*) FROM product_for_sale_store_order WHERE factory_status_id = 64;
--
-- -- Los pedidos preparados y sin verificar, que son los que la pantalla existe
-- -- para destapar:
-- SELECT o.order_number, e."name" AS tienda, o.prepared_date
--   FROM product_for_sale_store_order o
--   LEFT JOIN establishment e ON e.id = o.establishment_id
--  WHERE o.factory_status_id = 64 AND o.verified_by_user_id IS NULL
--  ORDER BY o.prepared_date ASC;
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- La pantalla desaparece revirtiendo el commit del front. La base se deja como
-- estaba con:
--
-- DELETE FROM public.sql_queries WHERE "path" = '/listProductForSaleStoreOrderPreparedV1';
--
-- Y, si se agregó el patrón del PASO 2, quitándolo:
--
-- UPDATE "role"
-- SET paths = (
--     paths::jsonb - '{"matchPattern": "^\\/finishedProduct\\/order\\/prepared$"}'::jsonb
-- )::text
-- WHERE id IN (1);
-- #############################################################################
