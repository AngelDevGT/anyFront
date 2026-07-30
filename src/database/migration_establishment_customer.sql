-- ============================================================
-- Migration: relación tienda ↔ cliente (establishment_customer)
--
-- 1) Tabla auxiliar con la tienda, el cliente, la fecha de asignación y el
--    usuario que asignó. Un cliente solo puede estar asignado una vez por
--    tienda (constraint UNIQUE).
-- 2) Endpoints:
--      /retrieveEstablishmentCustomers  -> clientes asignados a una tienda,
--         con datos de la asignación y el SALDO PENDIENTE del cliente en esa
--         tienda (pedido + envío de las ventas activas).
--      /addEstablishmentCustomer        -> asignar cliente a tienda
--      /deleteEstablishmentCustomer     -> quitar la asignación
--
-- A partir de esto, la venta de tienda solo ofrece los clientes asignados a
-- esa tienda.
--
-- Requiere customer.sql y migration_shop_sale_customer.sql ya ejecutados
-- (shop_sale.customer_id).
-- Idempotente: se puede correr más de una vez sin duplicar efectos.
-- ============================================================


-- ── 1. Tabla ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS establishment_customer (
    id               uuid      DEFAULT gen_random_uuid() NOT NULL,
    establishment_id uuid      NOT NULL,
    customer_id      uuid      NOT NULL,
    creator_user_id  uuid      NOT NULL,
    creation_date    timestamp DEFAULT timezone('UTC'::text, CURRENT_TIMESTAMP) NOT NULL,
    CONSTRAINT establishment_customer_pkey PRIMARY KEY (id),
    CONSTRAINT establishment_customer_unique UNIQUE (establishment_id, customer_id),
    CONSTRAINT establishment_customer_fk_establishment_id FOREIGN KEY (establishment_id) REFERENCES establishment(id),
    CONSTRAINT establishment_customer_fk_customer_id FOREIGN KEY (customer_id) REFERENCES customer(id),
    CONSTRAINT establishment_customer_fk_creator_user_id FOREIGN KEY (creator_user_id) REFERENCES "user"(id)
);

CREATE INDEX IF NOT EXISTS idx_establishment_customer_establishment ON establishment_customer(establishment_id);
CREATE INDEX IF NOT EXISTS idx_establishment_customer_customer     ON establishment_customer(customer_id);


-- ── 2. Endpoints ────────────────────────────────────────────
-- retrieveEstablishmentCustomers
-- Body: { "ec": { "establishment_id": "<uuid>" } }
-- El backend arma el WHERE con el alias del wrapper (ec), por eso la query
-- no lleva WHERE propio.
--
-- pendingBalance: saldo del cliente EN ESTA TIENDA. Suma pending_amount
-- (pedido) + delivery_pending_amount (envío) de las ventas activas
-- (status 52; las canceladas son 54). Ambas columnas ya vienen netas de los
-- abonos registrados en shop_sale_payment, así que una venta pagada aporta 0.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'retrieveEstablishmentCustomers','/retrieveEstablishmentCustomers','SELECT json_agg(
    json_build_object(
        ''id'', cu.id,
        ''assignmentId'', ec.id,
        ''name'', cu."name",
        ''phone'', cu.phone,
        ''email'', cu.email,
        ''nit'', cu.nit,
        ''assignmentDate'', ec.creation_date,
        ''assignedBy'', json_build_object(
            ''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        ),
        ''status'', json_build_object(
            ''id'', s.id,
            ''identifier'', s."name",
            ''status'', s.status,
            ''bg_color'', s.bg_color,
            ''color'', s.color
        ),
        ''pendingBalance'', COALESCE((
            SELECT SUM(ss.pending_amount + ss.delivery_pending_amount)
            FROM shop_sale ss
            WHERE ss.customer_id = cu.id
              AND ss.establishment_id = ec.establishment_id
              AND ss.status_id = 52
        ), 0),
        ''pendingSalesCount'', COALESCE((
            SELECT COUNT(*)
            FROM shop_sale ss
            WHERE ss.customer_id = cu.id
              AND ss.establishment_id = ec.establishment_id
              AND ss.status_id = 52
              AND (ss.pending_amount + ss.delivery_pending_amount) > 0
        ), 0)
    ) ORDER BY cu."name" ASC
) as json_result
FROM establishment_customer ec
JOIN customer cu ON cu.id = ec.customer_id
LEFT JOIN status s ON s.id = cu.status_id
LEFT JOIN "user" u ON u.id = ec.creator_user_id','establishment_customer','POST'
WHERE NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/retrieveEstablishmentCustomers');

-- addEstablishmentCustomer
-- $1 = establishment_id, $2 = customer_id, $3 = creator_user_id
-- ON CONFLICT: reasignar un cliente ya asignado no falla ni duplica.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'addEstablishmentCustomer','/addEstablishmentCustomer','INSERT INTO establishment_customer (establishment_id, customer_id, creator_user_id)
VALUES ($1::uuid, $2::uuid, $3::uuid)
ON CONFLICT (establishment_id, customer_id) DO NOTHING
RETURNING id','establishment_customer','PATCH'
WHERE NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/addEstablishmentCustomer');

-- deleteEstablishmentCustomer
-- $1 = establishment_customer.id
-- Quita solo la asignación: las ventas ya registradas conservan su
-- customer_id y su saldo pendiente.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'deleteEstablishmentCustomer','/deleteEstablishmentCustomer','DELETE FROM establishment_customer
WHERE id = $1::uuid
RETURNING id','establishment_customer','PATCH'
WHERE NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/deleteEstablishmentCustomer');


-- ── 3. Permisos de rutas (role.paths) ───────────────────────
-- Las dos vistas nuevas quedan detrás del guard canActivateV2:
--   /establishments/customers/:id  (Sistema > Tiendas > Clientes)
--   /store/customers/:id           (Tienda > Listado de tiendas > Clientes)
-- Si el patrón del rol para /establishments y /store ya es del tipo
-- "^\/establishments(\/.*)?$" no hay nada que hacer. Verificar con:
--   SELECT id, "name", paths FROM "role";


-- ── 4. Verificación ─────────────────────────────────────────
-- SELECT "path" FROM public.sql_queries
--  WHERE "path" IN ('/retrieveEstablishmentCustomers','/addEstablishmentCustomer','/deleteEstablishmentCustomer');
