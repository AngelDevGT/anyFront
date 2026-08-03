-- =============================================================================
-- Migración: comentario y fecha/hora editable en el abono de una venta al crédito
-- Fecha: 2026-08-02
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Objetivo: al registrar un pago (abono) de una venta al crédito hoy solo se
-- ingresa el monto y el tipo de pago. Se agregan dos datos más:
--   1. `comment`  -> comentario libre del abono, máximo 200 caracteres.
--   2. fecha/hora -> el usuario elige cuándo se recibió el abono; si no manda
--                    nada se sigue usando now() (UTC), como hasta ahora.
--
-- Sobre la fecha: NO se crea una columna nueva. `shop_sale_payment."date"` ya
-- es la fecha del abono y es la que usan los filtros de período de cash_closing
-- (bloque `creditPayments` de listStoreCashClosing / getStoreCashClosing). Si
-- se agregara una segunda columna, el cierre de caja seguiría contando el abono
-- por su fecha de registro y no por la fecha real que ingresó el usuario. Lo
-- único que cambia es que ahora esa columna se puede enviar explícitamente.
--
-- Enfoque 100% aditivo: NO modifica ni una sola query/procedure existente.
--   * Columna `comment` nullable -> los abonos ya registrados no se afectan.
--   * Procedure nueva add_shop_sale_payment_v3 (la v2 queda intacta).
--   * Endpoints nuevos addShopSalePaymentV4 / getShopSalePaymentsV3; los
--     anteriores (V3 / V2) quedan vivos para no romper nada en producción.
--
-- ORDEN DE EJECUCIÓN (una sola corrida, ANTES de desplegar el front nuevo):
--   PASO 1 -> ALTER: agrega la columna comment (nullable, no rompe nada)
--   PASO 2 -> Procedure add_shop_sale_payment_v3
--   PASO 3 -> INSERT de los endpoints nuevos
-- =============================================================================


-- #############################################################################
-- PASO 1 — ALTER: columna nueva, nullable.
--          Nullable a propósito: los pagos históricos no tienen comentario y
--          un NOT NULL los rompería.
-- #############################################################################
ALTER TABLE shop_sale_payment
    ADD COLUMN IF NOT EXISTS "comment" varchar(200) NULL;


