-- =============================================================================
-- Migración: costo del producto para venta en el INVENTARIO DE TIENDA
-- Fecha: 2026-08-04
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Objetivo: que el listado de inventario de producto para venta de tienda
-- (/store/inventory/:id) muestre una columna "Costo" además de "Precio",
-- visible únicamente para el rol Sistema (role.id = 1).
--
-- Depende de la columna `product_for_sale.cost`, creada en
-- src/database/migrations/2026-07-27-add-product-for-sale-cost.sql.
-- Si esa migración no se ha corrido, correrla primero.
--
-- Enfoque 100% aditivo: NO se modifica ninguna query existente.
--   * /retrieveProductForSaleInventoryV2 queda intacta (la sigue usando la
--     pantalla de venta de tienda y cualquier usuario no-Sistema).
--   * Se agrega /retrieveProductForSaleInventoryV3, clon exacto de la V2 con
--     ''cost'' añadido dentro de productForSale. El front solo la llama cuando
--     el usuario es Sistema, así el payload de un usuario de tienda no lleva
--     el costo.
--
--   IMPORTANTE: esto es ocultamiento, no control de acceso. El backend es
--   routing SQL puro, sin validación de rol, así que cualquier usuario
--   autenticado podría llamar el endpoint a mano. Enforzarlo de verdad
--   requeriría lógica de rol en la Function App.
-- =============================================================================

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveProductForSaleInventoryV3','/retrieveProductForSaleInventoryV3','WITH inventory_elements_ordered AS (
    SELECT
        ie.inventory_id,
        ie.id AS ie_id,
        ie.element_type,
        ie.quantity,
        pfs.id AS pfs_id,
        pfs.price AS pfs_price,
        pfs.cost AS pfs_cost,
        pfs.creation_date AS pfs_creation_date,
        pfs.sort_order AS pfs_sort_order,
        fp.id AS fp_id,
        fp.name AS fp_name,
        fp.photo AS fp_photo,
        m.id AS m_id,
        m.name AS m_name,
        m.unit_base_quantity,
        ub.id AS ub_id,
        ub.name AS ub_name,
        sie.id AS sie_id,
        sie.name AS sie_name,
        srm.id AS srm_id,
        srm.name AS srm_name
    FROM inventory_element ie
    JOIN product_for_sale pfs ON ie.element_fk = pfs.id
    LEFT JOIN finished_product fp ON fp.id = pfs.finished_product_id
    LEFT JOIN status sie ON sie.id = pfs.status_id
    LEFT JOIN measure m ON m.id = ie.measure_id
    LEFT JOIN unit_base ub ON ub.id = m.unit_base_id
    LEFT JOIN status srm ON srm.id = fp.status_id
    WHERE ie.element_type = ''product_for_sale''
      AND sie."name" = ''Activo''
)
SELECT json_build_object(
    ''id'', i.id,
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''establishment'', json_build_object(
        ''id'', e.id,
        ''name'', e."name"
    ),
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', oe.ie_id,
                ''element_type'', oe.element_type,
                ''quantity'', oe.quantity,
                ''status'', json_build_object(
                    ''identifier'', oe.sie_name,
                    ''id'', oe.sie_id
                ),
                ''measure'', json_build_object(
                    ''id'', oe.m_id,
                    ''identifier'', oe.m_name,
                    ''unitBase'', json_build_object(
                        ''quantity'', oe.unit_base_quantity,
                        ''name'', oe.ub_name,
                        ''id'', oe.ub_id
                    )
                ),
                ''productForSale'', json_build_object(
                    ''id'', oe.pfs_id,
                    ''price'', oe.pfs_price,
                    ''cost'', oe.pfs_cost,
                    ''finishedProduct'', json_build_object(
                        ''id'', oe.fp_id,
                        ''name'', oe.fp_name,
                        ''photo'', oe.fp_photo,
                        ''status'', json_build_object(
                            ''id'', oe.srm_id,
                            ''identifier'', oe.srm_name
                        ),
                        ''measure'', json_build_object(
                            ''identifier'', oe.ub_name
                        )
                    )
                )
            ) ORDER BY oe.pfs_sort_order NULLS LAST, oe.pfs_creation_date asc
        )
        FROM inventory_elements_ordered oe
        WHERE oe.inventory_id = i.id
    )
) AS json_result
FROM inventory i
LEFT JOIN establishment e ON e.id::text = i.unit_name','inventory','POST');


-- #############################################################################
-- VERIFICACIÓN
--   SELECT descripcion, "path" FROM sql_queries
--   WHERE "path" = '/retrieveProductForSaleInventoryV3';
--
--   Y probar el endpoint con el id de una tienda:
--   POST /retrieveProductForSaleInventoryV3  { "i": { "unit_name": "<establishment_id>" } }
-- #############################################################################
