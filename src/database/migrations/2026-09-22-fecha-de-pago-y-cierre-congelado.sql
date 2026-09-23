-- =============================================================================
-- Migración: fecha de pago separada de la fecha de registro + cierre congelado
-- Fecha: 2026-09-22
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- =============================================================================
-- EL PROBLEMA
-- =============================================================================
--
-- `shop_sale_payment."date"` es hoy DOS cosas a la vez: la fecha que el usuario
-- teclea en el formulario y la fecha con la que el cierre de caja decide a qué
-- período pertenece el pago. Como el usuario la puede mover, puede mover plata
-- de un período a otro sin darse cuenta.
--
-- El síntoma que se reportó:
--
--   1. El lunes se cierra caja. El cierre queda firmado con 3 pagos.
--   2. El miércoles se registra un pago y se le teclea la fecha del lunes.
--   3. Al volver a abrir el cierre del lunes ahora muestra 4 pagos.
--   4. Al hacer el cierre del miércoles, ese pago NO aparece: la ventana del
--      cierre nuevo arranca en la fecha del cierre anterior y el pago quedó
--      antes. La plata no se cuadra en ningún cierre, nunca.
--
-- Y contamina el saldo: register_cash_closing_v5 calcula `credit_balance`
-- restando SUM(ssp.amount) con el mismo filtro `ssp."date" >= último cierre`.
-- Un abono retrofechado no se resta nunca y el saldo de crédito queda inflado
-- de forma permanente.
--
-- ESTO REVIERTE UNA DECISIÓN DE 2026-08-02
-- La migración 2026-08-02-add-shop-sale-payment-comment.sql decidió a propósito
-- NO crear una columna aparte, con este argumento: "si se agregara una segunda
-- columna, el cierre de caja seguiría contando el abono por su fecha de
-- registro y no por la fecha real que ingresó el usuario".
--
-- Ese razonamiento era el correcto si se asume que la fecha tecleada es la
-- verdad contable. No lo es. El período de un cierre lo define CUÁNDO ENTRÓ el
-- dato al sistema, porque es lo único que no se puede mover hacia atrás: un
-- cierre firmado no puede cambiar después. La fecha que teclea el usuario es
-- una referencia del documento ("el cliente pagó el martes"), no el criterio
-- con el que se cuadra la caja.
--
-- =============================================================================
-- LA SOLUCIÓN, EN DOS PARTES
-- =============================================================================
--
-- PARTE A — se separan las dos fechas
--
--   shop_sale_payment."date"         -> la pone SIEMPRE el sistema (now() UTC).
--                                       Inmutable. Es la que define el período.
--   shop_sale_payment.payment_date   -> columna NUEVA, la teclea el usuario.
--                                       Informativa: se muestra, no cuadra caja.
--
--   Lo elegante del cambio: las ventanas de los cierres YA filtran por
--   ssp."date". Al volverla inmutable quedan correctas sin tocar una sola línea
--   del SQL de las ventanas.
--
--   El parámetro que el front ya mandaba con la fecha tecleada NO cambia de
--   posición: cambia de columna destino. Ver el comentario del PASO 2.
--
-- PARTE B — el cierre congela sus pagos y sus gastos
--
--   `cash_closing` guarda como jsonb las ventas, los pedidos y los inventarios,
--   pero NO los pagos ni los gastos: esos se recalculan EN VIVO cada vez que se
--   abre un cierre ya guardado, con una ventana entre la fecha del cierre
--   anterior y la de este. (El comentario de data.service.ts que dice que
--   `creditPayments` quedó congelado como jsonb es falso; se corrige en el front
--   junto con esta migración.)
--
--   Con la Parte A los pagos ya no se mueven de período, pero editar o eliminar
--   un gasto, o cancelar una venta, SIGUE cambiando un cierre firmado hace un
--   mes. Un cierre es un documento contable: tiene que ser inmutable por
--   construcción, no porque los datos se porten bien.
--
--   Se agregan cash_closing.credit_payments y .store_expenses, las llena la
--   procedure al cerrar, y las lecturas hacen COALESCE(columna, subquery viva):
--   los cierres guardados ANTES de esta migración tienen NULL y se siguen
--   leyendo en vivo, exactamente como hoy. No se rellenan hacia atrás: hacerlo
--   sería reconstruir el pasado con los datos de hoy, que es justo lo que este
--   cambio busca impedir.
--
-- =============================================================================
-- ENFOQUE 100% ADITIVO
-- =============================================================================
--   * Columnas nuevas NULLABLE. `payment_date` se rellena una vez con el valor
--     actual de "date", que para las filas históricas ES la fecha que tecleó el
--     usuario. No se reescribe historia: los cierres viejos se siguen viendo
--     igual.
--   * Procedures NUEVAS. add_shop_sale_payment_v5,
--     register_shop_sale_with_elements_v6 y register_cash_closing_v5 quedan
--     vivas e intactas: revertir el front no necesita tocar la base.
--   * Las lecturas que cambian se clonan; las originales siguen vivas.
--
-- Versiones que nacen acá:
--   add_shop_sale_payment_v5              -> v6
--   register_shop_sale_with_elements_v6   -> v7
--   register_cash_closing_v5              -> v6
--   /addShopSalePaymentV6                 -> V7
--   /registerShopV6                       -> V7
--   /addStoreCashClosingV5                -> V6
--   /getShopSalePaymentsV6                -> V7
--   /retrieveCustomerCreditPaymentsV2     -> V3
--   /retrieveCustomerSalesHistory         -> V2
--   /getNewStoreCashClosingV6             -> V7
--   /retrieveStoreCashClosingV7           -> V8
--   /getStoreCashClosingV7                -> V8
--
-- ORDEN DE EJECUCIÓN (una sola corrida, ANTES de desplegar el front nuevo):
--   PASO 0 -> Revisar el estado actual
--   PASO 1 -> ALTER: payment_date, credit_payments, store_expenses
--   PASO 2 -> Procedure add_shop_sale_payment_v6
--   PASO 3 -> Procedure register_shop_sale_with_elements_v7
--   PASO 4 -> Procedure register_cash_closing_v6
--   PASO 5 -> Endpoints de escritura
--   PASO 6 -> Las seis lecturas clonadas
-- =============================================================================


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- 0.a Las tres procedures que se clonan tienen que existir.
--     Deben salir las 3.
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('add_shop_sale_payment_v5',
                     'register_shop_sale_with_elements_v6',
                     'register_cash_closing_v5')
 ORDER BY p.proname;

