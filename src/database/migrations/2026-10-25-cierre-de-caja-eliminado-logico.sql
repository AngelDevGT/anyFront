-- =============================================================================
-- Migración: eliminar un cierre de caja = cambiar su estado (borrado lógico)
-- Fecha: 2026-10-25
-- Ejecución: MANUAL. Correr en el Postgres de producción ANTES de publicar el front.
--
-- =============================================================================
-- EL PROBLEMA
-- =============================================================================
--
-- /deleteStoreCashClosing ejecuta `delete from cash_closing where id = $1`. Al
-- eliminar un cierre desaparece la fila completa, con todos sus snapshots jsonb
-- (ventas, pedidos, inventarios, abonos y gastos congelados), y no hay forma de
-- recuperarla ni de auditar qué se había cerrado.
--
-- El status 56 ya estaba reservado para "eliminado" en cierres: el front lo
-- trata así (view-cash-closing.component.ts, `deleteOption`) y las lecturas de
-- un cierre guardado ya lo excluyen al buscar el período anterior. Pero nada lo
-- escribía.
--
-- =============================================================================
-- POR QUÉ NO BASTA CON CAMBIAR EL DELETE POR UN UPDATE
-- =============================================================================
--
-- Con borrado físico, "el cierre anterior" siempre era un cierre vivo. Con
-- borrado lógico, la fila eliminada sigue ahí, y estas lecturas la tomarían
-- como cierre anterior (toman max(creation_date) o el último por fecha SIN
-- excluir el 56):
--
--   * register_cash_closing_v6 (fecha de inicio del período, inventario de
--     partida y saldo de crédito del cierre nuevo).
--   * /getNewStoreCashClosingV7 (la vista previa: inicio de período de ventas,
--     pedidos, acciones de inventario, gastos y abonos; lastInventory y
--     previousCreditBalance).
--
-- Un cierre eliminado movería el inicio del período, el inventario de partida y
-- el saldo de crédito del siguiente cierre. Por eso esta migración también
-- clona esas dos piezas con el filtro `status_id <> 56`.
--
-- OJO, CAMBIO DE COMPORTAMIENTO CONTRA LO QUE DECÍA 2026-09-22:
-- la migración 2026-09-22-fecha-de-pago-y-cierre-congelado.sql (PASO 4) dejó
-- anotado que register_cash_closing no filtraba el 56 y que unificarlo "movería
-- las cifras de cierres ya firmados". Eso era un problema solo si había cierres
-- en 56; hasta hoy el borrado era físico, así que no hay ninguno (PASO 0.b lo
-- confirma). Si el PASO 0.b da más de 0, hay cierres en 56 de antes y el filtro
-- SÍ cambia el período de los cierres nuevos de esa tienda: revisarlos antes.
--
-- Lo que esta migración NO puede hacer: los cierres que ya se borraron
-- físicamente no se recuperan.
--
-- =============================================================================
-- ENFOQUE ADITIVO
-- =============================================================================
--
--   /deleteStoreCashClosing    -> /deleteStoreCashClosingV2   (UPDATE a 56)
--   /addStoreCashClosingV6     -> /addStoreCashClosingV7      (usa la procedure v7)
--   register_cash_closing_v6   -> register_cash_closing_v7
--   /getNewStoreCashClosingV7  -> /getNewStoreCashClosingV8
--   /listStoreCashClosing      -> /listStoreCashClosingV2     (agrega status.id)
--
-- Las anteriores NO se tocan: el front actual sigue funcionando (y sigue
-- borrando físicamente) hasta que se publique el front nuevo.
--
-- /retrieveStoreCashClosingV8 y /getStoreCashClosingV8 (ver / editar un cierre)
-- no cambian: ya excluyen el 56 al buscar el período anterior.
--
-- El script corre en UNA transacción. Si alguna guardia revienta, el COMMIT del
-- final se convierte en rollback y no queda nada a medias.
-- =============================================================================

BEGIN;

-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL (solo lectura)
-- #############################################################################

-- 0.a El status 56 existe y es "Eliminado". Si el nombre no es ese, parar.
-- SELECT id, "name", "type" FROM status WHERE id IN (55, 56, 57);

-- 0.b Cuántos cierres ya están en 56. Esperado: 0 (el borrado era físico).
-- SELECT establishment_id, count(*) FROM cash_closing WHERE status_id = 56 GROUP BY 1;

-- 0.c Los tres anclajes de la procedure v6. Cada uno debe dar 1 fila.
-- SELECT p.proname, length(pg_get_functiondef(p.oid)) AS len
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname = 'register_cash_closing_v6';

