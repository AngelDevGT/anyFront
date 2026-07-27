-- =============================================
-- CUSTOMER (Clientes) - DDL
-- =============================================

-- 1. Status para customer
--    La tabla status es serial4, por lo que los IDs se generan automaticamente.
--    Ejecutar estos INSERT y verificar los IDs resultantes; deben coincidir con
--    customerStatusValues en src/app/services/data/data.service.ts
--    (se asumieron 62 = Activo y 63 = Eliminado, siendo 61 el ultimo id ocupado).
INSERT INTO status (status, "name", "type", bg_color, color) VALUES (1, 'Activo',    'customer', '#d4edda', '#155724'); -- customerStatusValues.activo    (62)
INSERT INTO status (status, "name", "type", bg_color, color) VALUES (1, 'Eliminado', 'customer', '#f8d7da', '#721c24'); -- customerStatusValues.eliminado (63)

-- Para confirmar los IDs generados:
-- SELECT id, "name" FROM status WHERE "type" = 'customer' ORDER BY id;


-- 2. Tabla customer
CREATE TABLE customer (
    id              uuid         DEFAULT gen_random_uuid() NOT NULL,
    "name"          varchar(100) NOT NULL,
    phone           varchar(15)  NULL,
    email           varchar(100) NULL,
    nit             varchar(15)  NOT NULL DEFAULT 'C/F',
    status_id       int4         NOT NULL,
    creator_user_id uuid         NOT NULL,
    creation_date   timestamp    DEFAULT timezone('UTC'::text, CURRENT_TIMESTAMP) NOT NULL,
    updated_date    timestamp    NULL,
    CONSTRAINT customer_pkey PRIMARY KEY (id),
    CONSTRAINT customer_fk_status_id FOREIGN KEY (status_id) REFERENCES status(id),
    CONSTRAINT customer_fk_creator_user_id FOREIGN KEY (creator_user_id) REFERENCES "user"(id)
);

CREATE INDEX idx_customer_status ON customer(status_id);
CREATE INDEX idx_customer_nit    ON customer(nit);


-- =============================================
-- CUSTOMER - sql_queries (endpoints)
-- =============================================
-- Los endpoints POST no llevan WHERE: el backend lo construye a partir de las
-- llaves enviadas en el body usando el alias del wrapper (aqui "c").
-- Los endpoints PATCH usan parametros posicionales ($1, $2, ...).

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveCustomers','/retrieveCustomers','SELECT json_agg(
    json_build_object(
        ''id'', c.id,
        ''name'', c."name",
        ''phone'', c.phone,
        ''email'', c.email,
        ''nit'', c.nit,
        ''creationDate'', c.creation_date,
        ''updatedDate'', coalesce(c.updated_date, c.creation_date),
        ''status'', json_build_object(
            ''id'', s.id,
            ''identifier'', s."name",
            ''status'', s.status,
            ''bg_color'', s.bg_color,
            ''color'', s.color
        ),
        ''creatorUser'', json_build_object(
            ''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    ) ORDER BY c."name" ASC
) as json_result
FROM customer c
LEFT JOIN status s ON s.id = c.status_id
LEFT JOIN "user" u ON u.id = c.creator_user_id','customer','POST'),
	 ('getCustomer','/getCustomer','SELECT json_build_object(
        ''id'', c.id,
        ''name'', c."name",
        ''phone'', c.phone,
        ''email'', c.email,
        ''nit'', c.nit,
        ''creationDate'', c.creation_date,
        ''updatedDate'', coalesce(c.updated_date, c.creation_date),
        ''status'', json_build_object(
            ''id'', s.id,
            ''identifier'', s."name",
            ''status'', s.status,
            ''bg_color'', s.bg_color,
            ''color'', s.color
        ),
        ''creatorUser'', json_build_object(
            ''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    ) as json_result
FROM customer c
LEFT JOIN status s ON s.id = c.status_id
LEFT JOIN "user" u ON u.id = c.creator_user_id','customer','POST'),
	 ('addCustomer','/addCustomer','INSERT INTO customer ("name", phone, email, nit, status_id, creator_user_id)
VALUES (
    $1::varchar(100),
    nullif($2, '''')::varchar(15),
    nullif($3, '''')::varchar(100),
    coalesce(nullif($4, ''''), ''C/F'')::varchar(15),
    62,
    $5::uuid
)
RETURNING id','customer','PATCH'),
	 ('updateCustomer','/updateCustomer','UPDATE customer
SET "name" = $1::varchar(100),
    phone = nullif($2, '''')::varchar(15),
    email = nullif($3, '''')::varchar(100),
    nit = coalesce(nullif($4, ''''), ''C/F'')::varchar(15),
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
WHERE id = $5::uuid
RETURNING id','customer','PATCH'),
	 ('deleteCustomer','/deleteCustomer','UPDATE customer
SET status_id = 63,
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
WHERE id = $1::uuid
RETURNING id','customer','PATCH');


-- =============================================
-- CUSTOMER - Permisos de rutas (role.paths)
-- =============================================
-- El sidebar y el guard canActivateV2 filtran por role.paths. Agregar el patron
-- a los roles que deban ver el modulo (ejemplo: rol administrador).
-- Verificar primero el contenido actual:
--   SELECT id, "name", paths FROM "role";
--
-- UPDATE "role"
-- SET paths = (
--     paths::jsonb || '[{"matchPattern": "^\\/customers(\\/.*)?$"}]'::jsonb
-- )::text
-- WHERE id = 1;