-- 0.b Las cinco lecturas del ancla `''comment'', ssp."comment",` tienen que
--     existir y traerla. Deben salir 5 filas, todas con tiene_ancla = true.
--     Es la misma ancla que usó 2026-09-01 y aparece UNA sola vez en cada una:
--     el bloque `payments` de cada venta, dentro de las queries del cierre, no
--     incluye el comentario.
SELECT "path", consulta_sql LIKE '%''comment'', ssp."comment",%' AS tiene_ancla
  FROM public.sql_queries
 WHERE "path" IN ('/getShopSalePaymentsV6','/retrieveCustomerCreditPaymentsV2',
                  '/getNewStoreCashClosingV6','/retrieveStoreCashClosingV7',
                  '/getStoreCashClosingV7')
 ORDER BY "path";

-- 0.c El historial de ventas del cliente, que se clona por su propia ancla.
--     Debe salir 1 fila con tiene_ancla = true.
SELECT "path", consulta_sql LIKE '%SELECT MAX(ssp."date")%' AS tiene_ancla
  FROM public.sql_queries
 WHERE "path" = '/retrieveCustomerSalesHistory';

-- 0.d Las dos anclas del INSERT de register_cash_closing_v5. Las dos deben dar
--     true; si no, la v6 del PASO 4 no se va a poder derivar.
SELECT pg_get_functiondef(p.oid) LIKE '%credit_balance, sobrante)%'   AS ancla_columnas,
       pg_get_functiondef(p.oid) LIKE '%_credit_balance, _sobrante%'  AS ancla_valores
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'register_cash_closing_v5';

-- 0.e Cuántos pagos hay con fecha tecleada fuera del día en que se registraron.
--     Es la medida del problema: estos son los que movieron plata de período.
--     Después de esta migración el número deja de crecer.
SELECT count(*) AS pagos_con_fecha_movida
  FROM shop_sale_payment
 WHERE "date"::date <> (SELECT max(ss.creation_date)::date
                          FROM shop_sale ss WHERE ss.id = shop_sale_id);


-- #############################################################################
-- PASO 1 — ALTER: las tres columnas nuevas, todas nullables.
--
--   payment_date    nullable y sin DEFAULT: las procedures viejas (v5/v6/v7)
--                   quedan vivas para rollback y no la llenan, así que las
--                   lecturas usan COALESCE(payment_date, "date") en vez de
--                   asumir que siempre viene.
--   credit_payments
--   store_expenses  nullable a propósito: NULL significa "este cierre es
--                   anterior a la migración, léelo en vivo". Un DEFAULT '[]'
--                   haría que los cierres viejos se vieran VACÍOS, que es
--                   mucho peor que leerlos en vivo.
-- #############################################################################

ALTER TABLE shop_sale_payment
    ADD COLUMN IF NOT EXISTS payment_date timestamp NULL;

COMMENT ON COLUMN shop_sale_payment.payment_date IS
    'Fecha del pago según el usuario. Informativa: se muestra en los timelines y en el cierre, pero NO define el período del cierre de caja — eso lo define "date", que la pone el sistema. NULL solo en filas escritas por las procedures anteriores a 2026-09-22; las lecturas usan COALESCE(payment_date, "date").';

COMMENT ON COLUMN shop_sale_payment."date" IS
    'Fecha de REGISTRO en el sistema, puesta por el sistema (now() UTC) desde 2026-09-22. Es la que define a qué cierre de caja pertenece el pago, por eso no se puede editar. Antes de 2026-09-22 esta columna llevaba la fecha que tecleaba el usuario.';

UPDATE shop_sale_payment SET payment_date = "date" WHERE payment_date IS NULL;

ALTER TABLE cash_closing
    ADD COLUMN IF NOT EXISTS credit_payments jsonb NULL,
    ADD COLUMN IF NOT EXISTS store_expenses  jsonb NULL;

COMMENT ON COLUMN cash_closing.credit_payments IS
    'Snapshot de los abonos del período, congelado al cerrar. NULL en los cierres anteriores a 2026-09-22: esos se leen en vivo contra shop_sale_payment, como se hacía antes.';

COMMENT ON COLUMN cash_closing.store_expenses IS
    'Snapshot de los gastos del período, congelado al cerrar. NULL en los cierres anteriores a 2026-09-22: esos se leen en vivo contra store_expense, como se hacía antes.';


