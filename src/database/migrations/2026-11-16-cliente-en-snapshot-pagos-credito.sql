-- =============================================================================
-- Migración: nombre y NIT del cliente en el snapshot de "Pagos de Crédito"
-- Fecha: 2026-11-16
-- Ejecución: MANUAL. Correr en el Postgres de producción ANTES de publicar el front.
--
-- =============================================================================
-- EL PROBLEMA
-- =============================================================================
--
-- En el detalle de un cierre de caja (view-cash-closing), la sección "Pagos de
-- Crédito" muestra Cliente y NIT vacíos en todos los cierres guardados desde el
-- 2026-09-22.
--
-- Desde migration_shop_sale_customer.sql, una venta con cliente registrado guarda
-- customer_id y deja shop_sale.name_client / nit_client en NULL; el nombre y el
-- NIT se resuelven con shop_sale_client_name(ss.*) / shop_sale_client_nit(ss.*).
-- Toda venta al crédito exige cliente registrado, así que todo abono de crédito
-- cae en ese caso.
--
-- register_cash_closing_v6 (2026-09-22) agregó el snapshot cash_closing.credit_payments
-- con texto nuevo que lee las columnas directamente, con el alias ss6:
--     ''nameClient'', ss6.name_client,
--     ''nitClient'',  ss6.nit_client,
-- La v7 (2026-10-25) se derivó de la v6 y lo heredó. /getStoreCashClosingV8 usa
-- COALESCE(cc.credit_payments, <en vivo>): con snapshot, nunca corre la lectura en
-- vivo (que sí usa las funciones), y el front recibe nameClient/nitClient = null.
--
-- El front y /getStoreCashClosingV8 están bien: el dato se guarda vacío.
--
-- =============================================================================
-- ENFOQUE ADITIVO
-- =============================================================================
--
--   register_cash_closing_v7  -> register_cash_closing_v8   (lee con las funciones)
--   /addStoreCashClosingV7    -> /addStoreCashClosingV8
--
-- La v7 y /addStoreCashClosingV7 NO se tocan: el front actual sigue funcionando
-- (y sigue guardando null) hasta que se publique el front nuevo.
--
-- Además, el PASO 3 completa nameClient / nitClient en los snapshots ya guardados.
-- Solo rellena esas dos claves cuando están en null; montos, fechas, tipo de pago,
-- banco, referencia y orden de los abonos quedan iguales. Antes copia el
-- credit_payments original de cada cierre tocado a una tabla de respaldo.
--
-- El script corre en UNA transacción. Si alguna guardia revienta, el COMMIT del
-- final se convierte en rollback y no queda nada a medias.
-- =============================================================================

BEGIN;

-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL (solo lectura)
-- #############################################################################

-- 0.a Las funciones de resolución existen.
-- SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname IN ('shop_sale_client_name','shop_sale_client_nit');

-- 0.b La v7 tiene las dos lecturas directas que se corrigen.
-- SELECT position('ss6.name_client' in pg_get_functiondef(p.oid)) > 0 AS tiene_name,
--        position('ss6.nit_client'  in pg_get_functiondef(p.oid)) > 0 AS tiene_nit
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname = 'register_cash_closing_v7';

-- 0.c Cuántos cierres tienen algún abono sin nombre o sin NIT (los que corrige el PASO 3).
-- SELECT count(*) FROM cash_closing cc
--  WHERE jsonb_typeof(cc.credit_payments) = 'array'
--    AND EXISTS (SELECT 1 FROM jsonb_array_elements(cc.credit_payments) p
--                 WHERE p->'shopSale'->>'nameClient' IS NULL
--                    OR p->'shopSale'->>'nitClient'  IS NULL);

-- 0.d Guardia ejecutable: las dos funciones tienen que existir.
DO $do$
BEGIN
    IF to_regprocedure('public.shop_sale_client_name(shop_sale)') IS NULL
       OR to_regprocedure('public.shop_sale_client_nit(shop_sale)') IS NULL THEN
        RAISE EXCEPTION 'No existen shop_sale_client_name / shop_sale_client_nit; revisar el PASO 0.a (migration_shop_sale_customer.sql)';
    END IF;
END
$do$;


-- #############################################################################
-- PASO 1 — PROCEDURE register_cash_closing_v8
--
-- Se DERIVA del código vivo de la v7, igual que las migraciones del 22-sep y del
-- 25-oct, para no pegar ~280 líneas que podrían diferir de lo que hay en la base.
-- Único cambio: el snapshot de credit_payments resuelve nombre y NIT con las
-- funciones, que buscan primero en customer y caen a las columnas de shop_sale
-- (ventas viejas sin cliente registrado).
--
-- La guardia exige que no quede NINGUNA lectura directa de name_client /
-- nit_client con cualquier alias: si la v7 tuviera otra que no conocemos,
-- revienta en vez de dejarla.
--
-- Sin guardia de "ya existe": la v8 se deriva siempre de la v7, que no se toca,
-- así que correr esto dos veces produce la misma procedure.
-- #############################################################################
DO $do$
DECLARE
    _src text;
