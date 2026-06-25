-- ============================================================
-- Migration: número de venta visible (correlativo POR TIENDA)
--
-- 1) Agrega shop_sale.sale_number. Cada establecimiento lleva su propia
--    numeración 1, 2, 3..., asignada automáticamente por un trigger atómico.
--    Numera las ventas existentes en orden cronológico por tienda.
-- 2) Hace que listShopSaleV2 y getShopSaleV2 devuelvan saleNumber.
--
-- Idempotente: se puede correr más de una vez sin duplicar efectos.
-- Ejecutar una vez contra la base de datos en vivo.
-- ============================================================

-- ── 1. Columna ──────────────────────────────────────────────
ALTER TABLE shop_sale ADD COLUMN IF NOT EXISTS sale_number bigint;

-- Limpieza por si se aplicó antes la variante de secuencia global
ALTER TABLE shop_sale ALTER COLUMN sale_number DROP DEFAULT;
DROP SEQUENCE IF EXISTS shop_sale_number_seq;

-- ── 2. Contador atómico por establecimiento ─────────────────
CREATE TABLE IF NOT EXISTS shop_sale_counter (
    establishment_id uuid PRIMARY KEY REFERENCES establishment(id),
    last_number bigint NOT NULL DEFAULT 0
);

-- ── 3. Backfill cronológico por tienda ──────────────────────
-- Solo numera las ventas que aún no tienen número; continúa desde el máximo
-- existente de cada tienda (idempotente ante corridas parciales).
WITH base AS (
    SELECT establishment_id, COALESCE(max(sale_number), 0) AS mx
    FROM shop_sale
    GROUP BY establishment_id
),
ordered AS (
    SELECT id, establishment_id,
           row_number() OVER (PARTITION BY establishment_id ORDER BY creation_date, id) AS rn
    FROM shop_sale
    WHERE sale_number IS NULL
)
UPDATE shop_sale ss
SET sale_number = o.rn + b.mx
FROM ordered o
JOIN base b ON b.establishment_id = o.establishment_id
WHERE ss.id = o.id;

-- ── 4. Inicializar contadores con el máximo actual por tienda ─
INSERT INTO shop_sale_counter (establishment_id, last_number)
SELECT establishment_id, max(sale_number)
FROM shop_sale
WHERE sale_number IS NOT NULL
GROUP BY establishment_id
ON CONFLICT (establishment_id)
DO UPDATE SET last_number = GREATEST(shop_sale_counter.last_number, EXCLUDED.last_number);

ALTER TABLE shop_sale ALTER COLUMN sale_number SET NOT NULL;

-- ── 5. Trigger: siguiente número de la tienda en cada inserción ─
CREATE OR REPLACE FUNCTION shop_sale_assign_number() RETURNS trigger AS $$
BEGIN
    IF NEW.sale_number IS NULL THEN
        INSERT INTO shop_sale_counter (establishment_id, last_number)
        VALUES (NEW.establishment_id, 1)
        ON CONFLICT (establishment_id)
        DO UPDATE SET last_number = shop_sale_counter.last_number + 1
        RETURNING last_number INTO NEW.sale_number;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shop_sale_assign_number ON shop_sale;
CREATE TRIGGER trg_shop_sale_assign_number
    BEFORE INSERT ON shop_sale
    FOR EACH ROW
    EXECUTE FUNCTION shop_sale_assign_number();

-- ── 6. Queries (inyecta saleNumber justo después de 'id', ss.id) ──
-- Se usa replace() para no reescribir la consulta completa.
-- El guard NOT LIKE '%saleNumber%' lo hace idempotente.
UPDATE public.sql_queries
SET consulta_sql = replace(
        consulta_sql,
        '''id'', ss.id,',
        '''id'', ss.id,
    ''saleNumber'', ss.sale_number,'
    )
WHERE "path" IN ('/getShopSaleV2', '/listShopSaleV2')
  AND consulta_sql NOT LIKE '%saleNumber%';
