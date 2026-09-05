-- =============================================================================
-- Migración: banco y número de referencia en los pagos de venta
-- Fecha: 2026-09-01
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Objetivo: un pago con Depósito o Cheque tiene que decir DE QUÉ BANCO salió y
-- con QUÉ NÚMERO de transferencia o de cheque. Hoy todo eso vive suelto dentro
-- del comentario, que es texto libre y opcional, así que no se puede cuadrar
-- contra el estado de cuenta del banco.
--
-- Se agregan dos columnas a shop_sale_payment:
--   bank         varchar(50) -- elegido del listado de bancos de la tienda
--   reference_no varchar(50) -- número de transferencia o de cheque
--
-- El comentario pasa a ser explícitamente OPCIONAL: deja de ser el lugar donde
-- se metía el dato duro y queda para la nota libre.
--
-- QUÉ TIPOS DE PAGO LO PIDEN
-- Depósito y Cheque. El catálogo payment_type tiene cuatro entradas —Efectivo,
-- Crédito, Depósito, Cheque— y no existe "Transferencia": el depósito ES la
-- transferencia bancaria en este sistema.
--
-- POR QUÉ EL BANCO ES TEXTO Y NO UNA FK
-- Los bancos de una tienda viven en establishment.banks, que también es texto
-- separado por saltos de línea (ver 2026-08-31-bancos-por-tienda.sql). El front
-- arma el select con esa lista y guarda el NOMBRE elegido. Es la misma decisión
-- que product_for_sale_store_order.operators: el pago es un registro histórico y
-- tiene que conservar el nombre del banco que se eligió, aunque después la
-- tienda edite su listado.
--
-- LA OBLIGATORIEDAD LA VALIDA EL FRONT, NO LA PROCEDURE
-- Las procedures nuevas guardan lo que les llega en vez de hacer RAISE. Un
-- RAISE dejaría a la tienda sin poder VENDER si el front se revierte o manda el
-- dato mal, y una venta bloqueada es mucho peor que un pago sin banco. Los
-- formularios son los que exigen banco y referencia.
--
-- CAMBIO DE COMPORTAMIENTO EN EL REGISTRO DE VENTA
-- register_shop_sale_with_elements_v5 inserta la fila del depósito SOLO si hay
-- comentario. Con banco obligatorio eso se invierte: la fila tiene que existir
-- siempre que el pago sea Depósito o Cheque. En la v6 la condición pasa a ser
-- "hay banco, referencia o comentario", y además acepta Cheque, que antes no
-- registraba nada. Es el cambio de fondo de esta migración.
--
-- ENFOQUE 100% ADITIVO:
--   * Columnas nuevas NULLABLE: los pagos ya registrados y los de Efectivo no
--     las tienen y no se rellenan hacia atrás.
--   * Procedures NUEVAS (v5 y v6). add_shop_sale_payment_v4 y
--     register_shop_sale_with_elements_v5 quedan vivas e intactas, así que un
--     rollback del front no necesita tocar la base.
--   * Las lecturas que cambian se clonan; las originales siguen vivas.
--
-- LOS CIERRES DE CAJA YA GUARDADOS NO SE TOCAN
-- cash_closing congela creditPayments como jsonb al cerrar. Los cierres
-- anteriores a esta migración no van a traer bank ni referenceNo y el front
-- muestra '--', igual que ya hace con el comentario.
--
-- ORDEN DE EJECUCIÓN (una sola corrida, ANTES de desplegar el front nuevo):
--   PASO 0 -> Revisar el estado actual
--   PASO 1 -> ALTER: columnas bank y reference_no
--   PASO 2 -> Procedure add_shop_sale_payment_v5
--   PASO 3 -> Procedure register_shop_sale_with_elements_v6
--   PASO 4 -> Endpoints de escritura
--   PASO 5 -> Las cinco lecturas clonadas
--
-- Versiones que nacen acá:
--   add_shop_sale_payment_v4              -> v5
--   register_shop_sale_with_elements_v5   -> v6
--   /addShopSalePaymentV5                 -> V6
--   /registerShopV5                       -> V6
--   /getShopSalePaymentsV5                -> V6
--   /retrieveCustomerCreditPayments       -> V2
--   /getNewStoreCashClosingV5             -> V6
--   /retrieveStoreCashClosingV6           -> V7
--   /getStoreCashClosingV6                -> V7
-- =============================================================================


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- 0.a Las dos procedures que se clonan tienen que existir.
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('add_shop_sale_payment_v4', 'register_shop_sale_with_elements_v5')
 ORDER BY p.proname;