BEGIN
    SELECT pg_get_functiondef(p.oid) INTO _src
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'register_cash_closing_v7';

    IF _src IS NULL THEN
        RAISE EXCEPTION 'No se encontró register_cash_closing_v7 en la base de datos';
    END IF;

    IF position('ss6.name_client' in _src) = 0 OR position('ss6.nit_client' in _src) = 0 THEN
        RAISE EXCEPTION 'register_cash_closing_v7 no tiene las lecturas ss6.name_client / ss6.nit_client esperadas; revisar el PASO 0.b';
    END IF;

    _src := replace(_src, 'register_cash_closing_v7', 'register_cash_closing_v8');
    _src := replace(_src, 'ss6.name_client', 'shop_sale_client_name(ss6.*)');
    _src := replace(_src, 'ss6.nit_client',  'shop_sale_client_nit(ss6.*)');

    IF _src ~* '\w\.(name_client|nit_client)\M' THEN
        RAISE EXCEPTION 'register_cash_closing_v8 todavía lee name_client / nit_client directo en otra parte; revisar la v7 antes de seguir';
    END IF;

    EXECUTE _src;
    RAISE NOTICE 'register_cash_closing_v8 creada';
END
$do$;


-- #############################################################################
-- PASO 2 — /addStoreCashClosingV8 -> register_cash_closing_v8
-- Misma firma que la V7.
--
-- El DELETE previo lo hace idempotente: sql_queries no tiene unique en "path" y
-- una fila duplicada haría que el router resuelva de forma no determinista.
-- #############################################################################
DELETE FROM public.sql_queries WHERE "path" = '/addStoreCashClosingV8';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('addStoreCashClosingV8','/addStoreCashClosingV8','call register_cash_closing_v8($1, $2::uuid, $3::uuid, $4::numeric)','cash_closing','PATCH');


-- #############################################################################
-- PASO 3 — COMPLETAR LOS SNAPSHOTS YA GUARDADOS
--
-- 3.a Respaldo: el credit_payments original de cada cierre que se va a tocar.
--     ON CONFLICT DO NOTHING: si el script se corre otra vez, el respaldo
--     conserva el valor ORIGINAL, no el ya corregido.
-- 3.b Por cada abono del arreglo: si nameClient o nitClient está en null, se
--     completa con las funciones buscando la venta por shopSale.id. Lo que ya
--     traía valor se deja como está. WITH ORDINALITY conserva el orden.
--     Si la venta no existe (LEFT JOIN sin match), las funciones devuelven null
--     y el abono queda como estaba.
-- #############################################################################
CREATE TABLE IF NOT EXISTS public.cash_closing_credit_payments_bkp_20261116 (
    id              uuid PRIMARY KEY,
    credit_payments jsonb,
    backed_up_at    timestamp NOT NULL DEFAULT timezone('UTC'::text, CURRENT_TIMESTAMP)
);

-- 3.a
INSERT INTO public.cash_closing_credit_payments_bkp_20261116 (id, credit_payments)
SELECT cc.id, cc.credit_payments
  FROM cash_closing cc
 WHERE jsonb_typeof(cc.credit_payments) = 'array'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(cc.credit_payments) p
                WHERE p->'shopSale'->>'nameClient' IS NULL
                   OR p->'shopSale'->>'nitClient'  IS NULL)
ON CONFLICT (id) DO NOTHING;

-- 3.b
UPDATE cash_closing cc
   SET credit_payments = (
        SELECT jsonb_agg(
                 CASE
                   WHEN jsonb_typeof(t.p->'shopSale') = 'object'
                    AND (t.p->'shopSale'->>'nameClient' IS NULL OR t.p->'shopSale'->>'nitClient' IS NULL)
                   THEN jsonb_set(t.p, '{shopSale}',
                          (t.p->'shopSale') || jsonb_build_object(
                              'nameClient', COALESCE(t.p->'shopSale'->>'nameClient', shop_sale_client_name(ss.*)),
                              'nitClient',  COALESCE(t.p->'shopSale'->>'nitClient',  shop_sale_client_nit(ss.*))))
                   ELSE t.p
                 END
                 ORDER BY t.ord)
          FROM jsonb_array_elements(cc.credit_payments) WITH ORDINALITY AS t(p, ord)
          LEFT JOIN shop_sale ss ON ss.id = (t.p->'shopSale'->>'id')::uuid
       )
 WHERE jsonb_typeof(cc.credit_payments) = 'array'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(cc.credit_payments) p
                WHERE p->'shopSale'->>'nameClient' IS NULL
                   OR p->'shopSale'->>'nitClient'  IS NULL);