-- #############################################################################
-- PASO 2 — PROCEDURE add_shop_sale_payment_v6
--
-- Clon de add_shop_sale_payment_v5. Cambia UNA cosa:
--
--   v5:  "date" := COALESCE(_date, now())          -- la fecha del usuario
--   v6:  "date" := now()  SIEMPRE                  -- la fecha del sistema
--        payment_date := COALESCE(_date, now())    -- la fecha del usuario
--
-- EL PARÁMETRO $6 NO CAMBIA DE POSICIÓN, CAMBIA DE DESTINO.
-- Se llama `_payment_date` en vez de `_date` porque eso es lo que siempre
-- significó: "la fecha que tecleó el usuario". Lo único que cambia es que
-- ahora aterriza en la columna que corresponde y ya no arrastra el período del
-- cierre con ella. La firma queda idéntica, así que el front sigue mandando lo
-- mismo en el mismo lugar.
--
-- El cálculo de montos y de estados queda IGUAL, carácter por carácter.
-- #############################################################################
CREATE OR REPLACE PROCEDURE public.add_shop_sale_payment_v6(
    IN _shop_sale_id uuid,
    IN _amount numeric,
    IN _payment_type_id integer,
    IN _payment_target varchar DEFAULT 'ORDER',
    IN _comment varchar DEFAULT NULL,
    IN _payment_date timestamp DEFAULT NULL,
    IN _creator_user_id uuid DEFAULT NULL,
    IN _bank varchar DEFAULT NULL,
    IN _reference_no varchar DEFAULT NULL
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
    _paid_amount NUMERIC(9,2);
    _pending_amount NUMERIC(9,2);
    _base_amount NUMERIC(9,2);   -- subtotal del pedido (total - delivery) o monto del envío
    _payment_status_id INT;
    _paid_status_id INT := 5;
    _partial_status_id INT := 4;
    _registered_date TIMESTAMP;  -- la del sistema, define el período del cierre
    _clean_payment_date TIMESTAMP;
    _clean_comment VARCHAR(200);
    _clean_bank VARCHAR(50);
    _clean_reference_no VARCHAR(50);
BEGIN
    BEGIN
        -- La fecha de registro NO sale de ningún parámetro: es la única forma de
        -- garantizar que un pago no se pueda mover a un período ya cerrado.
        _registered_date := timezone('UTC'::text, CURRENT_TIMESTAMP);
        -- Si el front no manda fecha, la del pago es la de registro.
        _clean_payment_date := COALESCE(_payment_date, _registered_date);

        _clean_comment := left(NULLIF(btrim(_comment), ''), 200);
        _clean_bank := left(NULLIF(btrim(_bank), ''), 50);
        _clean_reference_no := left(NULLIF(btrim(_reference_no), ''), 50);

        IF _payment_target = 'DELIVERY' THEN
            SELECT delivery_paid_amount, delivery, delivery_payment_status_id
            INTO _paid_amount, _base_amount, _payment_status_id
            FROM shop_sale
            WHERE id = _shop_sale_id
            FOR UPDATE;
        ELSE
            SELECT paid_amount, (total - delivery), payment_status_id
            INTO _paid_amount, _base_amount, _payment_status_id
            FROM shop_sale
            WHERE id = _shop_sale_id
            FOR UPDATE;
        END IF;

        _paid_amount := _paid_amount + _amount;
        _pending_amount := _base_amount - _paid_amount;

        IF _pending_amount < 0 THEN
            RAISE EXCEPTION 'El monto del pago excede el monto pendiente.';
        END IF;

        IF _pending_amount <= 0 THEN
            _payment_status_id := _paid_status_id;
        ELSIF _pending_amount < _base_amount THEN
            _payment_status_id := _partial_status_id;
        END IF;

        INSERT INTO shop_sale_payment (
            shop_sale_id, amount, payment_type_id, payment_target, "comment", "date",
            payment_date, creator_user_id, bank, reference_no)
        VALUES (
            _shop_sale_id, _amount, _payment_type_id, _payment_target, _clean_comment, _registered_date,
            _clean_payment_date, _creator_user_id, _clean_bank, _clean_reference_no);

        IF _payment_target = 'DELIVERY' THEN
            UPDATE shop_sale
            SET delivery_payment_status_id = _payment_status_id,
                delivery_paid_amount = _paid_amount,
                delivery_pending_amount = _pending_amount,
                updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
            WHERE id = _shop_sale_id;
        ELSE
            UPDATE shop_sale
            SET payment_status_id = _payment_status_id,
                paid_amount = _paid_amount,
                pending_amount = _pending_amount,
                updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
            WHERE id = _shop_sale_id;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en adición de pago para venta: %', SQLERRM;
    END;
END;
$procedure$
;


-- #############################################################################
-- PASO 3 — PROCEDURE register_shop_sale_with_elements_v7
--
-- Clon de register_shop_sale_with_elements_v6. ES LA PROCEDURE MÁS CRÍTICA DEL
-- SISTEMA: registra la venta, descuenta inventario e inserta los elementos.
-- Conviene diffearla contra la v6 antes de correr esto.
--
-- LO ÚNICO QUE CAMBIA son los dos INSERT del pago bancario registrado con la
-- venta, con el mismo criterio del PASO 2:
--
--   v6:  "date" := COALESCE(depositDate, now())
--   v7:  "date" := now() SIEMPRE;  payment_date := COALESCE(depositDate, now())
--
-- El resto —montos, estados, validación de crédito, inventario, elementos— es
-- idéntico a la v6, carácter por carácter.
-- #############################################################################
CREATE OR REPLACE PROCEDURE public.register_shop_sale_with_elements_v7(
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
    -- Fecha de registro: la pone el sistema y define el período del cierre.
    -- Una sola para toda la venta, así los dos pagos (pedido y envío) caen
    -- exactamente en el mismo instante.
    _registered_date TIMESTAMP;
    -- Pago bancario registrado junto con la venta (Depósito o Cheque)
    _deposit_comment VARCHAR(200);
    _deposit_date TIMESTAMP;
    _deposit_bank VARCHAR(50);
    _deposit_reference_no VARCHAR(50);
    _delivery_deposit_comment VARCHAR(200);
    _delivery_deposit_date TIMESTAMP;
    _delivery_deposit_bank VARCHAR(50);
    _delivery_deposit_reference_no VARCHAR(50);
BEGIN
    BEGIN
        _registered_date := timezone('UTC'::text, CURRENT_TIMESTAMP);

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

        -- ── Pago bancario: banco, referencia, comentario y fecha del pago ────
        -- hecho al vender. Aplica a Depósito y a Cheque.
        --
        -- `depositDate` es la fecha del PAGO (la que el usuario teclea); la de
        -- registro es _registered_date y no se puede mandar desde afuera.
        _deposit_comment := left(NULLIF(btrim(_sale_properties->>'depositComment'), ''), 200);
        _deposit_bank := left(NULLIF(btrim(_sale_properties->>'depositBank'), ''), 50);
        _deposit_reference_no := left(NULLIF(btrim(_sale_properties->>'depositReferenceNo'), ''), 50);

        _delivery_deposit_comment := left(NULLIF(btrim(_sale_properties->>'deliveryDepositComment'), ''), 200);
        _delivery_deposit_bank := left(NULLIF(btrim(_sale_properties->>'deliveryDepositBank'), ''), 50);
        _delivery_deposit_reference_no := left(NULLIF(btrim(_sale_properties->>'deliveryDepositReferenceNo'), ''), 50);

        IF _payment_type_identifier IN ('Depósito', 'Cheque')
           AND (_deposit_bank IS NOT NULL
                OR _deposit_reference_no IS NOT NULL
                OR _deposit_comment IS NOT NULL)
           AND _order_amount > 0 THEN
            _deposit_date := COALESCE(
                NULLIF(btrim(_sale_properties->>'depositDate'), '')::TIMESTAMP,
                _registered_date);

            INSERT INTO shop_sale_payment (
                shop_sale_id, amount, payment_type_id, payment_target, "comment", "date",
                payment_date, is_sale_payment, bank, reference_no)
            VALUES (
                _new_ss_id, _order_amount, _payment_type_id, 'ORDER', _deposit_comment, _registered_date,
                _deposit_date, TRUE, _deposit_bank, _deposit_reference_no);
        END IF;

        IF _delivery_payment_identifier IN ('Depósito', 'Cheque')
           AND (_delivery_deposit_bank IS NOT NULL
                OR _delivery_deposit_reference_no IS NOT NULL
                OR _delivery_deposit_comment IS NOT NULL)
           AND _delivery > 0 THEN
            _delivery_deposit_date := COALESCE(
                NULLIF(btrim(_sale_properties->>'deliveryDepositDate'), '')::TIMESTAMP,
                _registered_date);

            INSERT INTO shop_sale_payment (
                shop_sale_id, amount, payment_type_id, payment_target, "comment", "date",
                payment_date, is_sale_payment, bank, reference_no)
            VALUES (
                _new_ss_id, _delivery, _delivery_payment_type_id, 'DELIVERY', _delivery_deposit_comment, _registered_date,
                _delivery_deposit_date, TRUE, _delivery_deposit_bank, _delivery_deposit_reference_no);
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
        RAISE EXCEPTION 'Error en registro de venta v7: %', SQLERRM;
    END;
END;
$procedure$
;


-- #############################################################################
-- PASO 4 — PROCEDURE register_cash_closing_v6
--
-- La v5 son ~250 líneas de json_build_object para el snapshot de ventas,
-- pedidos e inventarios. Nada de eso cambia, así que la v6 se DERIVA del
-- código vivo de la v5 con pg_get_functiondef + replace(), igual que hizo
-- migration_shop_sale_customer.sql para derivar la v5 de la v4. Así no se
-- pegan 250 líneas acá y la v6 hereda cualquier cambio que la v5 ya traiga y
-- este archivo no pueda conocer.
--
-- Se inyectan dos cosas y nada más:
--   a) dos columnas al final de la lista del INSERT
--   b) dos subqueries al final de la lista de VALUES
--
-- SOBRE LA COTA SUPERIOR DE LA VENTANA
-- Las dos subqueries cierran en timezone('UTC', CURRENT_TIMESTAMP), que dentro
-- de una transacción es constante e IGUAL al DEFAULT de cash_closing.creation_date
-- (CURRENT_TIMESTAMP es la hora de inicio de la transacción, no del statement).
-- Por eso el snapshot y la fecha del cierre coinciden exactamente y no hace
-- falta tocar cómo se genera creation_date.
--
-- SOBRE LA COTA INFERIOR
-- Se usa _last_cash_closing_date, la misma variable con la que la v5 arma el
-- resto del cierre. Es también la que usa /getNewStoreCashClosing para la
-- vista previa, así que lo que queda congelado es exactamente lo que el usuario
-- vio y aprobó al presionar "cerrar caja".
--
-- OJO, INCONSISTENCIA QUE YA EXISTÍA Y QUE ESTA MIGRACIÓN NO TOCA:
-- _last_cash_closing_date toma el cierre anterior SIN filtrar los eliminados
-- (status 56), mientras que las lecturas guardadas sí los excluyen. En una
-- tienda con cierres eliminados las dos cotas no coinciden, así que el snapshot
-- congelado y el cálculo en vivo pueden diferir. Congelar en realidad MEJORA
-- ese caso —queda lo que el usuario aprobó en la vista previa—, pero explica
-- por qué un cierre viejo (leído en vivo) y uno nuevo (congelado) de la misma
-- tienda pueden no cuadrar entre sí. Unificar las dos cotas es un cambio
-- aparte: movería las cifras de cierres ya firmados.
--
-- LA FORMA DEL JSON ES LA MISMA QUE LA DE LA LECTURA VIVA
-- Las claves de credit_payments y store_expenses replican una por una las de
-- /getStoreCashClosingV7, para que un cierre congelado y uno viejo leído en
-- vivo se rendericen idénticos en el front. La VERIFICACIÓN del final compara
-- las dos formas contra un cierre real.
-- #############################################################################
DO $do$
DECLARE
    _src text;
