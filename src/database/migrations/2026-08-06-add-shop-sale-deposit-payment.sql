-- =============================================================================
-- Migración: comentario y fecha en las ventas pagadas con Depósito
-- Fecha: 2026-08-06
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Objetivo: hoy solo los abonos de una venta al crédito guardan comentario y
-- fecha (ver 2026-08-02-add-shop-sale-payment-comment.sql). Una venta pagada
-- con Depósito nace pagada y no deja ningún rastro del depósito: ni la boleta,
-- ni el banco, ni cuándo se hizo realmente la transferencia.
--
-- Ahora, al registrar la venta con Depósito, el usuario puede escribir un
-- comentario y elegir la fecha/hora del depósito. Se reutiliza la tabla
-- shop_sale_payment: el pago queda registrado en el momento de la venta en
-- lugar de esperar a un abono posterior.
--
-- REGLA (la aplica también el front):
--   * comentario vacío  -> NO se inserta ningún shop_sale_payment. La venta se
--                          guarda exactamente igual que hoy.
--   * comentario lleno  -> se inserta un shop_sale_payment por el monto
--                          completo, con el comentario y la fecha indicada
--                          (por defecto, el now() en UTC).
--
-- IMPORTANTE — POR QUÉ HAY UNA COLUMNA NUEVA `is_sale_payment`:
-- El bloque `creditPayments` del cierre de caja lee TODAS las filas de
-- shop_sale_payment del período, sin filtrar. Si el depósito de una venta
-- entrara ahí, el cierre contaría el mismo dinero dos veces: una como venta
-- con depósito (`totalDepositSales`, desde shopResumes) y otra como cobro de
-- crédito (`totalCreditPaymentsDeposit`), y además ensuciaría el saldo de
-- crédito (`newCreditBalance`). La columna marca estas filas como "pago hecho
-- al registrar la venta" y las tres queries del cierre las excluyen.
--
-- Enfoque 100% aditivo: NO modifica ninguna query/procedure en uso.
--   * Columna `is_sale_payment` con DEFAULT false -> los abonos ya registrados
--     siguen siendo abonos y ninguna query anterior cambia de comportamiento.
--   * Procedure nueva register_shop_sale_with_elements_v5 (la v4 queda intacta).
--   * Endpoints nuevos; los anteriores quedan vivos.
--
-- ORDEN DE EJECUCIÓN (una sola corrida, ANTES de desplegar el front nuevo):
--   PASO 1 -> ALTER: columna is_sale_payment
--   PASO 2 -> Procedure register_shop_sale_with_elements_v5
--   PASO 3 -> /registerShopV5 y /getShopSalePaymentsV4
--   PASO 4 -> Queries del cierre de caja que excluyen el pago de la venta
-- =============================================================================


-- #############################################################################
-- PASO 1 — ALTER: marca el pago hecho en el momento de la venta.
--          NOT NULL con DEFAULT false: en PG11+ es un cambio de metadata, no
--          reescribe la tabla. Todas las filas existentes son abonos (false).
-- #############################################################################
ALTER TABLE shop_sale_payment
    ADD COLUMN IF NOT EXISTS is_sale_payment boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN shop_sale_payment.is_sale_payment IS
    'true = pago registrado al momento de la venta (depósito). No es un abono de crédito y el cierre de caja lo excluye de creditPayments.';


