-- =============================================================================
-- Migración: atributo "Vender pedidos" por tienda
-- Fecha: 2026-10-02
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Objetivo: cada tienda decide si puede vender un pedido directamente desde su
-- detalle (botones "Vender pedido" y "Recibir y vender", EMB-ANY-003/004). Se
-- habilita con un checkbox en Sistema > Tiendas > Editar, igual que "Recibir
-- pedidos pendientes desde tienda". Por defecto queda inhabilitado.
--
-- ENFOQUE 100% ADITIVO:
--   * Columna nueva NOT NULL DEFAULT false: las tiendas existentes quedan
--     inhabilitadas sin rellenar nada a mano.
--   * NINGÚN procedure se toca.
--   * /addEstablishment no cambia: es el insert genérico que arma las columnas
--     a partir de las llaves del JSON, así que basta con mandar
--     sell_orders_enabled desde el front.
--   * /updateEstablishment tiene un SET explícito, así que se clona a V2 con la
--     columna nueva. La V1 sigue viva e intacta.
--   * /getEstablishmentV2 se clona a V3 agregando sellOrdersEnabled. La V2
--     sigue viva.
--   * /retrieveEstablishments NO se toca: el listado no muestra el atributo.
--
-- Versiones que nacen acá:
--   /getEstablishmentV2     -> V3
--   /updateEstablishment    -> V2
-- =============================================================================


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- 0.a La lectura V2 tiene que existir y traer el ancla del replace del PASO 2.
--     Si no sale la fila con tiene_ancla = true, no seguir.
SELECT "path", consulta_sql LIKE '%''receivePendingOrdersEnabled'', e.receive_pending_orders_enabled,%' AS tiene_ancla
  FROM public.sql_queries
 WHERE "path" = '/getEstablishmentV2';

-- 0.b La columna no debería existir todavía (0 filas).
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'establishment' AND column_name = 'sell_orders_enabled';


-- #############################################################################
-- PASO 1 — Columna nueva
-- #############################################################################

ALTER TABLE public.establishment
    ADD COLUMN IF NOT EXISTS sell_orders_enabled bool DEFAULT false NOT NULL;


-- #############################################################################
-- PASO 2 — Lectura del detalle de tienda
--
-- Se deriva con replace() de la fila VIVA de /getEstablishmentV2, igual que en
-- 2026-08-31-bancos-por-tienda.sql. El ancla es la clave de
-- receivePendingOrdersEnabled, que aparece una sola vez en la consulta.
--
-- El guard NOT EXISTS la hace idempotente.
-- #############################################################################

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getEstablishmentV3','/getEstablishmentV3',
       replace(consulta_sql,
           '''receivePendingOrdersEnabled'', e.receive_pending_orders_enabled,',
           '''receivePendingOrdersEnabled'', e.receive_pending_orders_enabled,
    ''sellOrdersEnabled'', e.sell_orders_enabled,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getEstablishmentV2'
  AND consulta_sql LIKE '%''receivePendingOrdersEnabled'', e.receive_pending_orders_enabled,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/getEstablishmentV3');


-- #############################################################################
-- PASO 3 — Escritura de la tienda
--
-- Mismo SET que /updateEstablishment más sell_orders_enabled. El id pasa de $6
-- a $7: el front manda las llaves en ese orden.
--
-- El DELETE previo la hace idempotente.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/updateEstablishmentV2';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('updateEstablishmentV2','/updateEstablishmentV2','update establishment
set name = $1,
address = $2,
description = $3,
receive_pending_orders_enabled = $4,
establishment_type_id = $5,
sell_orders_enabled = $6,
updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $7','establishment','PATCH');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- Columna nueva, todas las tiendas en false
-- SELECT sell_orders_enabled, COUNT(*) FROM establishment GROUP BY 1;
--
-- -- Las dos rutas existen y ninguna está duplicada (debe dar 2 filas, veces = 1)
-- SELECT "path", COUNT(*) AS veces FROM public.sql_queries
--  WHERE "path" IN ('/getEstablishmentV3','/updateEstablishmentV2')
--  GROUP BY "path" ORDER BY "path";
--
-- -- El clon trae el campo nuevo y la V2 sigue sin él
-- SELECT "path", consulta_sql LIKE '%sellOrdersEnabled%' AS trae_campo FROM public.sql_queries
--  WHERE "path" IN ('/getEstablishmentV2','/getEstablishmentV3');
--
-- -- Prueba real: editar una tienda desde Sistema > Tiendas marcando
-- -- "Vender pedidos" y leerla con /getEstablishmentV3 {"e": {"id": "<id>"}}:
-- -- sellOrdersEnabled debe volver en true.
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve a /getEstablishmentV2 y /updateEstablishment con revertir el
-- commit. La base se deja como estaba con:
--
-- DELETE FROM public.sql_queries
--  WHERE "path" IN ('/getEstablishmentV3','/updateEstablishmentV2');
--
-- La columna se puede dejar: tiene default y nadie más la lee. Para sacarla:
-- ALTER TABLE public.establishment DROP COLUMN IF EXISTS sell_orders_enabled;
-- #############################################################################
