-- ============================================================
-- Migration: cliente registrado en las ventas de tienda (shop_sale)
--
-- 1) shop_sale.customer_id -> FK a customer. Es la ÚNICA fuente de verdad
--    cuando la venta es de un cliente registrado; en ese caso name_client y
--    nit_client quedan en NULL. Siguen usándose solo para clientes escritos
--    a mano (ventas que no son al crédito).
-- 2) Dos funciones resuelven el nombre/NIT a mostrar en un solo lugar:
--    shop_sale_client_name(ss.*) / shop_sale_client_nit(ss.*)
-- 3) Se versionan (sin tocar las versiones anteriores):
--      register_shop_sale_with_elements_v3 -> _v4   (/registerShopV4)
--      register_cash_closing_v4            -> _v5   (/addStoreCashClosingV5)
--      /listShopSaleV2            -> /listShopSaleV3
--      /getShopSaleV2             -> /getShopSaleV3
--      /UpdateShopHistory         -> /UpdateShopHistoryV2
--      /getNewStoreCashClosing    -> /getNewStoreCashClosingV2
--      /retrieveStoreCashClosing  -> /retrieveStoreCashClosingV3
--      /getStoreCashClosingV2     -> /getStoreCashClosingV3
-- 4) Regla de negocio: una venta al crédito (pedido o envío) NO puede
--    guardarse sin customer_id. Se valida en el front y en el procedimiento.
--
-- Requiere que customer.sql ya se haya ejecutado.
-- Idempotente: se puede correr más de una vez sin duplicar efectos.
-- ============================================================


-- ── 1. Columna + FK ─────────────────────────────────────────
ALTER TABLE shop_sale ADD COLUMN IF NOT EXISTS customer_id uuid NULL;

ALTER TABLE shop_sale DROP CONSTRAINT IF EXISTS shop_sale_fk_customer_id;
ALTER TABLE shop_sale
    ADD CONSTRAINT shop_sale_fk_customer_id FOREIGN KEY (customer_id) REFERENCES customer(id);

CREATE INDEX IF NOT EXISTS idx_shop_sale_customer ON shop_sale(customer_id);

-- Con cliente registrado, name_client va NULL: hay que soltar el NOT NULL.
ALTER TABLE shop_sale ALTER COLUMN name_client DROP NOT NULL;


-- ── 2. Resolución del cliente a mostrar ─────────────────────
-- Toda query que necesite el nombre/NIT del cliente debe usar estas
-- funciones en lugar de leer las columnas directamente.

CREATE OR REPLACE FUNCTION public.shop_sale_client_name(_ss shop_sale)
RETURNS varchar
LANGUAGE sql
STABLE
AS $function$
    SELECT COALESCE(
        (SELECT cu."name" FROM customer cu WHERE cu.id = _ss.customer_id),
        _ss.name_client
    );
$function$;

CREATE OR REPLACE FUNCTION public.shop_sale_client_nit(_ss shop_sale)
RETURNS varchar
LANGUAGE sql
STABLE
AS $function$
    SELECT COALESCE(
        (SELECT cu.nit FROM customer cu WHERE cu.id = _ss.customer_id),
        _ss.nit_client
    );
$function$;


-- ── 3. register_shop_sale_with_elements_v4 ──────────────────
-- Igual que v3 más:
--   * guarda customer_id (leído de _sale_properties->'customer'->>'id')
--   * name_client / nit_client van NULL cuando hay cliente registrado
--   * rechaza ventas al crédito (pedido o envío) sin cliente registrado