-- 0.d Las lecturas que se clonan existen (y /deleteStoreCashClosing sigue siendo el DELETE).
-- SELECT "path", length(consulta_sql) FROM sql_queries
--  WHERE "path" IN ('/deleteStoreCashClosing', '/addStoreCashClosingV6',
--                   '/getNewStoreCashClosingV7', '/listStoreCashClosing');

-- 0.e Cuántas lecturas de "cierre anterior" hay hoy sin filtrar el 56 en la vista previa.
-- SELECT (SELECT count(*) FROM regexp_matches(consulta_sql, 'from\s+cash_closing', 'gi')) AS lecturas
--   FROM sql_queries WHERE "path" = '/getNewStoreCashClosingV7';

-- 0.f Guardia ejecutable: el status 56 tiene que existir (FK de cash_closing.status_id).
DO $do$
DECLARE
    _name text;
BEGIN
    SELECT "name" INTO _name FROM public.status WHERE id = 56;
    IF _name IS NULL THEN
        RAISE EXCEPTION 'No existe el status 56 en la tabla status; revisar el PASO 0.a';
    END IF;
    IF _name NOT ILIKE 'Eliminad%' THEN
        RAISE EXCEPTION 'El status 56 se llama "%" y no "Eliminado"; revisar el PASO 0.a antes de seguir', _name;
    END IF;
END
$do$;