-- 0.b Las cinco lecturas tienen que existir y traer el ancla del PASO 5.
--     Deben salir 5 filas, todas con tiene_ancla = true.
SELECT "path", consulta_sql LIKE '%''comment'', ssp."comment",%' AS tiene_ancla
  FROM public.sql_queries
 WHERE "path" IN ('/getShopSalePaymentsV5','/retrieveCustomerCreditPayments',
                  '/getNewStoreCashClosingV5','/retrieveStoreCashClosingV6',
                  '/getStoreCashClosingV6')
 ORDER BY "path";

-- 0.c Los tipos de pago que van a pedir banco. Deben salir Depósito y Cheque;
--     si en esta base se llaman distinto, corregirlos en el PASO 3.
SELECT id, "name" FROM payment_type WHERE "name" IN ('Depósito', 'Cheque') ORDER BY "name";

-- 0.d Las tiendas tienen que tener sus bancos cargados ANTES de desplegar el
--     front: sin bancos el select queda vacío y no se puede cobrar con Depósito
--     ni con Cheque. Las filas que salgan acá son las que faltan.
SELECT id, "name" FROM establishment
 WHERE status_id = 28 AND (banks IS NULL OR btrim(banks) = '')
 ORDER BY "name";


-- #############################################################################
-- PASO 1 — ALTER: columnas nuevas, nullables.
--          Nullables a propósito y sin DEFAULT: los pagos históricos no tienen
--          estos datos y los pagos en Efectivo nunca los van a tener. No hay un
--          valor con el cual rellenarlos que no sea una mentira.
--          varchar(50) en las dos, según lo pedido.
-- #############################################################################

ALTER TABLE shop_sale_payment
    ADD COLUMN IF NOT EXISTS bank varchar(50) NULL,
    ADD COLUMN IF NOT EXISTS reference_no varchar(50) NULL;

COMMENT ON COLUMN shop_sale_payment.bank IS
    'Banco del pago, elegido del listado establishment.banks de la tienda. Se guarda el nombre y no una FK: el pago es histórico y conserva el banco que se eligió. NULL en pagos en efectivo y en los anteriores a 2026-09-01.';

COMMENT ON COLUMN shop_sale_payment.reference_no IS
    'Número de transferencia o de cheque. NULL en pagos en efectivo y en los anteriores a 2026-09-01.';