CREATE OR REPLACE PROCEDURE public.register_shop_sale_with_elements_v4(
    IN _sale_properties jsonb,
    IN _sale_elements jsonb,
    IN _creator_user_id uuid
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
    _new_ss_id uuid;
    _status_id INT := 52;
    _item JSONB;
    _establishment_id uuid;
    _customer_id uuid;
    _price NUMERIC;
    _subtotal NUMERIC;
    _total NUMERIC;
    _total_discount NUMERIC;
    _delivery NUMERIC;
    _order_amount NUMERIC;
    _product_for_sale_id UUID;
    _quantity NUMERIC;
    _measure_id INT;
    _discount NUMERIC;
    _payment_type_id INT;
    _delivery_payment_type_id INT;
    _payment_type_identifier VARCHAR;
    _delivery_payment_identifier VARCHAR;
    _paid_amount NUMERIC(10,2);
    _pending_amount NUMERIC(10,2);
    _payment_status_id INT;
    _delivery_paid_amount NUMERIC(10,2);
    _delivery_pending_amount NUMERIC(10,2);
    _delivery_payment_status_id INT;
    _paid_status_id INT := 5;
    _pending_status_id INT := 3;
BEGIN
    BEGIN
        _establishment_id := (_sale_properties -> 'establishment' ->> 'id')::UUID;
        _customer_id := NULLIF(_sale_properties -> 'customer' ->> 'id', '')::UUID;
        _total := ROUND((_sale_properties->>'total')::NUMERIC, 2);
        _total_discount := ROUND((_sale_properties->>'totalDiscount')::NUMERIC, 2);
        _delivery := ROUND(COALESCE((_sale_properties->>'delivery')::NUMERIC, 0), 2);
        _order_amount := ROUND(_total - _delivery, 2);

        _payment_type_id := (_sale_properties->'paymentType'->>'id')::INT;
        _delivery_payment_type_id := (_sale_properties->'deliveryPaymentType'->>'id')::INT;

        SELECT pt."name" INTO _payment_type_identifier FROM payment_type pt WHERE pt.id = _payment_type_id;
        SELECT pt."name" INTO _delivery_payment_identifier FROM payment_type pt WHERE pt.id = _delivery_payment_type_id;

        -- Una venta al crédito exige cliente registrado
        IF _customer_id IS NULL
           AND (_payment_type_identifier = 'Crédito'
                OR (_delivery_payment_identifier = 'Crédito' AND _delivery > 0)) THEN
            RAISE EXCEPTION 'Una venta al crédito requiere un cliente registrado.';
        END IF;

        -- Crédito del pedido (subtotal)
        IF _payment_type_identifier = 'Crédito' THEN
            _payment_status_id := _pending_status_id;
            _paid_amount := 0;
            _pending_amount := _order_amount;
        ELSE
            _payment_status_id := _paid_status_id;
            _paid_amount := _order_amount;
            _pending_amount := 0;
        END IF;

        -- Crédito del envío
        IF _delivery_payment_identifier = 'Crédito' THEN
            _delivery_payment_status_id := _pending_status_id;
            _delivery_paid_amount := 0;
            _delivery_pending_amount := _delivery;
        ELSE
            _delivery_payment_status_id := _paid_status_id;
            _delivery_paid_amount := _delivery;
            _delivery_pending_amount := 0;
        END IF;

        INSERT INTO public.shop_sale(
            name_client,
            nota,
            delivery,
            nit_client,
            customer_id,
            establishment_id,
            status_id,
            total,
            total_discount,
            payment_type_id,
            creator_user_id,
            paid_amount,
            pending_amount,
            payment_status_id,
            delivery_payment_type_id,
            delivery_paid_amount,
            delivery_pending_amount,
            delivery_payment_status_id
        )
        VALUES (
            CASE WHEN _customer_id IS NULL
                 THEN NULLIF(_sale_properties->>'nameClient', '')
                 ELSE NULL END,
            _sale_properties->>'nota',
            _delivery,
            CASE WHEN _customer_id IS NULL
                 THEN NULLIF(_sale_properties->>'nitClient', '')::VARCHAR(10)
                 ELSE NULL END,
            _customer_id,
            _establishment_id,
            _status_id,
            _total,
            _total_discount,
            _payment_type_id,
            _creator_user_id,
            _paid_amount,
            _pending_amount,
            _payment_status_id,
            _delivery_payment_type_id,
            _delivery_paid_amount,
            _delivery_pending_amount,
            _delivery_payment_status_id
        )
        RETURNING id INTO _new_ss_id;

        FOR _item IN SELECT * FROM jsonb_array_elements(_sale_elements)
        LOOP
            _price := (_item->>'price')::NUMERIC;
            _subtotal := ROUND((_item->>'subtotal')::NUMERIC, 2);
            _total := ROUND((_item->>'total')::NUMERIC, 2);
            _total_discount := ROUND((_item->>'totalDiscount')::NUMERIC, 2);
            _product_for_sale_id := (_item -> 'productForSale' ->> 'id')::UUID;
            _quantity := ROUND((_item ->> 'quantity')::NUMERIC, 2);
            _measure_id := (_item -> 'measure' ->> 'id')::INT;
            _discount := ROUND((_item->>'discount')::NUMERIC, 2);

            CALL add_remove_inventory_element(
                'product_for_sale',
                _establishment_id::text,
                _product_for_sale_id,
                _measure_id,
                _quantity,
                _creator_user_id,
                'Venta de producto en tienda',
                14);

            INSERT INTO public.shop_sale_element(
                shop_sale_id,
                product_for_sale_id,
                price,
                subtotal,
                total,
                discount,
                total_discount,
                quantity,
                measure_id)
            VALUES(
                _new_ss_id,
                _product_for_sale_id,
                _price,
                _subtotal,
                _total,
                _discount,
                _total_discount,
                _quantity,
                _measure_id);
        END LOOP;

    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en registro de venta v4: %', SQLERRM;
    END;
END;
$procedure$;


-- ── 4. register_cash_closing_v5 ─────────────────────────────
-- El snapshot jsonb del cierre debe congelar el nombre del cliente ya
-- resuelto. v5 se deriva del código VIVO de v4 sustituyendo únicamente las
-- dos lecturas de columna, para no forkear 285 líneas que podrían diferir
-- de lo que hay en la base.

DO $do$
DECLARE
    _src text;
BEGIN
    IF to_regprocedure('public.register_cash_closing_v5(text,uuid,uuid,numeric)') IS NULL THEN
        SELECT pg_get_functiondef(p.oid) INTO _src
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'register_cash_closing_v4';

        IF _src IS NULL THEN
            RAISE EXCEPTION 'No se encontró register_cash_closing_v4 en la base de datos';
        END IF;

        _src := replace(_src, 'register_cash_closing_v4', 'register_cash_closing_v5');
        _src := replace(_src, 'ss.name_client', 'shop_sale_client_name(ss.*)');
        _src := replace(_src, 'ss.nit_client',  'shop_sale_client_nit(ss.*)');

        EXECUTE _src;
    END IF;
END
$do$;


-- ── 5. Endpoints nuevos ─────────────────────────────────────
-- Las queries de lectura se derivan de la fila viva de la versión anterior
-- sustituyendo ss.name_client / ss.nit_client por las funciones. Así heredan
-- cualquier cambio aplicado por migrations previos (saleNumber, delivery,
-- colores de estado) sin tener que reescribir el texto completo.

-- registerShopV4
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'registerShopV4','/registerShopV4',
       'call register_shop_sale_with_elements_v4($1,$2,$3::uuid)','shop_sale','PATCH'
WHERE NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/registerShopV4');

-- addStoreCashClosingV5
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'addStoreCashClosingV5','/addStoreCashClosingV5',
       'call register_cash_closing_v5($1, $2::uuid, $3::uuid, $4::numeric)','cash_closing','PATCH'
WHERE NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/addStoreCashClosingV5');

-- UpdateShopHistoryV2
-- El cliente registrado NO se puede modificar desde la edición de la venta:
-- name_client / nit_client solo se tocan si la venta es de cliente manual.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'UpdateShopHistoryV2','/UpdateShopHistoryV2',
'update shop_sale
set name_client = CASE WHEN customer_id IS NULL THEN $1 ELSE name_client END,
    nit_client = CASE WHEN customer_id IS NULL THEN $2 ELSE nit_client END,
    nota = $3,
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $4','shop_sale','PATCH'
WHERE NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/UpdateShopHistoryV2');

-- listShopSaleV3
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'listShopSaleV3','/listShopSaleV3',
       replace(replace(consulta_sql,
           'ss.name_client', 'shop_sale_client_name(ss.*)'),
           'ss.nit_client',  'shop_sale_client_nit(ss.*)'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/listShopSaleV2'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/listShopSaleV3');

-- getShopSaleV3 (además expone el objeto customer para la vista de edición)
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getShopSaleV3','/getShopSaleV3',
       replace(replace(replace(consulta_sql,
           'ss.name_client', 'shop_sale_client_name(ss.*)'),
           'ss.nit_client',  'shop_sale_client_nit(ss.*)'),
           '''id'', ss.id,',
           '''id'', ss.id,
    ''customer'', (SELECT json_build_object(
        ''id'', cu.id,
        ''name'', cu."name",
        ''nit'', cu.nit,
        ''phone'', cu.phone,
        ''email'', cu.email
    ) FROM customer cu WHERE cu.id = ss.customer_id),'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getShopSaleV2'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/getShopSaleV3');

-- getNewStoreCashClosingV2
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getNewStoreCashClosingV2','/getNewStoreCashClosingV2',
       replace(replace(consulta_sql,
           'ss.name_client', 'shop_sale_client_name(ss.*)'),
           'ss.nit_client',  'shop_sale_client_nit(ss.*)'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getNewStoreCashClosing'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/getNewStoreCashClosingV2');

-- retrieveStoreCashClosingV3
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'retrieveStoreCashClosingV3','/retrieveStoreCashClosingV3',
       replace(replace(consulta_sql,
           'ss.name_client', 'shop_sale_client_name(ss.*)'),
           'ss.nit_client',  'shop_sale_client_nit(ss.*)'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/retrieveStoreCashClosing'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/retrieveStoreCashClosingV3');

-- getStoreCashClosingV3
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getStoreCashClosingV3','/getStoreCashClosingV3',
       replace(replace(consulta_sql,
           'ss.name_client', 'shop_sale_client_name(ss.*)'),
           'ss.nit_client',  'shop_sale_client_nit(ss.*)'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getStoreCashClosingV2'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/getStoreCashClosingV3');


-- ── 6. Verificación ─────────────────────────────────────────
-- SELECT "path" FROM public.sql_queries
--  WHERE "path" IN ('/registerShopV4','/addStoreCashClosingV5','/UpdateShopHistoryV2',
--                   '/listShopSaleV3','/getShopSaleV3','/getNewStoreCashClosingV2',
--                   '/retrieveStoreCashClosingV3','/getStoreCashClosingV3');
--
-- Ninguna de las nuevas debe conservar lecturas directas de las columnas:
-- SELECT "path" FROM public.sql_queries
--  WHERE "path" LIKE '%V3' AND (consulta_sql LIKE '%ss.name_client%' OR consulta_sql LIKE '%ss.nit_client%');
