-- =============================================================================
-- Migración: usuario que registra el abono de una venta al crédito
-- Fecha: 2026-08-11
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Objetivo: hoy shop_sale_payment guarda monto, tipo de pago, fecha y
-- comentario, pero NO quién registró el abono. El historial de la venta y el
-- detalle del cierre de caja muestran al usuario de shop_sale.creator_user_id,
-- o sea quién hizo la VENTA, no quién cobró. Si el abono lo recibe otra persona
-- (u otro turno), la pantalla está mintiendo.
--
-- Se agrega `creator_user_id` a shop_sale_payment y viaja desde el front igual
-- que en el resto del sistema (uuid del usuario logueado).
--
-- SOBRE EL DEPÓSITO REGISTRADO CON LA VENTA (is_sale_payment = true):
-- Esas filas las inserta register_shop_sale_with_elements_v5 con el mismo uuid
-- que va a shop_sale.creator_user_id, así que su usuario ya está guardado en la
-- venta y es exactamente el mismo. NO se clona la procedure de registro de
-- venta (la más crítica del sistema) solo para duplicar ese dato: el front usa
-- shopResume.creatorUser como fallback cuando el pago no trae usuario propio.
-- Las filas viejas (abonos anteriores a esta migración) quedan en NULL y caen
-- en ese mismo fallback, que es lo que ya se mostraba antes.
--
-- Enfoque 100% aditivo: NO modifica ninguna query/procedure en uso.
--   * Columna `creator_user_id` nullable -> los abonos ya registrados no se
--     afectan y ninguna query anterior cambia de comportamiento.
--   * Procedure nueva add_shop_sale_payment_v4 (la v3 queda intacta).
--   * Endpoints nuevos; los anteriores quedan vivos.
--
-- ORDEN DE EJECUCIÓN (una sola corrida, ANTES de desplegar el front nuevo):
--   PASO 1 -> ALTER: columna creator_user_id + FK
--   PASO 2 -> Procedure add_shop_sale_payment_v4
--   PASO 3 -> /addShopSalePaymentV5 y /getShopSalePaymentsV5
--   PASO 4 -> Queries del cierre de caja con el usuario en creditPayments
-- =============================================================================


-- #############################################################################
-- PASO 1 — ALTER: columna nueva, nullable.
--          Nullable a propósito: los abonos históricos no tienen usuario y un
--          NOT NULL los rompería. No lleva DEFAULT porque no hay un usuario
--          razonable con el cual rellenarlos.
-- #############################################################################
ALTER TABLE shop_sale_payment
    ADD COLUMN IF NOT EXISTS creator_user_id uuid NULL;

ALTER TABLE shop_sale_payment
    DROP CONSTRAINT IF EXISTS shop_sale_payment_fk_creator_user_id;
ALTER TABLE shop_sale_payment
    ADD CONSTRAINT shop_sale_payment_fk_creator_user_id
    FOREIGN KEY (creator_user_id) REFERENCES "user"(id);

COMMENT ON COLUMN shop_sale_payment.creator_user_id IS
    'Usuario que registró el abono. NULL en los abonos anteriores a 2026-08-11 y en el depósito registrado con la venta (ahí el usuario es shop_sale.creator_user_id).';


