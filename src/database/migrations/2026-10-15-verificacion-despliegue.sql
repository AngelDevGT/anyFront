-- =============================================================================
-- Verificación previa al despliegue del front de octubre 2026 (EMB-ANY-001 a 016)
-- Fecha: 2026-10-15
-- Ejecución: MANUAL. Es SOLO LECTURA: no crea ni modifica nada.
--
-- Esta tanda de cambios (008 a 014) no necesita ningún cambio en la base. Lo que el
-- front llama de más, viene de las migraciones que ya se corrieron:
--
--   2026-10-02-vender-pedidos-por-tienda.sql        (001)
--   2026-10-02-etiquetas-de-gastos-por-tienda.sql   (002, 009)
--   2026-10-02-venta-de-pedidos.sql                 (003, 005)
--   2026-10-02-recibir-y-vender-pedidos.sql         (004)
--   2026-10-08-costo-en-ventas.sql                  (015)
--   2026-10-16-fecha-creacion-listado-gastos.sql    (fecha de creación en el listado de gastos)
--
-- Este script confirma que esas piezas existen en ESTE ambiente. Si alguna fila sale
-- en FALTA, correr la migración que se indica en la columna "migracion" antes de
-- publicar el front: sin ella la pantalla correspondiente falla.
--
-- Se corren en el orden de la lista de arriba; la columna "migracion" dice cuál
-- crea cada cosa.
-- =============================================================================

WITH checks (orden, migracion, item, ok) AS (

    -- ── Columnas ────────────────────────────────────────────────────────────
    SELECT 1, '001 vender-pedidos-por-tienda', 'columna establishment.sell_orders_enabled',
           EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'establishment' AND column_name = 'sell_orders_enabled')
    UNION ALL
    SELECT 2, '002 etiquetas-de-gastos-por-tienda', 'columna establishment.expense_tags',
           EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'establishment' AND column_name = 'expense_tags')
    UNION ALL
    SELECT 3, '002 etiquetas-de-gastos-por-tienda', 'store_expense.title es text (sin tope de 40)',
           EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'store_expense' AND column_name = 'title' AND data_type = 'text')
    UNION ALL
    SELECT 4, '003 venta-de-pedidos', 'columna shop_sale.pfs_store_order_id',
           EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'shop_sale' AND column_name = 'pfs_store_order_id')
    UNION ALL
    SELECT 5, '015 costo-en-ventas', 'columna shop_sale_element.base_cost',
           EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'shop_sale_element' AND column_name = 'base_cost')
    UNION ALL
    SELECT 6, '015 costo-en-ventas', 'ya no existe shop_sale_element.total_cost (version descartada)',
           NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'shop_sale_element' AND column_name = 'total_cost')

    -- ── Procedures ──────────────────────────────────────────────────────────
    UNION ALL
    SELECT 7, '003 venta-de-pedidos', 'procedure register_shop_sale_with_elements_v8',
           EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'register_shop_sale_with_elements_v8')
    UNION ALL
    SELECT 8, '015 costo-en-ventas', 'procedure register_shop_sale_with_elements_v9 (copia base_cost)',
           EXISTS (SELECT 1 FROM pg_proc p
                    WHERE p.proname = 'register_shop_sale_with_elements_v9'
                      AND pg_get_functiondef(p.oid) LIKE '%base_cost%'
                      AND pg_get_functiondef(p.oid) NOT LIKE '%total_cost%')
    UNION ALL
    SELECT 9, '015 costo-en-ventas', 'procedure receive_and_sell_pfs_order_v2',
           EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'receive_and_sell_pfs_order_v2')

    -- ── Endpoints que llama el front (cada uno exactamente una vez) ─────────
    UNION ALL
    SELECT 10, '001 vender-pedidos-por-tienda', 'endpoint /updateEstablishmentV2',
           (SELECT count(*) FROM public.sql_queries WHERE "path" = '/updateEstablishmentV2') = 1
    UNION ALL
    SELECT 11, '002 etiquetas-de-gastos-por-tienda', 'endpoint /getEstablishmentV4 (trae sellOrdersEnabled y expenseTags)',
           EXISTS (SELECT 1 FROM public.sql_queries
                    WHERE "path" = '/getEstablishmentV4'
                      AND consulta_sql LIKE '%sellOrdersEnabled%'
                      AND consulta_sql LIKE '%expenseTags%')
           AND (SELECT count(*) FROM public.sql_queries WHERE "path" = '/getEstablishmentV4') = 1
    UNION ALL
    SELECT 12, '002 etiquetas-de-gastos-por-tienda', 'endpoint /updateEstablishmentExpenseTags',
           (SELECT count(*) FROM public.sql_queries WHERE "path" = '/updateEstablishmentExpenseTags') = 1
    UNION ALL
    SELECT 13, '003 venta-de-pedidos', 'endpoint /getProductForSaleStoreOrderV7 (trae shopSaleId y sellOrdersEnabled)',
           EXISTS (SELECT 1 FROM public.sql_queries
                    WHERE "path" = '/getProductForSaleStoreOrderV7'
                      AND consulta_sql LIKE '%shopSaleId%'
                      AND consulta_sql LIKE '%sellOrdersEnabled%')
           AND (SELECT count(*) FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderV7') = 1
    UNION ALL
    SELECT 14, '015 costo-en-ventas', 'endpoint /registerShopV9',
           (SELECT count(*) FROM public.sql_queries WHERE "path" = '/registerShopV9') = 1
    UNION ALL
    SELECT 15, '015 costo-en-ventas', 'endpoint /receiveAndSellPFSOrderV2',
           (SELECT count(*) FROM public.sql_queries WHERE "path" = '/receiveAndSellPFSOrderV2') = 1
    UNION ALL
    SELECT 16, '2026-10-16 fecha-creacion-listado-gastos', 'endpoint /listStoreExpenseV2 (trae creationDate)',
           EXISTS (SELECT 1 FROM public.sql_queries
                    WHERE "path" = '/listStoreExpenseV2' AND consulta_sql LIKE '%creationDate%')
           AND (SELECT count(*) FROM public.sql_queries WHERE "path" = '/listStoreExpenseV2') = 1
)
SELECT migracion,
       item,
       CASE WHEN ok THEN 'OK' ELSE 'FALTA' END AS estado
  FROM checks
 ORDER BY ok, orden;   -- las que faltan salen primero

-- Esperado: las 16 filas en OK.
-- Si el ambiente ya tiene ventas anteriores a 2026-10-08, además conviene confirmar que
-- todas quedaron con costo (0 esperado):
--
-- SELECT COUNT(*) AS lineas_sin_costo FROM shop_sale_element WHERE base_cost IS NULL;
