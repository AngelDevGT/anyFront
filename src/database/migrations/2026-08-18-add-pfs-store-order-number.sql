-- =============================================================================
-- Migración: número de pedido visible (correlativo POR TIENDA)
-- Fecha: 2026-08-18
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Mismo mecanismo que ya usa shop_sale.sale_number
-- (ver src/database/migration_shop_sale_number.sql), ahora para los pedidos de
-- producto terminado / producto para venta (product_for_sale_store_order).
--
-- Cada establecimiento lleva su propia numeración 1, 2, 3... El número lo asigna
-- un trigger BEFORE INSERT contra una tabla contador, así que la asignación es
-- atómica: dos pedidos creados a la vez para la misma tienda no pueden quedarse
-- con el mismo número.
--
-- Es retroactivo: los pedidos existentes se numeran en orden cronológico dentro
-- de cada tienda antes de encender el trigger, igual que se hizo con las ventas.
--
-- Todos los pasos son re-ejecutables, así que si ya se corrió una vez se puede
-- correr el archivo completo de nuevo. Si solo se busca el guard de tienda NULL
-- que se agregó después de la primera corrida, alcanza con el PASO 5.
--
-- ENFOQUE 100% ADITIVO:
--   * La columna nace NULLable, se rellena y solo entonces pasa a NOT NULL.
--   * NINGUNA query ni procedure existente se modifica. Las 4 queries de lectura
--     se clonan a V2 con el campo nuevo; las V1 quedan vivas e intactas para
--     cualquier cliente que todavía no se haya desplegado.
--   * create_product_for_sale_order_with_elements NO se toca y NO necesita
--     versión nueva: el trigger asigna el número en el INSERT, venga de donde
--     venga. Es exactamente lo que se hizo con /registerShop y las ventas, que
--     nunca se versionó por el sale_number.
-- =============================================================================


-- #############################################################################
-- PASO 1 — Columna nueva en product_for_sale_store_order
--
-- Nace NULLable a propósito: el PASO 3 la rellena antes de exigirla.
-- #############################################################################

ALTER TABLE public.product_for_sale_store_order
    ADD COLUMN IF NOT EXISTS order_number bigint NULL;


-- #############################################################################
-- PASO 2 — Contador atómico por establecimiento
--
-- Una fila por tienda con el último número entregado. El INSERT ... ON CONFLICT
-- DO UPDATE del trigger (PASO 5) toma el lock de la fila, así que la secuencia
-- por tienda no se puede duplicar ni saltar bajo concurrencia.
-- #############################################################################

CREATE TABLE IF NOT EXISTS public.product_for_sale_store_order_counter (
    establishment_id uuid PRIMARY KEY REFERENCES establishment(id),
    last_number bigint NOT NULL DEFAULT 0
);


-- #############################################################################
-- PASO 3 — Backfill cronológico por tienda (RETROACTIVO)
--
-- Numera únicamente los pedidos que aún no tienen número y continúa desde el
-- máximo existente de cada tienda, así que es idempotente incluso si una
-- corrida anterior quedó a medias.
--
-- Se incluyen los pedidos eliminados/cancelados a propósito: el número es un
-- correlativo de creación, no un contador de pedidos vigentes. Saltarlos haría
-- que la numeración tuviera huecos invisibles para el usuario.
-- #############################################################################

WITH base AS (
    SELECT establishment_id, COALESCE(max(order_number), 0) AS mx
    FROM product_for_sale_store_order
    GROUP BY establishment_id
),
ordered AS (
    SELECT id, establishment_id,
           row_number() OVER (PARTITION BY establishment_id ORDER BY creation_date, id) AS rn
    FROM product_for_sale_store_order
    WHERE order_number IS NULL
)
UPDATE product_for_sale_store_order pfsso
SET order_number = o.rn + b.mx
FROM ordered o
JOIN base b ON b.establishment_id = o.establishment_id
WHERE pfsso.id = o.id;


-- #############################################################################
-- PASO 4 — Inicializar los contadores con el máximo actual por tienda
--
-- Sin esto el primer pedido nuevo de cada tienda arrancaría en 1 y chocaría con
-- lo que acaba de numerar el PASO 3.
-- #############################################################################

INSERT INTO public.product_for_sale_store_order_counter (establishment_id, last_number)
SELECT establishment_id, max(order_number)
FROM product_for_sale_store_order
WHERE order_number IS NOT NULL
GROUP BY establishment_id
ON CONFLICT (establishment_id)
DO UPDATE SET last_number = GREATEST(product_for_sale_store_order_counter.last_number, EXCLUDED.last_number);

-- Ya no quedan filas sin número y el trigger garantiza que no vuelvan a haberlas.
ALTER TABLE public.product_for_sale_store_order ALTER COLUMN order_number SET NOT NULL;


-- #############################################################################
-- PASO 5 — Trigger: siguiente número de la tienda en cada inserción
--
-- El guard "IF NEW.order_number IS NULL" permite insertar un número explícito
-- (migraciones, correcciones puntuales) sin que el trigger lo pise.
--
-- El guard de establishment_id NULL es igual de importante: los triggers BEFORE
-- corren ANTES de que se validen los NOT NULL de la tabla, así que un pedido que
-- llega sin tienda reventaría primero acá, con un
-- "null value in column establishment_id of relation
--  product_for_sale_store_order_counter", que apunta a la tabla equivocada y
-- manda a depurar el contador en vez del pedido. Devolviendo NEW sin tocar nada,
-- el error que sale es el correcto: el NOT NULL de
-- product_for_sale_store_order.establishment_id.
-- #############################################################################