-- #############################################################################
-- PASO 2 — PROCEDURE add_shop_sale_payment_v4
--          Clon de add_shop_sale_payment_v3 + `_creator_user_id`, opcional y al
--          final de la firma para no alterar el orden de los parámetros que ya
--          usa la v3. Lo único que cambia en el cuerpo es la columna extra del
--          INSERT; el cálculo de montos y estados queda igual.
-- #############################################################################
CREATE OR REPLACE PROCEDURE public.add_shop_sale_payment_v4(
    IN _shop_sale_id uuid,
    IN _amount numeric,
    IN _payment_type_id integer,
    IN _payment_target varchar DEFAULT 'ORDER',
    IN _comment varchar DEFAULT NULL,
    IN _date timestamp DEFAULT NULL,
    IN _creator_user_id uuid DEFAULT NULL
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

        INSERT INTO shop_sale_payment (
            shop_sale_id, amount, payment_type_id, payment_target, "comment", "date", creator_user_id)
        VALUES (
            _shop_sale_id, _amount, _payment_type_id, _payment_target, _clean_comment, _payment_date, _creator_user_id);

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
--   addShopSalePaymentV5  -> escritura del abono con el usuario. $7 llega como
--                            texto: el nullif() lo deja en NULL si el front
--                            manda cadena vacía y la procedure aplica su
--                            default, igual que $5 y $6.
--   getShopSalePaymentsV5 -> igual que V4 + `creatorUser`, con la misma forma
--                            ({id, name, email}) que usa el resto del sistema.
--
--   OJO: la query no lleva WHERE. El backend arma el filtro desde el objeto
--   `ssp` que manda el front, así que el alias de shop_sale_payment DEBE
--   seguir siendo `ssp` y principal_table seguir siendo shop_sale_payment.
--
--   Los anteriores (/addShopSalePaymentV4, /getShopSalePaymentsV4) NO se tocan.
-- #############################################################################
DELETE FROM public.sql_queries WHERE "path" IN ('/addShopSalePaymentV5', '/getShopSalePaymentsV5');

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('addShopSalePaymentV5','/addShopSalePaymentV5','call add_shop_sale_payment_v4($1::uuid,$2::numeric,$3::int,$4,nullif($5::text,''''),nullif($6::text,'''')::timestamp,nullif($7::text,'''')::uuid)','shop_sale_payment','PATCH'),
	 ('getShopSalePaymentsV5','/getShopSalePaymentsV5','SELECT json_agg(
    json_build_object(
        ''id'', ssp.id,
        ''amount'', ssp.amount,
        ''date'', ssp.date,
        ''comment'', ssp."comment",
        ''isSalePayment'', ssp.is_sale_payment,
        ''paymentTarget'', ssp.payment_target,
        ''creatorUser'', CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object(
            ''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        ) END,
        ''paymentType'', json_build_object(
            ''id'', pt.id,
            ''identifier'', pt."name"
        )
    ) ORDER BY ssp.date ASC
) AS json_result
FROM shop_sale_payment ssp
LEFT JOIN payment_type pt ON pt.id = ssp.payment_type_id
LEFT JOIN "user" u ON u.id = ssp.creator_user_id','shop_sale_payment','POST');


-- #############################################################################
-- PASO 4 — CIERRE DE CAJA: quién cobró cada abono
--
--   El bloque `creditPayments` alimenta el detalle de "Pagos de Crédito" del
--   cierre. Se derivan versiones nuevas inyectando la clave `creatorUser` justo
--   después de `paymentTarget`, con el mismo replace() sobre `consulta_sql` que
--   usan las migrations anteriores.
--
--     /getNewStoreCashClosingV4   -> /getNewStoreCashClosingV5   (cierre nuevo)
--     /retrieveStoreCashClosingV5 -> /retrieveStoreCashClosingV6 (editar cierre)
--     /getStoreCashClosingV5      -> /getStoreCashClosingV6      (ver cierre)
--
--   Se usa una subquery escalar en lugar de un LEFT JOIN para no tener que
--   tocar el FROM del bloque: el replace() es una sola inyección puntual. Si
--   creator_user_id es NULL la subquery no devuelve fila y la clave queda en
--   NULL, que es justo lo que el front necesita para caer al fallback.
--
--   El ancla `''paymentTarget'', ssp.payment_target,` aparece UNA sola vez en
--   cada una de las tres queries (verificado): el bloque `payments` de cada
--   venta no la incluye.
-- #############################################################################
DELETE FROM public.sql_queries
WHERE "path" IN ('/getNewStoreCashClosingV5', '/retrieveStoreCashClosingV6', '/getStoreCashClosingV6');

-- getNewStoreCashClosingV5
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getNewStoreCashClosingV5','/getNewStoreCashClosingV5',
       replace(consulta_sql,
           '''paymentTarget'', ssp.payment_target,',
           '''paymentTarget'', ssp.payment_target,
			''creatorUser'', (SELECT json_build_object(''id'', u_ssp.id, ''name'', u_ssp.username, ''email'', u_ssp.email)
			                  FROM "user" u_ssp WHERE u_ssp.id = ssp.creator_user_id),'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getNewStoreCashClosingV4';

-- retrieveStoreCashClosingV6
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'retrieveStoreCashClosingV6','/retrieveStoreCashClosingV6',
       replace(consulta_sql,
           '''paymentTarget'', ssp.payment_target,',
           '''paymentTarget'', ssp.payment_target,
			''creatorUser'', (SELECT json_build_object(''id'', u_ssp.id, ''name'', u_ssp.username, ''email'', u_ssp.email)
			                  FROM "user" u_ssp WHERE u_ssp.id = ssp.creator_user_id),'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/retrieveStoreCashClosingV5';

-- getStoreCashClosingV6
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getStoreCashClosingV6','/getStoreCashClosingV6',
       replace(consulta_sql,
           '''paymentTarget'', ssp.payment_target,',
           '''paymentTarget'', ssp.payment_target,
			''creatorUser'', (SELECT json_build_object(''id'', u_ssp.id, ''name'', u_ssp.username, ''email'', u_ssp.email)
			                  FROM "user" u_ssp WHERE u_ssp.id = ssp.creator_user_id),'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getStoreCashClosingV5';


-- #############################################################################
-- VERIFICACIÓN (opcional, correr después)
-- #############################################################################
-- Los cinco endpoints nuevos deben existir:
-- SELECT "path" FROM public.sql_queries
--  WHERE "path" IN ('/addShopSalePaymentV5','/getShopSalePaymentsV5','/getNewStoreCashClosingV5',
--                   '/retrieveStoreCashClosingV6','/getStoreCashClosingV6');
--
-- Las tres del cierre deben traer el usuario (y solo una vez cada una):
-- SELECT "path", consulta_sql LIKE '%u_ssp.username%' AS trae_usuario
--   FROM public.sql_queries
--  WHERE "path" IN ('/getNewStoreCashClosingV5','/retrieveStoreCashClosingV6','/getStoreCashClosingV6');
--
-- Abonos con usuario ya registrado (después de desplegar el front):
-- SELECT ssp.id, ssp.amount, ssp."date", u.username
--   FROM shop_sale_payment ssp
--   LEFT JOIN "user" u ON u.id = ssp.creator_user_id
--  WHERE NOT ssp.is_sale_payment
--  ORDER BY ssp."date" DESC LIMIT 20;