-- #############################################################################
-- PASO 4 — GUARDIAS
--
--   * El endpoint nuevo existe una sola vez.
--   * No queda ningún abono en un snapshot con nombre/NIT en null cuando la
--     venta SÍ tiene nombre/NIT para mostrar (eso sería un fallo del PASO 3).
--     Los que siguen en null sin forma de resolverse (venta inexistente) se
--     informan con NOTICE, no abortan.
-- #############################################################################
DO $do$
DECLARE
    _n int;
    _sin_resolver int;
BEGIN
    SELECT count(*) INTO _n FROM public.sql_queries WHERE "path" = '/addStoreCashClosingV8';
    IF _n <> 1 THEN
        RAISE EXCEPTION 'Se esperaba 1 fila /addStoreCashClosingV8 y hay %', _n;
    END IF;

    SELECT count(*) INTO _n
      FROM cash_closing cc
      CROSS JOIN LATERAL jsonb_array_elements(cc.credit_payments) p
      JOIN shop_sale ss ON ss.id = (p->'shopSale'->>'id')::uuid
     WHERE jsonb_typeof(cc.credit_payments) = 'array'
       AND ((p->'shopSale'->>'nameClient' IS NULL AND shop_sale_client_name(ss.*) IS NOT NULL)
         OR (p->'shopSale'->>'nitClient'  IS NULL AND shop_sale_client_nit(ss.*)  IS NOT NULL));
    IF _n > 0 THEN
        RAISE EXCEPTION 'Quedaron % abonos con nombre/NIT en null que sí se podían resolver; revisar el PASO 3', _n;
    END IF;

    SELECT count(*) INTO _sin_resolver
      FROM cash_closing cc
      CROSS JOIN LATERAL jsonb_array_elements(cc.credit_payments) p
     WHERE jsonb_typeof(cc.credit_payments) = 'array'
       AND (p->'shopSale'->>'nameClient' IS NULL OR p->'shopSale'->>'nitClient' IS NULL);

    SELECT count(*) INTO _n FROM public.cash_closing_credit_payments_bkp_20261116;
    RAISE NOTICE 'PASO 4 OK: % cierres respaldados; % abonos siguen sin nombre/NIT (sin venta o sin datos para resolver)', _n, _sin_resolver;
END
$do$;

COMMIT;


-- #############################################################################
-- VERIFICACIÓN — CORRER TODO ESTO ANTES DE DESPLEGAR EL FRONT
-- #############################################################################
--
-- (a) La v8 existe y usa las funciones en el snapshot.
-- SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname = 'register_cash_closing_v8';
--   -> buscar "shop_sale_client_name(ss6.*)" y "shop_sale_client_nit(ss6.*)".
--
-- (b) Un cierre corregido: comparar el snapshot contra el respaldo.
-- SELECT b.credit_payments -> 0 -> 'shopSale' AS antes,
--        cc.credit_payments -> 0 -> 'shopSale' AS despues
--   FROM cash_closing_credit_payments_bkp_20261116 b
--   JOIN cash_closing cc ON cc.id = b.id
--  LIMIT 5;
--   -> en "despues" nameClient y nitClient con valor; el resto de claves igual.
--
-- (c) Montos intactos: el total de abonos por cierre no cambió.
-- SELECT b.id,
--        (SELECT sum((x->>'amount')::numeric) FROM jsonb_array_elements(b.credit_payments) x)  AS antes,
--        (SELECT sum((x->>'amount')::numeric) FROM jsonb_array_elements(cc.credit_payments) x) AS despues
--   FROM cash_closing_credit_payments_bkp_20261116 b
--   JOIN cash_closing cc ON cc.id = b.id
--  WHERE (SELECT sum((x->>'amount')::numeric) FROM jsonb_array_elements(b.credit_payments) x)
--     IS DISTINCT FROM
--        (SELECT sum((x->>'amount')::numeric) FROM jsonb_array_elements(cc.credit_payments) x);
--   -> 0 filas.
--
-- (d) Abrir en el front un cierre posterior al 2026-09-22: en "Pagos de Crédito"
--     se ven Cliente y NIT.
--
-- (e) Después de publicar el front, crear un cierre en una tienda de prueba y
--     revisar que su snapshot ya trae nameClient / nitClient:
-- SELECT jsonb_path_query(credit_payments, '$[*].shopSale') FROM cash_closing WHERE id = '<id>';
--
-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- Snapshots:
-- UPDATE cash_closing cc SET credit_payments = b.credit_payments
--   FROM cash_closing_credit_payments_bkp_20261116 b
--  WHERE b.id = cc.id;
--
-- Endpoint y procedure (no tocan nada de lo anterior):
-- DELETE FROM public.sql_queries WHERE "path" = '/addStoreCashClosingV8';
-- DROP PROCEDURE IF EXISTS public.register_cash_closing_v8(text,uuid,uuid,numeric);
--
-- Ojo: si entre el despliegue del front y el rollback se guardaron cierres con la
-- V8, esos no están en el respaldo; con la V8 ya traen nombre y NIT correctos.
--
-- Una vez verificado en producción, la tabla de respaldo se puede borrar:
-- DROP TABLE public.cash_closing_credit_payments_bkp_20261116;
