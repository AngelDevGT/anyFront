-- =============================================================================
-- Migración: lectura del pedido para el PDF, V4
-- Fecha: 2026-10-16
-- Ejecución: MANUAL. Correr en el Postgres de producción ANTES de publicar el front.
--
-- Objetivo: la plantilla nueva del PDF de pedidos (fábrica y tienda) imprime datos que
-- /getProductForSaleStoreOrderForPdfV3 no devuelve: quién creó el pedido, la dirección de la
-- tienda y, en el formato de fábrica, el encargado, quién verificó y las fechas de cada etapa.
--
-- La query del PDF es reducida a propósito (sin fotos ni descripciones), así que solo se agrega
-- lo que la plantilla pinta:
--   * startDate, readyDate, receivedDate  -> fechas de Inicio, Listo y Entregado (fábrica)
--   * assignedUser.name                   -> Encargado (fábrica)
--   * verifiedUser.name, verifiedDate     -> Verificado por ... el ... (fábrica)
--   * creatorUser.name                    -> Creado por
--   * establishment.address               -> dirección de la tienda
--   * storeStatus.id, factoryStatus.id    -> marca de agua de Cancelado / Devuelto
--
-- ENFOQUE ADITIVO:
--   * /getProductForSaleStoreOrderForPdfV3 NO se toca: se DERIVA de la fila viva con replace().
--   * No cambia ninguna tabla ni procedure.
--
-- Versiones que nacen acá:
--   /getProductForSaleStoreOrderForPdfV3 -> /getProductForSaleStoreOrderForPdfV4
-- =============================================================================


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- La V3 existe y trae las 4 anclas del replace (las cuatro columnas en true).
SELECT "path",
       consulta_sql LIKE '%''updatedDate'', coalesce(pfsso.updated_date, pfsso.creation_date),%' AS ancla_fechas,
       consulta_sql LIKE '%''name'', e."name"%'      AS ancla_tienda,
       consulta_sql LIKE '%''identifier'', s.name%'  AS ancla_estado_tienda,
       consulta_sql LIKE '%''identifier'', s2.name%' AS ancla_estado_fabrica
  FROM public.sql_queries
 WHERE "path" = '/getProductForSaleStoreOrderForPdfV3';


-- #############################################################################
-- PASO 1 — /getProductForSaleStoreOrderForPdfV4
--
-- Es idempotente: si ya existe no hace nada. Si la V3 no trae alguna ancla (alguien la editó a
-- mano), aborta en lugar de crear una consulta sin los campos.
--
-- Los usuarios se leen con subconsultas y no con JOIN para no tocar el FROM de la V3: sin
-- encargado o sin verificación la subconsulta da NULL y el JSON trae null.
-- #############################################################################

DO $do$
DECLARE
    _a_fechas   text := $a$'updatedDate', coalesce(pfsso.updated_date, pfsso.creation_date),$a$;
    _a_tienda   text := $a$'name', e."name"$a$;
    _a_st_tda   text := $a$'identifier', s.name$a$;
    _a_st_fab   text := $a$'identifier', s2.name$a$;
    _sql        text;
BEGIN
    IF EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderForPdfV4') THEN
        RAISE NOTICE '/getProductForSaleStoreOrderForPdfV4 ya existe: no se vuelve a crear.';
        RETURN;
    END IF;

    SELECT consulta_sql INTO _sql
      FROM public.sql_queries
     WHERE "path" = '/getProductForSaleStoreOrderForPdfV3';

    IF _sql IS NULL THEN
        RAISE EXCEPTION 'No existe /getProductForSaleStoreOrderForPdfV3: no se crea la V4.';
    END IF;

    IF position(_a_fechas in _sql) = 0 OR position(_a_tienda in _sql) = 0
       OR position(_a_st_tda in _sql) = 0 OR position(_a_st_fab in _sql) = 0 THEN
        RAISE EXCEPTION 'La consulta /getProductForSaleStoreOrderForPdfV3 no trae las anclas esperadas: no se crea la V4.';
    END IF;

    _sql := replace(_sql, _a_fechas, _a_fechas || $r$
    'startDate', pfsso.start_date,
    'readyDate', pfsso.ready_date,
    'receivedDate', pfsso.received_date,
    'verifiedDate', pfsso.verified_date,
    'creatorUser', (select json_build_object('name', uc.username)
                      from "user" uc where uc.id = pfsso.creator_user_id),
    'assignedUser', (select json_build_object('name', ua.username)
                       from "user" ua where ua.id = pfsso.assigned_user_id),
    'verifiedUser', (select json_build_object('name', uv.username)
                       from "user" uv where uv.id = pfsso.verified_by_user_id),$r$);

    _sql := replace(_sql, _a_tienda, _a_tienda || $r$,
        'address', e.address$r$);

    _sql := replace(_sql, _a_st_tda, _a_st_tda || $r$,
        'id', s.id$r$);

    _sql := replace(_sql, _a_st_fab, _a_st_fab || $r$,
        'id', s2.id$r$);

    INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
    SELECT 'getProductForSaleStoreOrderForPdfV4', '/getProductForSaleStoreOrderForPdfV4',
           _sql, principal_table, "type"
      FROM public.sql_queries
     WHERE "path" = '/getProductForSaleStoreOrderForPdfV3';
END
$do$;


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- La ruta existe una sola vez y trae los campos nuevos (1 fila: veces = 1, todo en true)
-- SELECT "path", COUNT(*) AS veces,
--        bool_and(consulta_sql LIKE '%startDate%')     AS trae_inicio,
--        bool_and(consulta_sql LIKE '%readyDate%')     AS trae_listo,
--        bool_and(consulta_sql LIKE '%receivedDate%')  AS trae_recibido,
--        bool_and(consulta_sql LIKE '%verifiedUser%')  AS trae_verificacion,
--        bool_and(consulta_sql LIKE '%creatorUser%')   AS trae_creador,
--        bool_and(consulta_sql LIKE '%assignedUser%')  AS trae_encargado,
--        bool_and(consulta_sql LIKE '%e.address%')     AS trae_direccion,
--        bool_and(consulta_sql LIKE '%s2.id%')         AS trae_estado_fabrica_id
--   FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderForPdfV4' GROUP BY "path";
--
-- -- La V3 sigue sin los campos nuevos (false)
-- SELECT consulta_sql LIKE '%verifiedUser%' AS trae_verificacion
--   FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderForPdfV3';
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve a la V3 con revertir el commit. La base se deja como estaba con:
--
-- DELETE FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderForPdfV4';
-- #############################################################################
