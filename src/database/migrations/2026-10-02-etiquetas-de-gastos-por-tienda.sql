-- =============================================================================
-- Migración: etiquetas de gastos por tienda
-- Fecha: 2026-10-02
-- Ejecución: MANUAL. Correr en el Postgres de producción, DESPUÉS de
--            2026-10-02-vender-pedidos-por-tienda.sql (se clona su /getEstablishmentV3).
--
-- Objetivo: cada tienda lleva un listado de etiquetas que se ofrecen al
-- registrar un gasto (EMB-ANY-009). Se carga desde el botón "Gastos" en
-- Sistema > Tiendas, con el mismo modal que "Bancos", y se muestra en el
-- detalle de la tienda.
--
-- Mismo formato que establishment.banks (ver 2026-08-31-bancos-por-tienda.sql):
-- texto con los nombres separados por SALTO DE LÍNEA. Es una lista de opciones,
-- no un catálogo: el gasto guarda el texto de la etiqueta, no una referencia,
-- así que borrar una etiqueta de la tienda no toca los gastos ya registrados.
--
-- TOPES
-- Los aplica la interfaz, no esta columna: 30 etiquetas por lista y 50
-- caracteres por etiqueta (el largo de shop_sale_payment.bank, que es donde
-- termina guardado el banco elegido; las etiquetas de gastos usan el mismo).
-- store_expense.title pasa de varchar(40) a text porque ahí se guardarán las
-- etiquetas elegidas en cada gasto, que pueden ser varias (EMB-ANY-009).
--
-- ENFOQUE 100% ADITIVO:
--   * Columna nueva: expense_tags es NULLABLE, sin default. Las tiendas
--     existentes quedan en NULL (sin etiquetas hasta que se las carguen).
--   * store_expense.title se ensancha a text: todo valor varchar(40) es un
--     text válido, así que no se pierde ni se reescribe ningún dato.
--   * NINGÚN procedure se toca.
--   * /getEstablishmentV3 se clona a V4; la V3 sigue viva.
--   * /updateEstablishment(V2) no incluye expense_tags en su SET, así que el
--     formulario normal de la tienda no puede borrarlas.
--   * /retrieveEstablishments NO se toca.
--
-- Versiones que nacen acá:
--   /getEstablishmentV3              -> V4
--   /updateEstablishmentExpenseTags  -> nuevo
-- =============================================================================


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- 0.a La lectura V3 tiene que existir y traer el ancla del replace del PASO 2.
--     Si no sale la fila con tiene_ancla = true, no seguir.
SELECT "path", consulta_sql LIKE '%''banks'', e.banks,%' AS tiene_ancla
  FROM public.sql_queries
 WHERE "path" = '/getEstablishmentV3';

-- 0.b La columna no debería existir todavía (0 filas).
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'establishment' AND column_name = 'expense_tags';


-- #############################################################################
-- PASO 1 — Columna nueva
-- #############################################################################

ALTER TABLE public.establishment
    ADD COLUMN IF NOT EXISTS expense_tags text NULL;

-- Sin tope de caracteres para el título del gasto: guarda todas las etiquetas
-- elegidas. Si alguna vista depende de la columna, Postgres rechaza el ALTER y
-- lo dice: en ese caso no seguir.
ALTER TABLE public.store_expense
    ALTER COLUMN title TYPE text;


-- #############################################################################
-- PASO 2 — Lectura del detalle de tienda
--
-- Se deriva con replace() de la fila VIVA de /getEstablishmentV3. El ancla es
-- la clave de banks, que aparece una sola vez en la consulta.
--
-- El guard NOT EXISTS la hace idempotente.
-- #############################################################################

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getEstablishmentV4','/getEstablishmentV4',
       replace(consulta_sql,
           '''banks'', e.banks,',
           '''banks'', e.banks,
    ''expenseTags'', e.expense_tags,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getEstablishmentV3'
  AND consulta_sql LIKE '%''banks'', e.banks,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/getEstablishmentV4');


-- #############################################################################
-- PASO 3 — Escritura de las etiquetas
--
-- Toca expense_tags y updated_date, nada más. nullif deja la columna en NULL
-- cuando se guarda sin ninguna etiqueta.
--
-- El DELETE previo la hace idempotente.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/updateEstablishmentExpenseTags';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('updateEstablishmentExpenseTags','/updateEstablishmentExpenseTags','update establishment
set expense_tags = nullif($1, ''''),
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $2::uuid','establishment','PATCH');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- store_expense.title quedó como text
-- SELECT data_type, character_maximum_length FROM information_schema.columns
--  WHERE table_name = 'store_expense' AND column_name = 'title';
--
-- -- Las dos rutas existen y ninguna está duplicada (debe dar 2 filas, veces = 1)
-- SELECT "path", COUNT(*) AS veces FROM public.sql_queries
--  WHERE "path" IN ('/getEstablishmentV4','/updateEstablishmentExpenseTags')
--  GROUP BY "path" ORDER BY "path";
--
-- -- El clon trae el campo nuevo y conserva los de V3
-- SELECT "path",
--        consulta_sql LIKE '%expenseTags%' AS trae_etiquetas,
--        consulta_sql LIKE '%sellOrdersEnabled%' AS trae_vender_pedidos
--   FROM public.sql_queries
--  WHERE "path" IN ('/getEstablishmentV3','/getEstablishmentV4');
--
-- -- Prueba real:
-- -- Llamar a /updateEstablishmentExpenseTags con
-- --   {"$1": "Luz\nAgua\nTransporte", "$2": "<id>"}
-- -- y leerla con /getEstablishmentV4 {"e": {"id": "<id>"}}: expenseTags debe
-- -- volver con el salto de línea intacto.
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve a /getEstablishmentV3 con revertir el commit. La base se deja
-- como estaba con:
--
-- DELETE FROM public.sql_queries
--  WHERE "path" IN ('/getEstablishmentV4','/updateEstablishmentExpenseTags');
--
-- La columna se puede dejar: es NULLABLE y nadie más la lee. Para sacarla:
-- ALTER TABLE public.establishment DROP COLUMN IF EXISTS expense_tags;
--
-- store_expense.title se puede dejar como text. Volver a varchar(40)
-- falla si ya hay títulos más largos; en ese caso hay que recortarlos antes.
-- #############################################################################