-- #############################################################################
-- PASO 2 — PROCEDURE add_shop_sale_payment_v5
--          Clon de add_shop_sale_payment_v4 + `_bank` y `_reference_no`,
--          opcionales y al final de la firma para no alterar el orden de los
--          parámetros que ya usa la v4. Lo único que cambia en el cuerpo son las
--          dos columnas extra del INSERT y su saneo; el cálculo de montos y
--          estados queda IGUAL.
--
--          El saneo replica el del comentario: btrim, NULLIF contra cadena
--          vacía y left() al largo de la columna. Así un front que mande '' deja
--          NULL en vez de una cadena vacía, y las dos cosas se leen igual desde
--          el resto del sistema.
-- #############################################################################
CREATE OR REPLACE PROCEDURE public.add_shop_sale_payment_v5(
    IN _shop_sale_id uuid,
    IN _amount numeric,
    IN _payment_type_id integer,
    IN _payment_target varchar DEFAULT 'ORDER',
    IN _comment varchar DEFAULT NULL,
    IN _date timestamp DEFAULT NULL,
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
    _payment_date TIMESTAMP;
    _clean_comment VARCHAR(200);
    _clean_bank VARCHAR(50);
    _clean_reference_no VARCHAR(50);
BEGIN
    BEGIN
        _payment_date := COALESCE(_date, timezone('UTC'::text, CURRENT_TIMESTAMP));
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
            creator_user_id, bank, reference_no)
        VALUES (
            _shop_sale_id, _amount, _payment_type_id, _payment_target, _clean_comment, _payment_date,
            _creator_user_id, _clean_bank, _clean_reference_no);

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
-- PASO 3 — PROCEDURE register_shop_sale_with_elements_v6
--
-- Clon de register_shop_sale_with_elements_v5. ES LA PROCEDURE MÁS CRÍTICA DEL
-- SISTEMA: registra la venta, descuenta inventario e inserta los elementos.
-- Conviene diffearla contra la v5 antes de correr esto.
--
-- LO ÚNICO QUE CAMBIA es el bloque del pago registrado con la venta:
--
--   a) Antes solo miraba 'Depósito'. Ahora también 'Cheque', que no registraba
--      nada y por lo tanto perdía el número del cheque.
--   b) Antes la fila existía solo si había comentario. Ahora existe si hay
--      banco, referencia O comentario — con banco obligatorio en el front, en
--      la práctica siempre.
--   c) El INSERT lleva bank y reference_no.
--
-- El resto —montos, estados, validación de crédito, inventario, elementos— es
-- idéntico a la v5, carácter por carácter.
--
-- Campos opcionales que lee de _sale_properties (los cuatro son nuevos):
--   depositBank / depositReferenceNo                 -> pago del pedido
--   deliveryDepositBank / deliveryDepositReferenceNo -> pago del envío
-- #############################################################################
CREATE OR REPLACE PROCEDURE public.register_shop_sale_with_elements_v6(
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
        -- Con banco obligatorio en el front la fila existe siempre; la condición
        -- acepta cualquiera de los tres datos para que un front viejo —que solo
        -- manda comentario— siga funcionando igual que con la v5.
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
                timezone('UTC'::text, CURRENT_TIMESTAMP));

            INSERT INTO shop_sale_payment (
                shop_sale_id, amount, payment_type_id, payment_target, "comment", "date",
                is_sale_payment, bank, reference_no)
            VALUES (
                _new_ss_id, _order_amount, _payment_type_id, 'ORDER', _deposit_comment, _deposit_date,
                TRUE, _deposit_bank, _deposit_reference_no);
        END IF;

        IF _delivery_payment_identifier IN ('Depósito', 'Cheque')
           AND (_delivery_deposit_bank IS NOT NULL
                OR _delivery_deposit_reference_no IS NOT NULL
                OR _delivery_deposit_comment IS NOT NULL)
           AND _delivery > 0 THEN
            _delivery_deposit_date := COALESCE(
                NULLIF(btrim(_sale_properties->>'deliveryDepositDate'), '')::TIMESTAMP,
                timezone('UTC'::text, CURRENT_TIMESTAMP));

            INSERT INTO shop_sale_payment (
                shop_sale_id, amount, payment_type_id, payment_target, "comment", "date",
                is_sale_payment, bank, reference_no)
            VALUES (
                _new_ss_id, _delivery, _delivery_payment_type_id, 'DELIVERY', _delivery_deposit_comment, _delivery_deposit_date,
                TRUE, _delivery_deposit_bank, _delivery_deposit_reference_no);
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
        RAISE EXCEPTION 'Error en registro de venta v6: %', SQLERRM;
    END;
END;
$procedure$
;


