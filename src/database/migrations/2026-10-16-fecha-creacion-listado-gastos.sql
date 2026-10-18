-- =============================================================================
-- Migración: fecha de creación en el listado de gastos
-- Fecha: 2026-10-16
-- Ejecución: MANUAL. Correr en el Postgres de producción ANTES de publicar el front.
--
-- Objetivo: el listado de gastos de la tienda muestra la fecha y hora en que se REGISTRÓ el
-- gasto, no la de su última actualización. /listStoreExpense solo devolvía updatedDate, así
-- que el listado no tenía de dónde sacar la de creación.
--
-- ENFOQUE ADITIVO:
--   * /listStoreExpense NO se toca. /listStoreExpenseV2 se DERIVA de la fila viva con
--     replace(), agregando creationDate justo antes de updatedDate.
--   * No cambia ninguna tabla ni procedure.
--
-- Versiones que nacen acá:
--   /listStoreExpense -> /listStoreExpenseV2
-- =============================================================================


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- La lectura original existe y trae el ancla del replace (tiene_ancla = true).
SELECT "path", consulta_sql LIKE '%''updatedDate'', coalesce(se.updated_date, se.creation_date),%' AS tiene_ancla
  FROM public.sql_queries
 WHERE "path" = '/listStoreExpense';


-- #############################################################################
-- PASO 1 — /listStoreExpenseV2
--
-- Es idempotente: si ya existe no hace nada. Si la original no trae el ancla (alguien la
-- editó a mano), aborta en lugar de crear una consulta sin el campo.
-- #############################################################################

DO $do$
DECLARE
    _anchor text := '''updatedDate'', coalesce(se.updated_date, se.creation_date),';
BEGIN
    IF EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/listStoreExpenseV2') THEN
        RAISE NOTICE '/listStoreExpenseV2 ya existe: no se vuelve a crear.';
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.sql_queries
                    WHERE "path" = '/listStoreExpense' AND position(_anchor in consulta_sql) > 0) THEN
        RAISE EXCEPTION 'La consulta /listStoreExpense no trae el ancla esperada: no se crea la V2.';
    END IF;

    INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
    SELECT 'listStoreExpenseV2', '/listStoreExpenseV2',
           replace(consulta_sql, _anchor,
                   '''creationDate'', se.creation_date,
        ' || _anchor),
           principal_table, "type"
      FROM public.sql_queries
     WHERE "path" = '/listStoreExpense';
END
$do$;


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- La ruta existe una sola vez y trae las dos fechas (1 fila: veces = 1, las dos en true)
-- SELECT "path", COUNT(*) AS veces,
--        bool_and(consulta_sql LIKE '%creationDate%') AS trae_creacion,
--        bool_and(consulta_sql LIKE '%updatedDate%')  AS trae_actualizacion
--   FROM public.sql_queries WHERE "path" = '/listStoreExpenseV2' GROUP BY "path";
--
-- -- La original sigue sin el campo nuevo (false)
-- SELECT consulta_sql LIKE '%creationDate%' AS trae_creacion
--   FROM public.sql_queries WHERE "path" = '/listStoreExpense';
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve a /listStoreExpense con revertir el commit. La base se deja como estaba con:
--
-- DELETE FROM public.sql_queries WHERE "path" = '/listStoreExpenseV2';
-- #############################################################################
