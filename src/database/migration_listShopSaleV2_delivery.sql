-- ============================================================
-- Migration: exponer el costo total de envío (delivery) en listShopSaleV2
-- Inyecta 'delivery', ss.delivery justo después de 'total', ss.total.
-- Idempotente: el guard NOT LIKE '%''delivery''%' evita duplicar.
-- Ejecutar una vez contra la base de datos en vivo.
-- ============================================================

UPDATE public.sql_queries
SET consulta_sql = replace(
        consulta_sql,
        '''total'', ss.total,',
        '''total'', ss.total,
        ''delivery'', ss.delivery,'
    )
WHERE "path" = '/listShopSaleV2'
  AND consulta_sql NOT LIKE '%''delivery''%';
