-- =============================================================================
-- Migración: "Historial de pagos" pasa a ser "Historial de ventas"
-- Fecha: 2026-08-26
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- La pantalla
--   Tienda > Listado de tiendas > Clientes > Historial de ventas
--   /store/customers/payments?store=<tienda>&customer=<cliente>
-- mostraba UNA FILA POR ABONO, y solo de las ventas al crédito
-- (ver 2026-08-19-historial-pagos-cliente.sql). Eso deja fuera:
--
--   * las ventas en efectivo, cheque o depósito del cliente, que nunca
--     generan un abono y por lo tanto no existían en la pantalla;
--   * las ventas al crédito que todavía no tienen ningún abono — justo las
--     que más importa ver, porque son las que deben completas.
--
-- Ahora la unidad de la tabla es LA VENTA: una fila por venta del cliente en
-- esa tienda, con el tipo de venta (Efectivo / Cheque / Depósito / Al crédito),
-- el total abonado acumulado y el saldo pendiente. El detalle abono por abono
-- sigue estando en "Ver venta".
--
-- ¿Por qué un endpoint nuevo y no modificar /retrieveCustomerCreditPayments?
--   Porque cambia la unidad de la fila: el anterior parte de shop_sale_payment
--   (JOIN, no LEFT JOIN) y por construcción no puede devolver una venta sin
--   abonos. Además la migración anterior ya está aplicada en producción y su
--   query no se toca — el enfoque de este repo es 100% aditivo.
--
-- ENFOQUE 100% ADITIVO: fila nueva en sql_queries. /retrieveCustomerCreditPayments
-- queda vivo e intacto.
--
-- SIN CAMBIOS DE PERMISOS: la ruta del front NO cambia
-- (/store/customers/payments), solo su título. Los role.paths que ya tienen
-- "^/store/customers/payments[^/]*$" siguen sirviendo tal cual.
-- =============================================================================


-- #############################################################################
-- PASO ÚNICO — /retrieveCustomerSalesHistory
--
-- El DELETE previo la hace idempotente: sql_queries no tiene unique en "path",
-- así que re-ejecutar sin él duplicaría la fila y el router podría resolver la
-- equivocada.
--
-- OJO: la query NO lleva WHERE de primer nivel. El backend lo arma a partir del
-- objeto que manda el front, que aquí es `ss`:
--
--   { "ss": { "establishment_id": "<uuid>", "customer_id": "<uuid>" } }
--
-- Por eso shop_sale tiene que ser la tabla del FROM, su alias tiene que seguir
-- siendo `ss` y principal_table tiene que seguir siendo shop_sale. Los WHERE
-- que sí aparecen están dentro de subconsultas escalares del SELECT, igual que
-- en /retrieveEstablishmentCustomers (migration_establishment_customer.sql):
-- el backend concatena su WHERE al final del statement y esos no le estorban.
--
-- Los agregados de abonos van como subconsulta escalar y no como JOIN + GROUP BY
-- a propósito: un GROUP BY al final del statement rompería el WHERE que el
-- backend concatena después, y un JOIN a shop_sale_payment multiplicaría la
-- venta por cada abono.
--
--   creditPaidAmount / creditPaymentsCount / lastCreditPaymentDate
--     Filtran is_sale_payment = false: el depósito que se registra junto con la
--     venta (2026-08-06-add-shop-sale-deposit-payment.sql) no es un abono. Sin
--     ese filtro una venta con depósito aparecería como si la hubieran abonado.
--
-- Las ventas canceladas (status 54) NO se excluyen a propósito: son parte del
-- historial y el front pinta su estado, así que el caso queda visible en lugar
-- de desaparecer. El front sí las deja fuera de los totales de "Total vendido".
--
-- deliveryPaymentType puede ser NULL en ventas anteriores al cobro de envío;
-- por eso el CASE, para no devolver un objeto con todos los campos en null.
--
-- ORDER BY dentro del json_agg: la venta más reciente primero.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/retrieveCustomerSalesHistory';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveCustomerSalesHistory','/retrieveCustomerSalesHistory','SELECT json_agg(
    json_build_object(
        ''id'', ss.id,
        ''saleNumber'', ss.sale_number,
        ''creationDate'', ss.creation_date,
        ''nota'', ss.nota,
        ''total'', ss.total,
        ''totalDiscount'', ss.total_discount,
        ''delivery'', ss.delivery,
        ''paidAmount'', ss.paid_amount,
        ''pendingAmount'', ss.pending_amount,
        ''deliveryPaidAmount'', ss.delivery_paid_amount,
        ''deliveryPendingAmount'', ss.delivery_pending_amount,
        ''creatorUser'', CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object(
            ''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        ) END,
        ''paymentType'', CASE WHEN pt.id IS NULL THEN NULL ELSE json_build_object(
            ''id'', pt.id,
            ''identifier'', pt."name"
        ) END,
        ''deliveryPaymentType'', CASE WHEN dpt.id IS NULL THEN NULL ELSE json_build_object(
            ''id'', dpt.id,
            ''identifier'', dpt."name"
        ) END,
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
        ),
        ''creditPaidAmount'', COALESCE((
            SELECT SUM(ssp.amount)
            FROM shop_sale_payment ssp
            WHERE ssp.shop_sale_id = ss.id
              AND ssp.is_sale_payment = false
        ), 0),
        ''creditPaymentsCount'', COALESCE((
            SELECT COUNT(*)
            FROM shop_sale_payment ssp
            WHERE ssp.shop_sale_id = ss.id
              AND ssp.is_sale_payment = false
        ), 0),
        ''lastCreditPaymentDate'', (
            SELECT MAX(ssp."date")
            FROM shop_sale_payment ssp
            WHERE ssp.shop_sale_id = ss.id
              AND ssp.is_sale_payment = false
        )
    ) ORDER BY ss.creation_date DESC
) AS json_result
FROM shop_sale ss
LEFT JOIN payment_type pt ON pt.id = ss.payment_type_id
LEFT JOIN payment_type dpt ON dpt.id = ss.delivery_payment_type_id
LEFT JOIN status s ON s.id = ss.status_id
LEFT JOIN status ps ON ps.id = ss.payment_status_id
LEFT JOIN status dps ON dps.id = ss.delivery_payment_status_id
LEFT JOIN "user" u ON u.id = ss.creator_user_id','shop_sale','POST');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- Debe existir una sola fila:
-- SELECT count(*) FROM public.sql_queries WHERE "path" = '/retrieveCustomerSalesHistory';
--
-- -- El endpoint anterior sigue vivo (lo usa nadie hoy, pero no se borra):
-- SELECT "path" FROM public.sql_queries WHERE "path" = '/retrieveCustomerCreditPayments';
--
-- -- Prueba con un cliente real (el front manda
-- --   {"ss": {"establishment_id": "...", "customer_id": "..."}}).
-- -- Contra la pantalla "Saldos de clientes": la suma de
-- --   pendingAmount + deliveryPendingAmount de las ventas con status 52
-- -- debe dar exactamente el pendingBalance de /retrieveEstablishmentCustomers.
-- --
-- -- Y para una venta al crédito concreta:
-- --   creditPaidAmount = paid_amount + delivery_paid_amount
-- -- salvo que la venta también haya tenido un depósito registrado al venderla.
-- #############################################################################