-- #############################################################################
-- PASO 4 — ENDPOINTS DE ESCRITURA
--
--   addShopSalePaymentV6 -> abono con banco y referencia. $8 y $9 llegan como
--                           texto: el nullif() los deja en NULL si el front
--                           manda cadena vacía y la procedure aplica su default,
--                           igual que $5, $6 y $7.
--   registerShopV6       -> registro de venta con el pago bancario completo.
--
--   Los anteriores (/addShopSalePaymentV5, /registerShopV5) NO se tocan.
--   El DELETE previo los hace idempotentes: sql_queries no tiene unique en
--   "path" y una fila duplicada haría que el router resuelva de forma no
--   determinista.
-- #############################################################################
DELETE FROM public.sql_queries WHERE "path" IN ('/addShopSalePaymentV6', '/registerShopV6');

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('addShopSalePaymentV6','/addShopSalePaymentV6','call add_shop_sale_payment_v5($1::uuid,$2::numeric,$3::int,$4,nullif($5::text,''''),nullif($6::text,'''')::timestamp,nullif($7::text,'''')::uuid,nullif($8::text,''''),nullif($9::text,''''))','shop_sale_payment','PATCH'),
	 ('registerShopV6','/registerShopV6','call register_shop_sale_with_elements_v6($1,$2,$3::uuid)','shop_sale','PATCH');


-- #############################################################################
-- PASO 5 — LAS CINCO LECTURAS
--
-- Se derivan con replace() de la fila VIVA en producción, no de un texto pegado
-- acá: así el clon arrastra cualquier cambio que la versión anterior tenga y
-- este archivo no pueda conocer. Mismo patrón que
-- 2026-08-11-add-shop-sale-payment-user.sql.
--
-- El ancla es `''comment'', ssp."comment",` y aparece UNA sola vez en cada una
-- de las cinco (verificado en el PASO 0.b): ninguna otra clave del json usa el
-- alias ssp para el comentario.
--
-- El alias de shop_sale_payment DEBE seguir siendo `ssp` y principal_table
-- seguir siendo la misma: el backend arma el WHERE desde el objeto que manda el
-- front.
-- #############################################################################
DELETE FROM public.sql_queries
 WHERE "path" IN ('/getShopSalePaymentsV6','/retrieveCustomerCreditPaymentsV2',
                  '/getNewStoreCashClosingV6','/retrieveStoreCashClosingV7',
                  '/getStoreCashClosingV7');

-- 5.a Pagos de una venta (timeline del detalle de venta).
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getShopSalePaymentsV6','/getShopSalePaymentsV6',
       replace(consulta_sql,
           '''comment'', ssp."comment",',
           '''comment'', ssp."comment",
        ''bank'', ssp.bank,
        ''referenceNo'', ssp.reference_no,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getShopSalePaymentsV5'
  AND consulta_sql LIKE '%''comment'', ssp."comment",%';

-- 5.b Abonos de crédito de un cliente (timeline del historial de cliente).
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'retrieveCustomerCreditPaymentsV2','/retrieveCustomerCreditPaymentsV2',
       replace(consulta_sql,
           '''comment'', ssp."comment",',
           '''comment'', ssp."comment",
        ''bank'', ssp.bank,
        ''referenceNo'', ssp.reference_no,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/retrieveCustomerCreditPayments'
  AND consulta_sql LIKE '%''comment'', ssp."comment",%';

-- 5.c Cierre de caja nuevo.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getNewStoreCashClosingV6','/getNewStoreCashClosingV6',
       replace(consulta_sql,
           '''comment'', ssp."comment",',
           '''comment'', ssp."comment",
			''bank'', ssp.bank,
			''referenceNo'', ssp.reference_no,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getNewStoreCashClosingV5'
  AND consulta_sql LIKE '%''comment'', ssp."comment",%';

-- 5.d Editar cierre de caja.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'retrieveStoreCashClosingV7','/retrieveStoreCashClosingV7',
       replace(consulta_sql,
           '''comment'', ssp."comment",',
           '''comment'', ssp."comment",
			''bank'', ssp.bank,
			''referenceNo'', ssp.reference_no,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/retrieveStoreCashClosingV6'
  AND consulta_sql LIKE '%''comment'', ssp."comment",%';

-- 5.e Ver cierre de caja.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getStoreCashClosingV7','/getStoreCashClosingV7',
       replace(consulta_sql,
           '''comment'', ssp."comment",',
           '''comment'', ssp."comment",
			''bank'', ssp.bank,
			''referenceNo'', ssp.reference_no,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getStoreCashClosingV6'
  AND consulta_sql LIKE '%''comment'', ssp."comment",%';


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- Columnas nuevas
-- SELECT column_name, data_type, character_maximum_length, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'shop_sale_payment' AND column_name IN ('bank','reference_no');
--
-- -- Las dos procedures nuevas existen
-- SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('add_shop_sale_payment_v5','register_shop_sale_with_elements_v6');
--
-- -- Los 7 endpoints nuevos existen y ninguno está duplicado (7 filas, veces = 1)
-- SELECT "path", COUNT(*) AS veces FROM public.sql_queries
--  WHERE "path" IN ('/addShopSalePaymentV6','/registerShopV6','/getShopSalePaymentsV6',
--                   '/retrieveCustomerCreditPaymentsV2','/getNewStoreCashClosingV6',
--                   '/retrieveStoreCashClosingV7','/getStoreCashClosingV7')
--  GROUP BY "path" ORDER BY "path";
--
-- -- Los clones traen los campos nuevos y los originales siguen sin ellos
-- SELECT "path", consulta_sql LIKE '%ssp.reference_no%' AS trae_referencia
--   FROM public.sql_queries
--  WHERE "path" IN ('/getShopSalePaymentsV5','/getShopSalePaymentsV6',
--                   '/retrieveCustomerCreditPayments','/retrieveCustomerCreditPaymentsV2',
--                   '/getNewStoreCashClosingV5','/getNewStoreCashClosingV6',
--                   '/retrieveStoreCashClosingV6','/retrieveStoreCashClosingV7',
--                   '/getStoreCashClosingV6','/getStoreCashClosingV7')
--  ORDER BY "path";
--
-- -- Prueba real, después de desplegar el front:
-- --   1. Venta pagada con Depósito -> debe quedar una fila con is_sale_payment = true,
-- --      bank y reference_no llenos.
-- --   2. Venta pagada con Cheque   -> ídem. Antes de esta migración NO generaba fila.
-- --   3. Abono de crédito con Depósito o Cheque -> fila con is_sale_payment = false.
-- SELECT ssp.id, ss.sale_number, pt."name" AS tipo, ssp.is_sale_payment,
--        ssp.bank, ssp.reference_no, ssp."comment", ssp.amount, ssp."date"
--   FROM shop_sale_payment ssp
--   JOIN shop_sale ss ON ss.id = ssp.shop_sale_id
--   LEFT JOIN payment_type pt ON pt.id = ssp.payment_type_id
--  ORDER BY ssp."date" DESC LIMIT 20;
--
-- -- Pagos bancarios que quedaron sin banco (deberían ser solo los anteriores a hoy)
-- SELECT count(*) FROM shop_sale_payment ssp
--   JOIN payment_type pt ON pt.id = ssp.payment_type_id
--  WHERE pt."name" IN ('Depósito','Cheque') AND ssp.bank IS NULL;
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve a las versiones anteriores con revertir el commit: la v4/v5 de
-- las procedures y los endpoints viejos quedaron vivos e intactos. La base se
-- deja como estaba con:
--
-- DELETE FROM public.sql_queries
--  WHERE "path" IN ('/addShopSalePaymentV6','/registerShopV6','/getShopSalePaymentsV6',
--                   '/retrieveCustomerCreditPaymentsV2','/getNewStoreCashClosingV6',
--                   '/retrieveStoreCashClosingV7','/getStoreCashClosingV7');
-- DROP PROCEDURE IF EXISTS public.add_shop_sale_payment_v5(uuid,numeric,integer,varchar,varchar,timestamp,uuid,varchar,varchar);
-- DROP PROCEDURE IF EXISTS public.register_shop_sale_with_elements_v6(jsonb,jsonb,uuid);
--
-- Las columnas se pueden dejar: son NULLABLE y ninguna query anterior las lee.
-- Para sacarlas —y perder los bancos y referencias ya registrados—:
-- ALTER TABLE shop_sale_payment DROP COLUMN IF EXISTS bank, DROP COLUMN IF EXISTS reference_no;
-- #############################################################################
