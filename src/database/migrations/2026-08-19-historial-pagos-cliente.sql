-- =============================================================================
-- Migración: historial de pagos (abonos) de un cliente en una tienda
-- Fecha: 2026-08-19
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- La pantalla "Saldos de clientes" (/store/customers/:id) muestra cuánto debe
-- cada cliente, pero no cómo llegó a ese saldo. Esta migración agrega el
-- endpoint que alimenta la vista nueva:
--
--   Tienda > Listado de tiendas > Clientes > Historial de pagos
--   /store/customers/payments?store=<tienda>&customer=<cliente>
--
-- Una fila por ABONO, con los datos de la venta al crédito a la que pertenece
-- (fecha, monto, correlativo y estado ACTUAL de pago), para poder navegar
-- desde el abono hacia la venta.
--
-- ¿Por qué no reutilizar /getShopSalePaymentsV5?
--   Esa query filtra por el alias `ssp` (shop_sale_payment), o sea por UNA
--   venta, y no expone nada de la venta. Aquí se necesita filtrar por cliente
--   + tienda, que son columnas de shop_sale, y devolver la venta anidada.
--
-- ENFOQUE 100% ADITIVO: fila nueva en sql_queries. No se toca ninguna query ni
-- procedure existente. /getShopSalePaymentsV5 sigue sirviendo a "Ver venta".
-- =============================================================================


-- #############################################################################
-- PASO 1 — /retrieveCustomerCreditPayments
--
-- El DELETE previo la hace idempotente: sql_queries no tiene unique en "path",
-- así que re-ejecutar sin él duplicaría la fila y el router podría resolver la
-- equivocada.
--
-- OJO: la query NO lleva WHERE. El backend lo arma a partir del objeto que
-- manda el front, que aquí es `ss`:
--
--   { "ss": { "establishment_id": "<uuid>", "customer_id": "<uuid>" } }
--
-- Por eso shop_sale tiene que ser la tabla del FROM, su alias tiene que seguir
-- siendo `ss` y principal_table tiene que seguir siendo shop_sale.
--
-- Como no se puede escribir un WHERE propio, el único filtro fijo va en el ON
-- del JOIN: `ssp.is_sale_payment = false` deja fuera el depósito que se
-- registra junto con la venta (ver 2026-08-06-add-shop-sale-deposit-payment.sql).
-- Esa fila no es un abono de crédito y contarla inflaría el historial.
--
-- Las ventas canceladas (status 54) NO se excluyen a propósito: el dinero se
-- recibió y el abono es parte del historial. El front pinta el estado de la
-- venta, así que el caso queda visible en lugar de desaparecer.
--
-- Se devuelven pendingAmount / deliveryPendingAmount por venta aunque el
-- indicador de saldo del cliente lo tome de /retrieveEstablishmentCustomers:
-- sirven para ver qué venta sigue debiendo sin pedir el detalle.
--
-- ORDER BY dentro del json_agg: el más reciente primero.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/retrieveCustomerCreditPayments';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveCustomerCreditPayments','/retrieveCustomerCreditPayments','SELECT json_agg(
    json_build_object(
        ''id'', ssp.id,
        ''amount'', ssp.amount,
        ''date'', ssp."date",
        ''comment'', ssp."comment",
        ''paymentTarget'', ssp.payment_target,
        ''creatorUser'', CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object(
            ''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        ) END,
        ''paymentType'', json_build_object(
            ''id'', pt.id,
            ''identifier'', pt."name"
        ),
        ''sale'', json_build_object(
            ''id'', ss.id,
            ''saleNumber'', ss.sale_number,
            ''creationDate'', ss.creation_date,
            ''total'', ss.total,
            ''delivery'', ss.delivery,
            ''pendingAmount'', ss.pending_amount,
            ''deliveryPendingAmount'', ss.delivery_pending_amount,
            ''status'', json_build_object(
                ''id'', s.id,
                ''identifier'', s."name",
                ''bg_color'', s.bg_color,
                ''color'', s.color
            ),
            ''paymentStatus'', json_build_object(
                ''id'', ps.id,
                ''identifier'', ps."name",
                ''bg_color'', ps.bg_color,
                ''color'', ps.color
            ),
            ''deliveryPaymentStatus'', json_build_object(
                ''id'', dps.id,
                ''identifier'', dps."name",
                ''bg_color'', dps.bg_color,
                ''color'', dps.color
            )
        )
    ) ORDER BY ssp."date" DESC
) AS json_result
FROM shop_sale ss
JOIN shop_sale_payment ssp ON ssp.shop_sale_id = ss.id AND ssp.is_sale_payment = false
LEFT JOIN payment_type pt ON pt.id = ssp.payment_type_id
LEFT JOIN status s ON s.id = ss.status_id
LEFT JOIN status ps ON ps.id = ss.payment_status_id
LEFT JOIN status dps ON dps.id = ss.delivery_payment_status_id
LEFT JOIN "user" u ON u.id = ssp.creator_user_id','shop_sale','POST');


-- #############################################################################
-- PASO 2 — PERMISOS DE RUTA (role.paths)
--
-- La ruta nueva es estática y sus ids viajan como query params:
--   /store/customers/payments?store=<tienda>&customer=<cliente>
--
-- El guard evalúa el regex contra state.url, que INCLUYE el query string, por
-- eso el patrón no puede cerrar con "$" justo después de payments. Se sigue la
-- convención que ya usan /store/sales/create y /productsForSale: "[^/]*$", que
-- acepta el "?store=...&customer=..." porque no lleva barras.
--
-- Entrada a agregar a role.paths de los roles que deban verla:
--   {
--     "name": "/store/customers/payments",
--     "route": "/store/customers/payments",
--     "matchPattern": "^/store/customers/payments[^/]*$"
--   }
--
-- OJO: la entrada de "Saldos de clientes" ("^/store/customers/[^/]*$") NO
-- alcanza — no matchea la ruta nueva. Verificar el estado actual con:
--   SELECT id, "name", jsonb_pretty(paths::jsonb) FROM "role" ORDER BY id;
--
-- UPDATE idempotente (ajustar el IN con los roles que corresponda):
--
-- UPDATE "role"
-- SET paths = (
--     paths::jsonb || '[{"name": "/store/customers/payments",
--                        "route": "/store/customers/payments",
--                        "matchPattern": "^/store/customers/payments[^/]*$"}]'::jsonb
-- )::text
-- WHERE id IN (1)
--   AND NOT paths::jsonb @> '[{"matchPattern": "^/store/customers/payments[^/]*$"}]'::jsonb;
-- #############################################################################


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- SELECT "path" FROM public.sql_queries WHERE "path" = '/retrieveCustomerCreditPayments';
--
-- -- Debe existir una sola fila y no tener WHERE propio:
-- SELECT count(*) AS filas,
--        bool_or(consulta_sql ILIKE '%where%') AS trae_where
--   FROM public.sql_queries
--  WHERE "path" = '/retrieveCustomerCreditPayments';
--
-- -- Prueba con un cliente real (el front manda
-- --   {"ss": {"establishment_id": "...", "customer_id": "..."}}).
-- -- La suma de los abonos de una venta debe cuadrar con su paid_amount +
-- -- delivery_paid_amount, menos el depósito si la venta lo tuvo.
-- #############################################################################