-- #############################################################################
-- PASO 1 — ENDPOINT DE ELIMINACIÓN: /deleteStoreCashClosingV2
--
-- Pasa el cierre a 56 y deja la hora en updated_date (mismo patrón que
-- verify_cash_closing). Solo toca cierres activos (55) o verificados (57): si el
-- cierre ya estaba eliminado no cambia nada, así que repetir la llamada es
-- inofensivo. Misma firma que la V1: PATCH con $1 = id del cierre.
--
-- El DELETE previo lo hace idempotente: sql_queries no tiene unique en "path" y
-- una fila duplicada haría que el router resuelva de forma no determinista.
-- #############################################################################
DELETE FROM public.sql_queries WHERE "path" = '/deleteStoreCashClosingV2';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('deleteStoreCashClosingV2','/deleteStoreCashClosingV2','update cash_closing
set status_id = 56, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1::uuid
and status_id in (55, 57)','cash_closing','PATCH');


-- #############################################################################
-- PASO 2 — PROCEDURE register_cash_closing_v7
--
-- Se DERIVA del código vivo de la v6 (que a su vez viene de la v5 y la v4), igual
-- que hizo la migración del 22-sep, para no pegar ~280 líneas que podrían diferir
-- de lo que hay en la base. Único cambio: las dos lecturas del cierre anterior
-- ignoran los cierres eliminados.
--
--   cc0     -> fecha, inventario de partida del cierre nuevo
--   cc_prev -> saldo de crédito de partida
--
-- Los anclajes se buscan con regex tolerante a espacios/tabs. La guardia exige
-- que TODAS las lecturas de cash_closing de la procedure queden filtradas: si la
-- v6 tuviera una tercera que no conocemos, revienta en vez de dejarla sin filtro.
--
-- Sin guardia de "ya existe": la v7 se deriva siempre de la v6, que no se toca,
-- así que correr esto dos veces produce la misma procedure.
-- #############################################################################
DO $do$
DECLARE
    _src text;
    _lecturas int;
    _filtradas int;
BEGIN
    SELECT pg_get_functiondef(p.oid) INTO _src
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'register_cash_closing_v6';

    IF _src IS NULL THEN
        RAISE EXCEPTION 'No se encontró register_cash_closing_v6 en la base de datos';
    END IF;

    IF _src !~* 'from\s+cash_closing\s+cc0\s+where\s+cc0\.establishment_id\s*=\s*_establishment_id'
       OR _src !~* 'from\s+cash_closing\s+cc_prev\s+where\s+cc_prev\.establishment_id\s*=\s*_establishment_id' THEN
        RAISE EXCEPTION 'register_cash_closing_v6 no tiene los anclajes cc0 / cc_prev esperados; revisar el PASO 0.c';
    END IF;

    _src := replace(_src, 'register_cash_closing_v6', 'register_cash_closing_v7');

    _src := regexp_replace(_src,
        '(from\s+cash_closing\s+cc0\s+where\s+cc0\.establishment_id\s*=\s*_establishment_id)',
        '\1 and cc0.status_id <> 56', 'gi');
    _src := regexp_replace(_src,
        '(from\s+cash_closing\s+cc_prev\s+where\s+cc_prev\.establishment_id\s*=\s*_establishment_id)',
        '\1 AND cc_prev.status_id <> 56', 'gi');

    SELECT count(*) INTO _lecturas  FROM regexp_matches(_src, 'from\s+cash_closing', 'gi');
    SELECT count(*) INTO _filtradas FROM regexp_matches(_src, 'status_id\s*(?:<>|!=)\s*56', 'gi');
    IF _lecturas <> _filtradas THEN
        RAISE EXCEPTION 'register_cash_closing_v7: % lecturas de cash_closing y % filtradas por el 56. Hay una lectura que esta migración no conoce',
            _lecturas, _filtradas;
    END IF;

    EXECUTE _src;
    RAISE NOTICE 'register_cash_closing_v7 creada (% lecturas filtradas)', _filtradas;
END
$do$;


-- #############################################################################
-- PASO 3 — /addStoreCashClosingV7 -> register_cash_closing_v7
-- Misma firma que la V6.
-- #############################################################################
DELETE FROM public.sql_queries WHERE "path" = '/addStoreCashClosingV7';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('addStoreCashClosingV7','/addStoreCashClosingV7','call register_cash_closing_v7($1, $2::uuid, $3::uuid, $4::numeric)','cash_closing','PATCH');


-- #############################################################################
-- PASO 4 — /getNewStoreCashClosingV8 (vista previa del cierre nuevo)
--
-- Se deriva de la fila viva de la V7. La vista previa tiene que partir del mismo
-- cierre anterior que la procedure v7, para que lo que el usuario ve y aprueba
-- sea exactamente lo que se congela. Dos formas de lectura en el texto:
--
--   (a) `from cash_closing cc1 where cc1.establishment_id = e.id`
--       los max(creation_date) que delimitan ventas, pedidos, acciones de
--       inventario, gastos y abonos
--   (b) `from cash_closing where establishment_id = e.id` (sin alias)
--       lastInventory y previousCreditBalance
--
-- lastInventoryCreationDate ya filtra `status_id in (55,57)` y no se toca.
-- #############################################################################
DELETE FROM public.sql_queries WHERE "path" = '/getNewStoreCashClosingV8';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getNewStoreCashClosingV8','/getNewStoreCashClosingV8',
       regexp_replace(
         regexp_replace(consulta_sql,
           'from\s+cash_closing\s+cc1\s+where\s+cc1\.establishment_id\s*=\s*e\.id',
           'from cash_closing cc1 where cc1.status_id <> 56 and cc1.establishment_id = e.id', 'gi'),
         'from\s+cash_closing\s+where\s+establishment_id\s*=\s*e\.id',
         'from cash_closing where status_id <> 56 and establishment_id = e.id', 'gi'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getNewStoreCashClosingV7';


-- #############################################################################
-- PASO 5 — /listStoreCashClosingV2 (listado de cierres de una tienda)
--
-- La V1 solo devuelve status.identifier, así que el front no puede distinguir un
-- cierre eliminado del resto. La V2 agrega status.id. NO se agrega un WHERE
-- propio: el backend inyecta el filtro de tienda (cc.establishment_id) desde los
-- parámetros y no conviene arriesgar un conflicto; el front descarta el 56.
--
-- Si la lectura viva ya trae status.id se copia tal cual.
-- #############################################################################
DELETE FROM public.sql_queries WHERE "path" = '/listStoreCashClosingV2';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'listStoreCashClosingV2','/listStoreCashClosingV2',
       CASE WHEN consulta_sql ~* '''id''\s*,\s*s\.id'
            THEN consulta_sql
            ELSE regexp_replace(consulta_sql,
                   '(''status''\s*,\s*json_build_object\()',
                   '\1''id'', s.id, ', 'i')
       END,
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/listStoreCashClosing';


-- #############################################################################
-- PASO 6 — GUARDIA
--
-- Las cuatro filas nuevas existen (una sola cada una), y las dos lecturas
-- derivadas quedaron como se espera:
--   * getNewStoreCashClosingV8: TODA lectura de cash_closing quedó filtrada por
--     el 56 (o por `in (55,57)`, que ya lo excluye).
--   * listStoreCashClosingV2: devuelve s.id.
--
-- Esto atrapa que un replace() no haya encontrado su ancla (la query quedaría
-- igual a la V7 y el bug seguiría ahí sin avisar). La VERIFICACIÓN del final
-- sigue siendo obligatoria: es la que ejecuta las queries de verdad.
-- #############################################################################
DO $do$
DECLARE
    _n int;
    _sql text;
    _lecturas int;
    _filtradas int;
BEGIN
    SELECT count(*) INTO _n FROM public.sql_queries
     WHERE "path" IN ('/deleteStoreCashClosingV2','/addStoreCashClosingV7',
                      '/getNewStoreCashClosingV8','/listStoreCashClosingV2');
    IF _n <> 4 THEN
        RAISE EXCEPTION 'Se esperaban 4 endpoints nuevos y hay %. Algún ancla de los PASOS 4 o 5 no coincidió; revisar el PASO 0.d', _n;
    END IF;

    SELECT consulta_sql INTO _sql FROM public.sql_queries WHERE "path" = '/getNewStoreCashClosingV8';
    SELECT count(*) INTO _lecturas  FROM regexp_matches(_sql, 'from\s+cash_closing', 'gi');
    SELECT count(*) INTO _filtradas FROM regexp_matches(_sql,
        'status_id\s*(?:<>|!=)\s*56|status_id\s+in\s*\(\s*55\s*,\s*57\s*\)', 'gi');
    IF _lecturas = 0 OR _lecturas <> _filtradas THEN
        RAISE EXCEPTION 'getNewStoreCashClosingV8: % lecturas de cash_closing y % filtradas. Revisar el PASO 4 y el 0.e', _lecturas, _filtradas;
    END IF;

    SELECT consulta_sql INTO _sql FROM public.sql_queries WHERE "path" = '/listStoreCashClosingV2';
    IF _sql !~* '''id''\s*,\s*s\.id' THEN
        RAISE EXCEPTION 'listStoreCashClosingV2 no devuelve status.id; revisar el PASO 5';
    END IF;

    RAISE NOTICE 'PASO 6 OK: 4 endpoints nuevos, lecturas de la vista previa filtradas';
END
$do$;

COMMIT;


-- #############################################################################
-- VERIFICACIÓN — CORRER TODO ESTO ANTES DE DESPLEGAR EL FRONT
-- #############################################################################
--
-- (a) La procedure v7 existe y las dos lecturas llevan el filtro
-- SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname = 'register_cash_closing_v7';
--   -> buscar "cc0.status_id <> 56" y "cc_prev.status_id <> 56".
--
-- (b) Las tres queries nuevas son distintas de las que clonan
-- SELECT a."path", a.consulta_sql = b.consulta_sql AS igual_que_la_anterior
--   FROM sql_queries a JOIN sql_queries b
--     ON (a."path", b."path") IN (('/getNewStoreCashClosingV8','/getNewStoreCashClosingV7'),
--                                 ('/listStoreCashClosingV2','/listStoreCashClosing'));
--   -> igual_que_la_anterior debe ser false en las dos.
--
-- (c) La vista previa V8 se ejecuta. Correr su consulta_sql con $1 = id de una tienda
--     de prueba y comprobar que lastInventoryCreationDate / lastInventory /
--     previousCreditBalance coinciden con el último cierre NO eliminado.
--     SELECT consulta_sql FROM sql_queries WHERE "path" = '/getNewStoreCashClosingV8';
--
-- (d) Prueba de la eliminación lógica en una tienda de prueba (con un cierre B ya creado):
--     UPDATE ... equivalente a /deleteStoreCashClosingV2:
--       update cash_closing set status_id = 56,
--              updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
--        where id = '<id de B>'::uuid and status_id in (55, 57);   -- 1 fila
--     Repetirlo: 0 filas (ya estaba en 56).
--     SELECT id, status_id, updated_date FROM cash_closing WHERE id = '<id de B>';
--       -> la fila SIGUE existiendo con status_id = 56.
--     Después correr (c): el "último cierre" tiene que ser el anterior a B, no B.
--
-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- Las filas y la procedure nuevas se borran sin tocar nada de lo anterior:
--
-- DELETE FROM public.sql_queries
--  WHERE "path" IN ('/deleteStoreCashClosingV2','/addStoreCashClosingV7',
--                   '/getNewStoreCashClosingV8','/listStoreCashClosingV2');
-- DROP PROCEDURE IF EXISTS public.register_cash_closing_v7(text,uuid,uuid,numeric);
--
-- Los cierres que ya se hayan eliminado con la V2 quedan en status 56 (no se
-- borran). Para dejar uno activo otra vez, si el cierre no era uno verificado:
--   update cash_closing set status_id = 55 where id = '<id>'::uuid;
-- y si lo era, status_id = 57. Antes de revertir, mirar si el cierre eliminado
-- tuvo cierres posteriores: en ese caso devolverlo a 55/57 reabre un período
-- que ya se cerró encima.