BEGIN
    -- Sin guardia de "ya existe": la v6 se deriva siempre de la v5, que no se
    -- toca nunca, así que correr esto dos veces produce exactamente la misma
    -- procedure. Un guardia dejaría una v6 rota sin forma de rehacerla
    -- volviendo a correr el archivo.
    SELECT pg_get_functiondef(p.oid) INTO _src
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'register_cash_closing_v5';

    IF _src IS NULL THEN
        RAISE EXCEPTION 'No se encontró register_cash_closing_v5 en la base de datos';
    END IF;

    IF position('credit_balance, sobrante)' in _src) = 0
       OR position('_credit_balance, _sobrante' in _src) = 0 THEN
        RAISE EXCEPTION 'register_cash_closing_v5 no tiene las anclas esperadas; revisar el PASO 0.d';
    END IF;

    _src := replace(_src, 'register_cash_closing_v5', 'register_cash_closing_v6');

    -- (a) columnas
    _src := replace(_src,
        'credit_balance, sobrante)',
        'credit_balance, sobrante, credit_payments, store_expenses)');

    -- (b) valores: los dos snapshots, con la misma forma que la lectura viva
    _src := replace(_src,
        '_credit_balance, _sobrante',
        '_credit_balance, _sobrante,
		(
		SELECT json_agg(json_build_object(
			''id'', ssp.id,
			''amount'', ssp.amount,
			''date'', ssp."date",
			''paymentDate'', COALESCE(ssp.payment_date, ssp."date"),
			''paymentTarget'', ssp.payment_target,
			''creatorUser'', (SELECT json_build_object(''id'', u_ssp.id, ''name'', u_ssp.username, ''email'', u_ssp.email)
			                  FROM "user" u_ssp WHERE u_ssp.id = ssp.creator_user_id),
			''comment'', ssp."comment",
			''bank'', ssp.bank,
			''referenceNo'', ssp.reference_no,
			''paymentType'', json_build_object(
				''identifier'', pt_pay."name",
				''id'', pt_pay.id
			),
			''shopSale'', json_build_object(
				''id'', ss6.id,
				''nameClient'', ss6.name_client,
				''nitClient'', ss6.nit_client,
				''total'', ss6.total,
				''paymentType'', json_build_object(
					''identifier'', pt6."name",
					''id'', pt6.id
				),
				''creationDate'', ss6.creation_date,
				''updatedDate'', coalesce(ss6.updated_date, ss6.creation_date)
			)
		) ORDER BY COALESCE(ssp.payment_date, ssp."date") DESC)
		FROM shop_sale_payment ssp
		JOIN payment_type pt_pay ON pt_pay.id = ssp.payment_type_id
		JOIN shop_sale ss6 ON ss6.id = ssp.shop_sale_id
		AND ssp.is_sale_payment = false
		LEFT JOIN payment_type pt6 ON pt6.id = ss6.payment_type_id
		WHERE ss6.establishment_id = _establishment_id
		AND ss6.status_id = 52
		AND (_last_cash_closing_date IS NULL OR ssp."date" >= _last_cash_closing_date)
		AND ssp."date" <= timezone(''UTC''::text, CURRENT_TIMESTAMP)
		)::jsonb,
		(
		SELECT json_agg(json_build_object(
			''id'', se6.id,
			''title'', se6.title,
			''totalAmount'', se6.total_amount,
			''comment'', se6.comment,
			''supplier'', se6.supplier,
			''nit'', se6.nit,
			''creationDate'', se6.creation_date,
			''status'', json_build_object(''id'', se6_s.id, ''identifier'', se6_s."name")
		))
		FROM store_expense se6
		JOIN status se6_s ON se6_s.id = se6.status_id
		WHERE se6.establishment_id = _establishment_id
		AND se6.status_id = 58
		AND (_last_cash_closing_date IS NULL OR se6.creation_date >= _last_cash_closing_date)
		AND se6.creation_date <= timezone(''UTC''::text, CURRENT_TIMESTAMP)
		)::jsonb');

    EXECUTE _src;
    RAISE NOTICE 'register_cash_closing_v6 creada';
END
$do$;


-- #############################################################################
-- PASO 5 — ENDPOINTS DE ESCRITURA
--
--   /addShopSalePaymentV7  -> abono. La firma es la misma que la V6: lo que
--                             cambia es que $6 ahora va a payment_date.
--   /registerShopV7        -> registro de venta.
--   /addStoreCashClosingV6 -> cierre que congela pagos y gastos.
--
--   Los anteriores (V6 / V6 / V5) NO se tocan.
--   El DELETE previo los hace idempotentes: sql_queries no tiene unique en
--   "path" y una fila duplicada haría que el router resuelva de forma no
--   determinista.
-- #############################################################################
DELETE FROM public.sql_queries
 WHERE "path" IN ('/addShopSalePaymentV7', '/registerShopV7', '/addStoreCashClosingV6');

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('addShopSalePaymentV7','/addShopSalePaymentV7','call add_shop_sale_payment_v6($1::uuid,$2::numeric,$3::int,$4,nullif($5::text,''''),nullif($6::text,'''')::timestamp,nullif($7::text,'''')::uuid,nullif($8::text,''''),nullif($9::text,''''))','shop_sale_payment','PATCH'),
	 ('registerShopV7','/registerShopV7','call register_shop_sale_with_elements_v7($1,$2,$3::uuid)','shop_sale','PATCH'),
	 ('addStoreCashClosingV6','/addStoreCashClosingV6','call register_cash_closing_v6($1, $2::uuid, $3::uuid, $4::numeric)','cash_closing','PATCH');


-- #############################################################################
-- PASO 6 — LAS SEIS LECTURAS
--
-- Se derivan con replace() de la fila VIVA en producción, no de un texto pegado
-- acá: así el clon arrastra cualquier cambio que la versión anterior tenga y
-- este archivo no pueda conocer. Mismo patrón que 2026-09-01.
--
-- Cada lectura encadena hasta tres replace(), todos idempotentes: si un ancla
-- no está, ese replace no hace nada y el resto sigue. El WHERE ... LIKE del
-- final es el que garantiza que al menos la inyección principal ocurrió; si no,
-- no se inserta ninguna fila y el PASO 6.g lo detecta.
--
--   1. ''comment'', ssp."comment",   -> agrega paymentDate (ancla del 2026-09-01,
--                                      verificada única en las cinco)
--   2. ) ORDER BY ssp."date" DESC)   -> ordena por la fecha de pago
--   3. ) ORDER BY ssp.date ASC       -> ídem, la variante sin comillas de
--                                      getShopSalePayments
--
-- Los DOS cierres guardados (6.e y 6.f) además envuelven creditPayments y
-- storeExpenses en un COALESCE contra la columna nueva. Eso son dos ediciones
-- por bloque: abrir el COALESCE antes del subquery y cerrar su paréntesis al
-- final. El cierre se hace con regexp_replace y `\s*` en vez de replace(), para
-- no depender de la sangría exacta que tenga producción; sin la bandera 'g'
-- sustituye solo la primera coincidencia, que es la única que hay.
-- #############################################################################
DELETE FROM public.sql_queries
 WHERE "path" IN ('/getShopSalePaymentsV7','/retrieveCustomerCreditPaymentsV3',
                  '/retrieveCustomerSalesHistoryV2','/getNewStoreCashClosingV7',
                  '/retrieveStoreCashClosingV8','/getStoreCashClosingV8');

-- 6.a Pagos de una venta (timeline del detalle de venta).
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getShopSalePaymentsV7','/getShopSalePaymentsV7',
       replace(
         replace(consulta_sql,
           '''comment'', ssp."comment",',
           '''comment'', ssp."comment",
        ''paymentDate'', COALESCE(ssp.payment_date, ssp."date"),'),
         ') ORDER BY ssp.date ASC',
         ') ORDER BY COALESCE(ssp.payment_date, ssp.date) ASC'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getShopSalePaymentsV6'
  AND consulta_sql LIKE '%''comment'', ssp."comment",%';

-- 6.b Abonos de crédito de un cliente (timeline del historial de cliente).
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'retrieveCustomerCreditPaymentsV3','/retrieveCustomerCreditPaymentsV3',
       replace(
         replace(consulta_sql,
           '''comment'', ssp."comment",',
           '''comment'', ssp."comment",
        ''paymentDate'', COALESCE(ssp.payment_date, ssp."date"),'),
         ') ORDER BY ssp."date" DESC',
         ') ORDER BY COALESCE(ssp.payment_date, ssp."date") DESC'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/retrieveCustomerCreditPaymentsV2'
  AND consulta_sql LIKE '%''comment'', ssp."comment",%';

-- 6.c Historial de ventas de un cliente: la columna "Último abono" pasa a ser
--     la fecha del pago, que es la que el usuario reconoce.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'retrieveCustomerSalesHistoryV2','/retrieveCustomerSalesHistoryV2',
       replace(consulta_sql,
           'SELECT MAX(ssp."date")',
           'SELECT MAX(COALESCE(ssp.payment_date, ssp."date"))'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/retrieveCustomerSalesHistory'
  AND consulta_sql LIKE '%SELECT MAX(ssp."date")%';

-- 6.d Cierre de caja nuevo (vista previa).
--     NO lleva COALESCE contra las columnas nuevas: por definición es el previo
--     de un cierre que todavía no existe, así que siempre se calcula en vivo.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getNewStoreCashClosingV7','/getNewStoreCashClosingV7',
       replace(
         replace(consulta_sql,
           '''comment'', ssp."comment",',
           '''comment'', ssp."comment",
			''paymentDate'', COALESCE(ssp.payment_date, ssp."date"),'),
         ') ORDER BY ssp."date" DESC)',
         ') ORDER BY COALESCE(ssp.payment_date, ssp."date") DESC)'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getNewStoreCashClosingV6'
  AND consulta_sql LIKE '%''comment'', ssp."comment",%';

-- 6.e Editar cierre de caja.
--     Acá sí entra el COALESCE: si el cierre trae snapshot se usa, y si es
--     anterior a esta migración (NULL) cae al subquery vivo de siempre.
--
--     Las cuatro ediciones del COALESCE van de adentro hacia afuera: primero se
--     cierran los dos paréntesis (sobre el texto original, con sus anclas
--     intactas) y después se abren los dos COALESCE. El orden da igual porque
--     las anclas no se pisan, pero así se lee en el mismo orden en que ocurren.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'retrieveStoreCashClosingV8','/retrieveStoreCashClosingV8',
       replace(
         replace(
           regexp_replace(
             regexp_replace(
               replace(
                 replace(consulta_sql,
                   '''comment'', ssp."comment",',
                   '''comment'', ssp."comment",
			''paymentDate'', COALESCE(ssp.payment_date, ssp."date"),'),
                 ') ORDER BY ssp."date" DESC)',
                 ') ORDER BY COALESCE(ssp.payment_date, ssp."date") DESC)'),
               '(AND se\.creation_date <= cc\.creation_date\s*)\)', '\1))'),
             '(AND ssp\."date" <= cc\.creation_date\s*)\)', '\1))'),
           '''storeExpenses'', (',
           '''storeExpenses'', COALESCE(cc.store_expenses::json, ('),
         '''creditPayments'', (',
         '''creditPayments'', COALESCE(cc.credit_payments::json, ('),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/retrieveStoreCashClosingV7'
  AND consulta_sql LIKE '%''comment'', ssp."comment",%';

-- 6.f Ver cierre de caja. Mismo tratamiento que 6.e.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getStoreCashClosingV8','/getStoreCashClosingV8',
       replace(
         replace(
           regexp_replace(
             regexp_replace(
               replace(
                 replace(consulta_sql,
                   '''comment'', ssp."comment",',
                   '''comment'', ssp."comment",
			''paymentDate'', COALESCE(ssp.payment_date, ssp."date"),'),
                 ') ORDER BY ssp."date" DESC)',
                 ') ORDER BY COALESCE(ssp.payment_date, ssp."date") DESC)'),
               '(AND se\.creation_date <= cc\.creation_date\s*)\)', '\1))'),
             '(AND ssp\."date" <= cc\.creation_date\s*)\)', '\1))'),
           '''storeExpenses'', (',
           '''storeExpenses'', COALESCE(cc.store_expenses::json, ('),
         '''creditPayments'', (',
         '''creditPayments'', COALESCE(cc.credit_payments::json, ('),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getStoreCashClosingV7'
  AND consulta_sql LIKE '%''comment'', ssp."comment",%';

-- 6.g GUARDIA: las seis lecturas se insertaron, y las dos del cierre quedaron
--     con los paréntesis balanceados y con los dos COALESCE puestos.
--
--     El conteo de paréntesis no prueba que la query sea válida, pero sí atrapa
--     el único error que estas sustituciones pueden introducir: un COALESCE
--     abierto que no se cerró. Si algo falla, esto revienta la corrida ANTES de
--     que quede una query rota publicada. La comprobación (d) de la VERIFICACIÓN
--     sigue siendo obligatoria: es la que la ejecuta de verdad.
DO $do$
DECLARE
    _row record;
    _n int;
BEGIN
    SELECT count(*) INTO _n FROM public.sql_queries
     WHERE "path" IN ('/getShopSalePaymentsV7','/retrieveCustomerCreditPaymentsV3',
                      '/retrieveCustomerSalesHistoryV2','/getNewStoreCashClosingV7',
                      '/retrieveStoreCashClosingV8','/getStoreCashClosingV8');
    IF _n <> 6 THEN
        RAISE EXCEPTION 'Se esperaban 6 lecturas nuevas y hay %. Alguna ancla del PASO 6 no coincidió; revisar el PASO 0.b y 0.c', _n;
    END IF;

    FOR _row IN SELECT "path", consulta_sql FROM public.sql_queries
                 WHERE "path" IN ('/retrieveStoreCashClosingV8','/getStoreCashClosingV8')
    LOOP
        IF position('COALESCE(cc.credit_payments::json, (' in _row.consulta_sql) = 0
           OR position('COALESCE(cc.store_expenses::json, (' in _row.consulta_sql) = 0 THEN
            RAISE EXCEPTION '% no quedó con los dos COALESCE del snapshot', _row."path";
        END IF;

        IF length(_row.consulta_sql) - length(replace(_row.consulta_sql, '(', ''))
           <> length(_row.consulta_sql) - length(replace(_row.consulta_sql, ')', '')) THEN
            RAISE EXCEPTION '% quedó con los paréntesis desbalanceados: el COALESCE no se cerró', _row."path";
        END IF;
    END LOOP;

    RAISE NOTICE 'PASO 6 OK: 6 lecturas nuevas, cierres envueltos y balanceados';
END
$do$;


-- #############################################################################
-- VERIFICACIÓN — CORRER TODO ESTO ANTES DE DESPLEGAR EL FRONT
--
-- OJO con 6.e y 6.f: el COALESCE abre un paréntesis que se cierra por
-- coincidencia de patrón. Si el texto de producción no encaja, la query queda
-- ROTA o sin envolver. La comprobación (d) la ejecuta de verdad contra un
-- cierre real, que es la única forma de saberlo. NO desplegar el front sin
-- correrla.
-- #############################################################################
--
-- (a) Columnas nuevas
-- SELECT table_name, column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE (table_name = 'shop_sale_payment' AND column_name = 'payment_date')
--     OR (table_name = 'cash_closing' AND column_name IN ('credit_payments','store_expenses'));
--
-- (b) Backfill completo: debe dar 0
-- SELECT count(*) FROM shop_sale_payment WHERE payment_date IS NULL;
--
-- (c) Las tres procedures nuevas existen
-- SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('add_shop_sale_payment_v6','register_shop_sale_with_elements_v7','register_cash_closing_v6');
--
-- (d) LAS DOS LECTURAS DEL CIERRE CORREN SIN ERROR DE SINTAXIS.
--     Reemplazar <ID> por el id de un cierre real. Si 6.g dejó un paréntesis
--     sin cerrar, esto revienta acá y no en producción.
-- SELECT consulta_sql FROM public.sql_queries WHERE "path" = '/getStoreCashClosingV8';
--     -> copiar el texto, sustituir el WHERE que arma el backend por
--        "where cc.id = '<ID>'" y ejecutarlo. Debe devolver una fila con
--        creditPayments y storeExpenses pobladas.
--
-- (e) Los 9 endpoints nuevos existen y ninguno está duplicado (9 filas, veces = 1)
-- SELECT "path", COUNT(*) AS veces FROM public.sql_queries
--  WHERE "path" IN ('/addShopSalePaymentV7','/registerShopV7','/addStoreCashClosingV6',
--                   '/getShopSalePaymentsV7','/retrieveCustomerCreditPaymentsV3',
--                   '/retrieveCustomerSalesHistoryV2','/getNewStoreCashClosingV7',
--                   '/retrieveStoreCashClosingV8','/getStoreCashClosingV8')
--  GROUP BY "path" ORDER BY "path";
--
-- (f) Los clones traen paymentDate y los originales siguen sin él
-- SELECT "path", consulta_sql LIKE '%payment_date%' AS trae_fecha_pago
--   FROM public.sql_queries
--  WHERE "path" IN ('/getShopSalePaymentsV6','/getShopSalePaymentsV7',
--                   '/retrieveCustomerCreditPaymentsV2','/retrieveCustomerCreditPaymentsV3',
--                   '/getNewStoreCashClosingV6','/getNewStoreCashClosingV7',
--                   '/retrieveStoreCashClosingV7','/retrieveStoreCashClosingV8',
--                   '/getStoreCashClosingV7','/getStoreCashClosingV8')
--  ORDER BY "path";
--
-- (g) PRUEBA REAL, después de desplegar el front:
--     1. Registrar un abono con fecha de hace 3 días.
--        -> "date" = hoy, payment_date = hace 3 días.
--     2. Hacer un cierre de caja.
--        -> el abono APARECE en este cierre (antes desaparecía).
--        -> credit_payments queda poblado en la fila nueva.
--     3. Abrir un cierre anterior.
--        -> sigue mostrando lo mismo que antes del cambio.
-- SELECT ssp.id, ss.sale_number, ssp.amount, ssp."date" AS registro,
--        ssp.payment_date AS fecha_pago, ssp.is_sale_payment
--   FROM shop_sale_payment ssp
--   JOIN shop_sale ss ON ss.id = ssp.shop_sale_id
--  ORDER BY ssp."date" DESC LIMIT 20;
--
-- (h) Snapshots poblados solo en los cierres nuevos
-- SELECT id, creation_date,
--        credit_payments IS NOT NULL AS congelo_pagos,
--        store_expenses  IS NOT NULL AS congelo_gastos
--   FROM cash_closing ORDER BY creation_date DESC LIMIT 10;
--
-- (i) El snapshot coincide con lo que la lectura viva habría devuelto. Sobre el
--     cierre MÁS RECIENTE (uno hecho con la v6), la cuenta y la suma deben ser
--     iguales. Si difieren, la forma del json de la v6 se desalineó de la
--     lectura viva y hay que corregir el PASO 4 antes de seguir.
-- WITH cc_new AS (SELECT * FROM cash_closing WHERE credit_payments IS NOT NULL
--                  ORDER BY creation_date DESC LIMIT 1)
-- SELECT (SELECT count(*) FROM jsonb_array_elements((SELECT credit_payments FROM cc_new))) AS congelados,
--        (SELECT count(*) FROM shop_sale_payment ssp
--           JOIN shop_sale ss ON ss.id = ssp.shop_sale_id AND ssp.is_sale_payment = false
--          WHERE ss.establishment_id = (SELECT establishment_id FROM cc_new)
--            AND ss.status_id = 52
--            AND ssp."date" >= COALESCE((SELECT max(cc3.creation_date) FROM cash_closing cc3
--                                         WHERE cc3.establishment_id = (SELECT establishment_id FROM cc_new)
--                                           AND cc3.creation_date < (SELECT creation_date FROM cc_new)
--                                           AND cc3.status_id != 56), '1900-01-01'::timestamp)
--            AND ssp."date" <= (SELECT creation_date FROM cc_new)) AS en_vivo;
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve a las versiones anteriores con revertir el commit: las
-- procedures y los endpoints viejos quedaron vivos e intactos. La base se deja
-- como estaba con:
--
-- DELETE FROM public.sql_queries
--  WHERE "path" IN ('/addShopSalePaymentV7','/registerShopV7','/addStoreCashClosingV6',
--                   '/getShopSalePaymentsV7','/retrieveCustomerCreditPaymentsV3',
--                   '/retrieveCustomerSalesHistoryV2','/getNewStoreCashClosingV7',
--                   '/retrieveStoreCashClosingV8','/getStoreCashClosingV8');
-- DROP PROCEDURE IF EXISTS public.add_shop_sale_payment_v6(uuid,numeric,integer,varchar,varchar,timestamp,uuid,varchar,varchar);
-- DROP PROCEDURE IF EXISTS public.register_shop_sale_with_elements_v7(jsonb,jsonb,uuid);
-- DROP PROCEDURE IF EXISTS public.register_cash_closing_v6(text,uuid,uuid,numeric);
--
-- Las columnas se pueden dejar: son NULLABLE y ninguna query anterior las lee.
-- OJO: si ya se hicieron cierres con la v6, borrar credit_payments/store_expenses
-- pierde esos snapshots y esos cierres vuelven a ser mutables.
-- ALTER TABLE shop_sale_payment DROP COLUMN IF EXISTS payment_date;
-- ALTER TABLE cash_closing DROP COLUMN IF EXISTS credit_payments, DROP COLUMN IF EXISTS store_expenses;
-- #############################################################################