-- #############################################################################
-- PASO 2 — PROCEDURE add_shop_sale_payment_v3
--          Clon de add_shop_sale_payment_v2 + `_comment` y `_date`, ambos
--          opcionales. `_date` cae en shop_sale_payment."date" y si viene NULL
--          se usa el now() en UTC de siempre.
-- #############################################################################
CREATE OR REPLACE PROCEDURE public.add_shop_sale_payment_v3(
    IN _shop_sale_id uuid,
    IN _amount numeric,
    IN _payment_type_id integer,
    IN _payment_target varchar DEFAULT 'ORDER',
    IN _comment varchar DEFAULT NULL,
    IN _date timestamp DEFAULT NULL
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
BEGIN
    BEGIN
        _payment_date := COALESCE(_date, timezone('UTC'::text, CURRENT_TIMESTAMP));
        _clean_comment := left(NULLIF(btrim(_comment), ''), 200);

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

        INSERT INTO shop_sale_payment (shop_sale_id, amount, payment_type_id, payment_target, "comment", "date")
        VALUES (_shop_sale_id, _amount, _payment_type_id, _payment_target, _clean_comment, _payment_date);

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
-- PASO 3 — QUERIES / ENDPOINTS NUEVOS
--
--   addShopSalePaymentV4  -> escritura del abono con comentario y fecha.
--                            $5 y $6 llegan como texto: el nullif() los deja en
--                            NULL cuando el front manda cadena vacía, y así la
--                            procedure aplica sus defaults.
--   getShopSalePaymentsV3 -> igual que V2 + `comment`.
--
--   Los endpoints anteriores (addShopSalePaymentV3, getShopSalePaymentsV2) NO
--   se tocan: quedan funcionando por si algún cliente viejo sigue apuntando ahí.
-- #############################################################################
DELETE FROM public.sql_queries WHERE "path" IN ('/addShopSalePaymentV4', '/getShopSalePaymentsV3');

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('addShopSalePaymentV4','/addShopSalePaymentV4','call add_shop_sale_payment_v3($1::uuid,$2::numeric,$3::int,$4,nullif($5::text,''''),nullif($6::text,'''')::timestamp)','shop_sale_payment','PATCH'),
	 ('getShopSalePaymentsV3','/getShopSalePaymentsV3','SELECT json_agg(
    json_build_object(
        ''id'', ssp.id,
        ''amount'', ssp.amount,
        ''date'', ssp.date,
        ''comment'', ssp."comment",
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
-- PASO 4 — CIERRE DE CAJA: el comentario también viaja en `creditPayments`
--
--   Las tres queries del cierre traen el detalle de abonos de crédito en el
--   bloque `creditPayments`. Se derivan versiones nuevas inyectando la clave
--   `comment` justo después de `paymentTarget`, con el mismo `replace()` sobre
--   `consulta_sql` que usa migration_shop_sale_customer.sql. Así no hay que
--   volver a pegar ~200 líneas de SQL y la versión nueva hereda cualquier
--   cambio que ya traiga la anterior.
--
--     /getNewStoreCashClosingV2   -> /getNewStoreCashClosingV3   (cierre nuevo)
--     /retrieveStoreCashClosingV3 -> /retrieveStoreCashClosingV4 (editar cierre)
--     /getStoreCashClosingV3      -> /getStoreCashClosingV4      (ver cierre)
--
--   `''paymentTarget'', ssp.payment_target,` aparece UNA sola vez en cada una
--   de las tres queries (verificado), así que el replace es puntual.
--
--   Nota: `creditPayments` NO sale del snapshot jsonb del cierre, se calcula en
--   vivo contra shop_sale_payment con el filtro de período. Por eso los cierres
--   ya guardados también muestran el comentario de los abonos que lo tengan.
-- #############################################################################
DELETE FROM public.sql_queries
WHERE "path" IN ('/getNewStoreCashClosingV3', '/retrieveStoreCashClosingV4', '/getStoreCashClosingV4');

-- getNewStoreCashClosingV3
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getNewStoreCashClosingV3','/getNewStoreCashClosingV3',
       replace(consulta_sql,
           '''paymentTarget'', ssp.payment_target,',
           '''paymentTarget'', ssp.payment_target,
				''comment'', ssp."comment",'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getNewStoreCashClosingV2';

-- retrieveStoreCashClosingV4
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'retrieveStoreCashClosingV4','/retrieveStoreCashClosingV4',
       replace(consulta_sql,
           '''paymentTarget'', ssp.payment_target,',
           '''paymentTarget'', ssp.payment_target,
				''comment'', ssp."comment",'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/retrieveStoreCashClosingV3';

-- getStoreCashClosingV4
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getStoreCashClosingV4','/getStoreCashClosingV4',
       replace(consulta_sql,
           '''paymentTarget'', ssp.payment_target,',
           '''paymentTarget'', ssp.payment_target,
				''comment'', ssp."comment",'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getStoreCashClosingV3';


-- #############################################################################
-- VERIFICACIÓN (opcional, correr después)
-- #############################################################################
-- SELECT "path" FROM public.sql_queries WHERE "path" LIKE '%ShopSalePayment%';
-- SELECT id, amount, "date", "comment", payment_target FROM shop_sale_payment ORDER BY "date" DESC LIMIT 20;
--
-- Las tres del cierre deben existir y traer ssp."comment":
-- SELECT "path", consulta_sql LIKE '%ssp."comment"%' AS trae_comment
--   FROM public.sql_queries
--  WHERE "path" IN ('/getNewStoreCashClosingV3','/retrieveStoreCashClosingV4','/getStoreCashClosingV4');