CREATE OR REPLACE FUNCTION public.pfs_store_order_assign_number() RETURNS trigger AS $$
BEGIN
    IF NEW.establishment_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.order_number IS NULL THEN
        INSERT INTO product_for_sale_store_order_counter (establishment_id, last_number)
        VALUES (NEW.establishment_id, 1)
        ON CONFLICT (establishment_id)
        DO UPDATE SET last_number = product_for_sale_store_order_counter.last_number + 1
        RETURNING last_number INTO NEW.order_number;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pfs_store_order_assign_number ON public.product_for_sale_store_order;
CREATE TRIGGER trg_pfs_store_order_assign_number
    BEFORE INSERT ON public.product_for_sale_store_order
    FOR EACH ROW
    EXECUTE FUNCTION public.pfs_store_order_assign_number();


-- #############################################################################
-- PASO 6 — Endpoints nuevos: clones V2 de las 4 queries de lectura
--
-- Se derivan de la fila que está VIVA en producción con replace(), no de un
-- texto pegado a mano: así el clon arrastra cualquier cambio que la V1 tenga y
-- este archivo no pueda conocer.
--
-- El ancla es la primera clave de cada query, "'id', pfsso.id,". Aparece una
-- sola vez en las cuatro: el alias de los elementos es pfssoe, que no coincide.
--
-- El guard NOT EXISTS las hace idempotentes; sql_queries no tiene unique en
-- "path", así que re-ejecutar sin guard duplicaría filas y el router podría
-- resolver la equivocada.
-- #############################################################################

-- 6.1 Listado de pedidos (tabla de tienda y de fábrica)
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'listProductForSaleStoreOrderV2','/listProductForSaleStoreOrderV2',
       replace(consulta_sql,
           '''id'', pfsso.id,',
           '''id'', pfsso.id,
        ''orderNumber'', pfsso.order_number,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/listProductForSaleStoreOrder'
  AND consulta_sql LIKE '%''id'', pfsso.id,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/listProductForSaleStoreOrderV2');

-- 6.2 Detalle del pedido (vista Ver pedido)
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getProductForSaleStoreOrderV2','/getProductForSaleStoreOrderV2',
       replace(consulta_sql,
           '''id'', pfsso.id,',
           '''id'', pfsso.id,
    ''orderNumber'', pfsso.order_number,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getProductForSaleStoreOrder'
  AND consulta_sql LIKE '%''id'', pfsso.id,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderV2');

-- 6.3 Listado del tablero de bodega
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'listProductForSaleStoreOrderBoardV2','/listProductForSaleStoreOrderBoardV2',
       replace(consulta_sql,
           '''id'', pfsso.id,',
           '''id'', pfsso.id,
        ''orderNumber'', pfsso.order_number,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/listProductForSaleStoreOrderBoard'
  AND consulta_sql LIKE '%''id'', pfsso.id,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/listProductForSaleStoreOrderBoardV2');

-- 6.4 Detalle reducido para el PDF
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getProductForSaleStoreOrderForPdfV2','/getProductForSaleStoreOrderForPdfV2',
       replace(consulta_sql,
           '''id'', pfsso.id,',
           '''id'', pfsso.id,
    ''orderNumber'', pfsso.order_number,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getProductForSaleStoreOrderForPdf'
  AND consulta_sql LIKE '%''id'', pfsso.id,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderForPdfV2');


-- #############################################################################
-- PASO 7 (OPCIONAL) — Unique index por tienda
--
-- El trigger ya garantiza la unicidad; esto es una red de seguridad ante un
-- INSERT manual con número explícito. Va al final a propósito: si por lo que
-- sea hubiera duplicados, falla aquí y no deja la migración a medias.
--
-- Si falla, revisar con:
--   SELECT establishment_id, order_number, count(*)
--     FROM product_for_sale_store_order
--    GROUP BY 1,2 HAVING count(*) > 1;
-- #############################################################################

CREATE UNIQUE INDEX IF NOT EXISTS idx_pfsso_establishment_order_number
    ON public.product_for_sale_store_order (establishment_id, order_number);


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- La columna existe y ya no admite NULL
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'product_for_sale_store_order'
--    AND column_name = 'order_number';
--
-- -- Ningún pedido sin número
-- SELECT count(*) FROM product_for_sale_store_order WHERE order_number IS NULL;
--
-- -- La numeración por tienda es 1..N sin huecos ni repetidos
-- SELECT establishment_id, count(*) AS pedidos, min(order_number), max(order_number),
--        count(DISTINCT order_number) AS distintos
--   FROM product_for_sale_store_order
--  GROUP BY establishment_id;
--
-- -- El contador quedó alineado con el máximo real
-- SELECT c.establishment_id, c.last_number, max(o.order_number) AS max_real
--   FROM product_for_sale_store_order_counter c
--   LEFT JOIN product_for_sale_store_order o ON o.establishment_id = c.establishment_id
--  GROUP BY c.establishment_id, c.last_number;
--
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trg_pfs_store_order_assign_number';
--
-- SELECT "path" FROM sql_queries
--  WHERE "path" IN ('/listProductForSaleStoreOrderV2',
--                   '/getProductForSaleStoreOrderV2',
--                   '/listProductForSaleStoreOrderBoardV2',
--                   '/getProductForSaleStoreOrderForPdfV2');
--
-- -- Las V2 traen orderNumber y las V1 siguen sin él
-- SELECT "path", consulta_sql LIKE '%orderNumber%' AS trae_numero
--   FROM sql_queries
--  WHERE "path" LIKE '/%ProductForSaleStoreOrder%'
--  ORDER BY "path";
-- #############################################################################
