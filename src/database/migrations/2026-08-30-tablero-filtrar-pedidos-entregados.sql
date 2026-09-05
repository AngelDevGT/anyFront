-- =============================================================================
-- Migración: el tablero deja de traerse los pedidos ya entregados
-- Fecha: 2026-08-30
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Problema: /listProductForSaleStoreOrderBoardV5 devuelve TODOS los pedidos del
-- rango de fechas, y el tablero solo pinta cuatro estados —Pendiente(11), En
-- curso(12), Preparado(64) y Listo(13)—. Todo lo demás se baja, se parsea y
-- distribute() lo tira. El grueso de ese descarte son los pedidos ya entregados:
-- es el estado terminal al que llega TODO pedido que salió bien, así que su
-- proporción solo crece con el tiempo.
--
-- Se descartan los pedidos con factory_status_id = 16 (Entregado) o
-- store_status_id = 22 (Recibido en tienda). Las dos condiciones se escriben
-- aunque en la práctica viajen juntas —manage_product_for_sale_order_state pone
-- 16 y 22 en la misma sentencia—: cubren los pedidos viejos que hayan quedado
-- con solo una de las dos.
--
-- QUÉ SIGUE VINIENDO: el tablero tampoco muestra En camino(1), Cancelado(15),
-- Devuelto(18) ni Eliminado(10), y esta migración NO los filtra. Son casos raros
-- —no es donde está el volumen— y dejarlos afuera exigiría decidir si el tablero
-- alguna vez va a querer verlos. Si más adelante hiciera falta, el filtro del
-- PASO 1 pasa a ser una lista blanca: "where factory_status_id in (11, 12, 64,
-- 13)", que es exactamente lo que distribute() conserva.
--
-- POR QUÉ UN SUBSELECT Y NO UN WHERE
-- La query del tablero termina en los LEFT JOIN, sin WHERE: el Function App le
-- concatena uno armado con lo que venga en el body (el tablero manda
-- creation_date$gte y creation_date$lte). Un WHERE escrito dentro de la query
-- daría "... where factory_status_id <> 16 WHERE pfsso.creation_date >= ..." y
-- fallaría al parsear.
--
-- Con "from (select * from product_for_sale_store_order where ...) pfsso" el
-- filtro es un filtro de filas de verdad, los LEFT JOIN siguen siendo LEFT, el
-- alias pfsso se conserva y el WHERE del backend cae al final, sobre el select
-- externo, donde pfsso.creation_date sigue resolviendo por el "select *".
--
-- ENFOQUE 100% ADITIVO: fila NUEVA (V6) derivada de la V5 con replace(), igual
-- que las migraciones anteriores de esta familia. La V5 queda viva e intacta.
-- =============================================================================

-- ###########################################################################
-- ORDEN: correr DESPUÉS de 2026-08-29-verificacion-pedidos-bodega.sql, que es
-- la que crea /listProductForSaleStoreOrderBoardV5. Sin ella el INSERT del
-- PASO 1 no inserta nada —el SELECT no encuentra origen— y el front queda
-- pidiendo un endpoint que no existe.
-- ###########################################################################


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- 0.a La query de la que sale el clon tiene que existir y tener el ancla del
--     replace(). Deben salir existe = true y tiene_ancla = true.
SELECT "path" IS NOT NULL AS existe,
       consulta_sql LIKE '%from product_for_sale_store_order pfsso%' AS tiene_ancla
  FROM public.sql_queries
 WHERE "path" = '/listProductForSaleStoreOrderBoardV5';

-- 0.b El ancla tiene que aparecer UNA sola vez: el replace() cambia todas las
--     ocurrencias, y las subconsultas de la query (verificador, encargado) no
--     deben tocarse. Debe dar veces = 1.
SELECT (length(consulta_sql) - length(replace(consulta_sql, 'from product_for_sale_store_order pfsso', '')))
       / length('from product_for_sale_store_order pfsso') AS veces
  FROM public.sql_queries
 WHERE "path" = '/listProductForSaleStoreOrderBoardV5';

-- 0.c Los ids de estado. Deben ser Entregado = 16 y Recibido = 22; si en esta
--     base tienen otros números, corregirlos en el PASO 1.
SELECT s.id, s."name" FROM status s WHERE s.id IN (16, 22) ORDER BY s.id;

-- 0.d Cuánto se ahorra. Sobre los últimos 15 días, que es el rango por defecto
--     del tablero: "descartados" es lo que hoy se baja para nada.
SELECT COUNT(*) FILTER (WHERE factory_status_id = 16 OR store_status_id = 22) AS descartados,
       COUNT(*) AS total
  FROM product_for_sale_store_order
 WHERE creation_date >= timezone('UTC'::text, CURRENT_TIMESTAMP) - interval '15 days';


-- #############################################################################
-- PASO 1 — /listProductForSaleStoreOrderBoardV6
--
-- Derivada con replace() de la fila viva, igual que el PASO 6 de la migración de
-- verificación. El NOT EXISTS la hace re-ejecutable sin duplicar la ruta.
--
-- El índice idx_pfsso_factory_status (2026-08-10-board-pedidos-bodega.sql) ya
-- existe; con un <> no se usa, pero el filtro igual corre sobre el resultado del
-- rango de fechas, que es chico. No hace falta índice nuevo.
-- #############################################################################

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'listProductForSaleStoreOrderBoardV6','/listProductForSaleStoreOrderBoardV6',
       replace(consulta_sql,
           'from product_for_sale_store_order pfsso',
           'from (select * from product_for_sale_store_order
       where factory_status_id <> 16
         and store_status_id <> 22) pfsso'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/listProductForSaleStoreOrderBoardV5'
  AND consulta_sql LIKE '%from product_for_sale_store_order pfsso%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/listProductForSaleStoreOrderBoardV6');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- La ruta nueva existe una sola vez
-- SELECT "path", COUNT(*) AS veces FROM sql_queries
--  WHERE "path" = '/listProductForSaleStoreOrderBoardV6' GROUP BY "path";
--
-- -- La V6 trae el filtro y la V5 sigue sin él
-- SELECT "path", consulta_sql LIKE '%store_status_id <> 22%' AS filtra FROM sql_queries
--  WHERE "path" IN ('/listProductForSaleStoreOrderBoardV5','/listProductForSaleStoreOrderBoardV6');
--
-- -- El subselect quedó bien armado (debe verse el "from (select * from ...) pfsso")
-- SELECT substring(consulta_sql from 'from \(select.*\) pfsso') FROM sql_queries
--  WHERE "path" = '/listProductForSaleStoreOrderBoardV6';
--
-- -- Prueba real: llamar al endpoint con el body del tablero
-- --   {"pfsso": {"creation_date$gte": "2026-08-15 00:00:00",
-- --              "creation_date$lte": "2026-08-30 23:59:59"}}
-- -- Debe responder sin error (o sea: el WHERE del backend se concatenó bien) y
-- -- ningún elemento del arreglo debe traer factoryStatus.id = 16.
--
-- -- Contraste V5 vs V6 sobre el mismo rango: la V6 debe traer menos elementos y
-- -- los mismos pedidos en los cuatro estados del tablero.
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve a la V5 con revertir el commit; la base se deja como estaba con:
--
-- DELETE FROM public.sql_queries WHERE "path" = '/listProductForSaleStoreOrderBoardV6';
-- #############################################################################
