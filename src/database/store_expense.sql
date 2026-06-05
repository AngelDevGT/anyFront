-- =============================================
-- STORE EXPENSE - DDL
-- =============================================

-- 1. Insert status entries for store_expense
--    Adjust the IDs to match the next available IDs in your status table.
INSERT INTO status (identifier, bg_color, color) VALUES ('Activo',   '#d4edda', '#155724'); -- use this id as storeExpenseStatusValues.activo
INSERT INTO status (identifier, bg_color, color) VALUES ('Eliminado','#f8d7da', '#721c24'); -- use this id as storeExpenseStatusValues.eliminado

-- 2. Create store_expense table
CREATE TABLE store_expense (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title             VARCHAR(40)  NOT NULL,
    comment           VARCHAR(100),
    total_amount      NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    nit               VARCHAR(10)  NOT NULL DEFAULT 'C/F',
    supplier          VARCHAR(20),
    establishment_fk  INTEGER      NOT NULL REFERENCES establishment(id),
    status_fk         INTEGER      NOT NULL REFERENCES status(id),
    creator_user_fk   UUID         REFERENCES "user"(id),
    creation_date     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_date      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_store_expense_establishment ON store_expense(establishment_fk);
CREATE INDEX idx_store_expense_status        ON store_expense(status_fk);


-- =============================================
-- STORE EXPENSE - SQL QUERIES (para sql_queries)
-- =============================================
-- Reemplaza <STATUS_ACTIVO_ID> y <STATUS_ELIMINADO_ID> con los IDs reales
-- insertados en el paso 1 (o los ya existentes en tu tabla status).

-- LIST: Listar gastos de una tienda
-- Endpoint: POST /listStoreExpense
-- Body esperado: { "se": { "establishment_id": "<id>" } }
-- Query:
/*
SELECT json_agg(t ORDER BY t.updated_date DESC) AS json_result
FROM (
    SELECT
        se.id,
        se.title,
        se.comment,
        se.total_amount,
        se.nit,
        se.supplier,
        se.creation_date,
        se.updated_date,
        json_build_object(
            'id',         s.id,
            'identifier', s.identifier,
            'bg_color',   s.bg_color,
            'color',      s.color
        ) AS status,
        json_build_object(
            'id',   e.id,
            'name', e.name
        ) AS establishment,
        json_build_object(
            'id',   u.id,
            'name', u.name
        ) AS creator_user
    FROM store_expense se
    LEFT JOIN status      s ON s.id = se.status_fk
    LEFT JOIN establishment e ON e.id = se.establishment_fk
    LEFT JOIN "user"      u ON u.id  = se.creator_user_fk
    WHERE se.establishment_fk = ($1->>'establishment_id')::INTEGER
      AND se.status_fk != <STATUS_ELIMINADO_ID>
) t
*/


-- GET: Obtener un gasto por ID
-- Endpoint: POST /getStoreExpense
-- Body esperado: { "se": { "id": "<uuid>" } }
-- Query:
/*
SELECT row_to_json(t) AS json_result
FROM (
    SELECT
        se.id,
        se.title,
        se.comment,
        se.total_amount,
        se.nit,
        se.supplier,
        se.creation_date,
        se.updated_date,
        json_build_object(
            'id',         s.id,
            'identifier', s.identifier,
            'bg_color',   s.bg_color,
            'color',      s.color
        ) AS status,
        json_build_object(
            'id',   e.id,
            'name', e.name
        ) AS establishment,
        json_build_object(
            'id',   u.id,
            'name', u.name
        ) AS creator_user
    FROM store_expense se
    LEFT JOIN status       s ON s.id = se.status_fk
    LEFT JOIN establishment e ON e.id = se.establishment_fk
    LEFT JOIN "user"       u ON u.id  = se.creator_user_fk
    WHERE se.id = ($1->>'id')::UUID
) t
*/


-- ADD: Registrar nuevo gasto
-- Endpoint: PATCH /addStoreExpense
-- Body posicional: $1=title, $2=comment, $3=total_amount, $4=nit, $5=supplier, $6=establishment_id, $7=creator_user_uuid
-- Query:
/*
INSERT INTO store_expense (title, comment, total_amount, nit, supplier, establishment_fk, status_fk, creator_user_fk)
VALUES (
    $1::VARCHAR(40),
    $2::VARCHAR(100),
    $3::NUMERIC(10,2),
    COALESCE(NULLIF($4, ''), 'C/F')::VARCHAR(10),
    $5::VARCHAR(20),
    $6::INTEGER,
    <STATUS_ACTIVO_ID>,
    $7::UUID
)
RETURNING id
*/


-- UPDATE: Actualizar gasto existente
-- Endpoint: PATCH /updateStoreExpense
-- Body posicional: $1=title, $2=comment, $3=total_amount, $4=nit, $5=supplier, $6=id
-- Query:
/*
UPDATE store_expense
SET
    title        = $1::VARCHAR(40),
    comment      = $2::VARCHAR(100),
    total_amount = $3::NUMERIC(10,2),
    nit          = COALESCE(NULLIF($4, ''), 'C/F')::VARCHAR(10),
    supplier     = $5::VARCHAR(20),
    updated_date = NOW()
WHERE id = $6::UUID
RETURNING id
*/


-- DELETE (soft): Marcar gasto como eliminado
-- Endpoint: PATCH /deleteStoreExpense
-- Body posicional: $1=id
-- Query:
/*
UPDATE store_expense
SET
    status_fk    = <STATUS_ELIMINADO_ID>,
    updated_date = NOW()
WHERE id = $1::UUID
RETURNING id
*/