-- #############################################################################
-- PASO 2 — PROCEDURE register_shop_sale_with_elements_v5
--
--          Clon de register_shop_sale_with_elements_v4 más el registro del
--          depósito. Lo único que se agrega es el bloque marcado como
--          "── Depósito ──" justo después del INSERT de shop_sale.
--
--          El shop_sale_payment que se inserta aquí es SOLO informativo: la
--          venta con Depósito ya nace con paid_amount completo y estado
--          Pagado, así que NO se recalculan montos ni estados (por eso se
--          inserta directo y no se llama a add_shop_sale_payment_v3, que
--          sumaría de nuevo al paid_amount y reventaría por monto excedido).
--
--          Campos que espera en _sale_properties (todos opcionales):
--            depositComment / depositDate                 -> pago del pedido
--            deliveryDepositComment / deliveryDepositDate  -> pago del envío
-- #############################################################################
CREATE OR REPLACE PROCEDURE public.register_shop_sale_with_elements_v5(
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
    -- Depósito registrado junto con la venta
    _deposit_comment VARCHAR(200);
    _deposit_date TIMESTAMP;
    _delivery_deposit_comment VARCHAR(200);
    _delivery_deposit_date TIMESTAMP;
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

        -- ── Depósito: comentario y fecha del pago hecho al vender ───────────
        -- Sin comentario no hay fila: la venta queda como siempre.
        _deposit_comment := left(NULLIF(btrim(_sale_properties->>'depositComment'), ''), 200);
        _delivery_deposit_comment := left(NULLIF(btrim(_sale_properties->>'deliveryDepositComment'), ''), 200);

        IF _payment_type_identifier = 'Depósito' AND _deposit_comment IS NOT NULL AND _order_amount > 0 THEN
            _deposit_date := COALESCE(
                NULLIF(btrim(_sale_properties->>'depositDate'), '')::TIMESTAMP,
                timezone('UTC'::text, CURRENT_TIMESTAMP));

            INSERT INTO shop_sale_payment (
                shop_sale_id, amount, payment_type_id, payment_target, "comment", "date", is_sale_payment)
            VALUES (
                _new_ss_id, _order_amount, _payment_type_id, 'ORDER', _deposit_comment, _deposit_date, TRUE);
        END IF;

        IF _delivery_payment_identifier = 'Depósito' AND _delivery_deposit_comment IS NOT NULL AND _delivery > 0 THEN
            _delivery_deposit_date := COALESCE(
                NULLIF(btrim(_sale_properties->>'deliveryDepositDate'), '')::TIMESTAMP,
                timezone('UTC'::text, CURRENT_TIMESTAMP));

            INSERT INTO shop_sale_payment (
                shop_sale_id, amount, payment_type_id, payment_target, "comment", "date", is_sale_payment)
            VALUES (
                _new_ss_id, _delivery, _delivery_payment_type_id, 'DELIVERY', _delivery_deposit_comment, _delivery_deposit_date, TRUE);
        END IF;

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
        RAISE EXCEPTION 'Error en registro de venta v5: %', SQLERRM;
    END;
END;
$procedure$
;


-- #############################################################################
-- PASO 3 — QUERIES / ENDPOINTS NUEVOS
--
--   registerShopV5        -> registro de la venta con el depósito.
--   getShopSalePaymentsV4 -> igual que V3 + `isSalePayment`, para que la vista
--                            de la venta distinga el depósito del abono.
--
--   Los anteriores (/registerShopV4, /getShopSalePaymentsV3) NO se tocan.
-- #############################################################################
DELETE FROM public.sql_queries WHERE "path" IN ('/registerShopV5', '/getShopSalePaymentsV4');

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('registerShopV5','/registerShopV5','call register_shop_sale_with_elements_v5($1,$2,$3::uuid)','shop_sale','PATCH'),
	 ('getShopSalePaymentsV4','/getShopSalePaymentsV4','SELECT json_agg(
    json_build_object(
        ''id'', ssp.id,
        ''amount'', ssp.amount,
        ''date'', ssp.date,
        ''comment'', ssp."comment",
        ''isSalePayment'', ssp.is_sale_payment,
        ''paymentTarget'', ssp.payment_target,
        ''paymentType'', json_build_object(
            ''id'', pt.id,
            ''identifier'', pt."name"
        )
    ) ORDER BY ssp.date ASC
) AS json_result
FROM shop_sale_payment ssp
LEFT JOIN payment_type pt ON pt.id = ssp.payment_type_id','shop_sale_payment','POST');


-- #############################################################################
-- PASO 4 — CIERRE DE CAJA: el depósito de la venta NO es un cobro de crédito
--
--   Las tres queries del cierre arman `creditPayments` leyendo todas las filas
--   de shop_sale_payment del período. Se derivan versiones nuevas que excluyen
--   las marcadas con is_sale_payment, con el mismo replace() sobre
--   `consulta_sql` que usan las migrations anteriores.
--
--     /getNewStoreCashClosingV3   -> /getNewStoreCashClosingV4   (cierre nuevo)
--     /retrieveStoreCashClosingV4 -> /retrieveStoreCashClosingV5 (editar cierre)
--     /getStoreCashClosingV4      -> /getStoreCashClosingV5      (ver cierre)
--
--   El ancla `JOIN shop_sale ss ON ss.id = ssp.shop_sale_id` aparece UNA sola
--   vez en cada query (verificado): es el único punto donde shop_sale_payment
--   se une con shop_sale. El bloque `payments` de cada venta también lee
--   shop_sale_payment pero sin ese JOIN, así que no se ve afectado — ahí sí
--   conviene que el depósito aparezca, es el detalle de la venta.
--
--   Al ser un INNER JOIN, la condición en el ON filtra igual que un WHERE.
-- #############################################################################
DELETE FROM public.sql_queries
WHERE "path" IN ('/getNewStoreCashClosingV4', '/retrieveStoreCashClosingV5', '/getStoreCashClosingV5');

-- getNewStoreCashClosingV4
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getNewStoreCashClosingV4','/getNewStoreCashClosingV4',
       replace(consulta_sql,
           'JOIN shop_sale ss ON ss.id = ssp.shop_sale_id',
           'JOIN shop_sale ss ON ss.id = ssp.shop_sale_id
		AND ssp.is_sale_payment = false'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getNewStoreCashClosingV3';

-- retrieveStoreCashClosingV5
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'retrieveStoreCashClosingV5','/retrieveStoreCashClosingV5',
       replace(consulta_sql,
           'JOIN shop_sale ss ON ss.id = ssp.shop_sale_id',
           'JOIN shop_sale ss ON ss.id = ssp.shop_sale_id
		AND ssp.is_sale_payment = false'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/retrieveStoreCashClosingV4';

-- getStoreCashClosingV5
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getStoreCashClosingV5','/getStoreCashClosingV5',
       replace(consulta_sql,
           'JOIN shop_sale ss ON ss.id = ssp.shop_sale_id',
           'JOIN shop_sale ss ON ss.id = ssp.shop_sale_id
		AND ssp.is_sale_payment = false'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getStoreCashClosingV4';


-- #############################################################################
-- VERIFICACIÓN (opcional, correr después)
-- #############################################################################
-- Los cinco endpoints nuevos deben existir:
-- SELECT "path" FROM public.sql_queries
--  WHERE "path" IN ('/registerShopV5','/getShopSalePaymentsV4','/getNewStoreCashClosingV4',
--                   '/retrieveStoreCashClosingV5','/getStoreCashClosingV5');
--
-- Las tres del cierre deben traer el filtro (y solo una vez cada una):
-- SELECT "path", consulta_sql LIKE '%ssp.is_sale_payment = false%' AS filtra
--   FROM public.sql_queries
--  WHERE "path" IN ('/getNewStoreCashClosingV4','/retrieveStoreCashClosingV5','/getStoreCashClosingV5');
--
-- Depósitos registrados junto con la venta:
-- SELECT id, shop_sale_id, amount, payment_target, "date", "comment"
--   FROM shop_sale_payment WHERE is_sale_payment ORDER BY "date" DESC LIMIT 20;
