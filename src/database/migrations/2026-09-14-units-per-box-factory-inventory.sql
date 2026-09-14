-- =============================================================================
-- Migración: unidades por cajilla en el INVENTARIO DE BODEGA de producto terminado
-- Fecha: 2026-09-14
-- Ejecución: MANUAL. Correr en el Postgres de producción ANTES de desplegar el front.
--
-- Depende de la columna `finished_product.units_per_box`, creada en
-- src/database/migrations/2026-09-14-add-units-per-box-finished-product.sql.
-- Si esa migración no se ha corrido, correrla primero.
--
-- Objetivo: que el inventario de bodega de productos y abarrotes
-- (/inventory/factory/finishedProduct y /inventory/factory/abarrote) tenga las
-- mismas vistas que el de tienda: "Cajilla" con la cajilla de cada producto y
-- "Docenas y unidades" / "Cajillas, docenas y unidades".
--
-- Enfoque 100% aditivo: NO se modifica ninguna query existente.
--   * /retrieveFinishedProductInventoryV3 queda intacta (la siguen usando el
--     formulario de pedidos de tienda y el resumen de administración).
--   * Se agrega /retrieveFinishedProductInventoryV4, clon exacto de la V3 con
--     ''unitsPerBox'' dentro de finishedProduct.
-- =============================================================================

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveFinishedProductInventoryV4','/retrieveFinishedProductInventoryV4','SELECT json_build_object(
    ''id'', i.id,
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', ie.id,
                ''element_type'', ie.element_type,
                ''creationDate'', ie.creation_date,
                ''quantity'', ie.quantity,
                ''status'', json_build_object(
                    ''identifier'', sie.name,
                    ''id'', sie.id
                ),
                ''measure'', json_build_object(
                    ''id'', m.id,
                    ''identifier'', m.name,
                    ''unitBase'', json_build_object(
                        ''quantity'', m.unit_base_quantity,
                        ''name'', ub.name,
                        ''id'', ub.id
                    )
                ),
                ''finishedProduct'', json_build_object(
                    ''id'', fp.id,
                    ''name'', fp.name,
                    ''photo'', fp.photo,
                    ''finishedProductTypeId'', fp.finished_product_type_id,
                    ''unitsPerBox'', fp.units_per_box,
                    ''status'', json_build_object(
                        ''id'', srm.id,
                        ''identifier'', srm.name
                    ),
                    ''measure'', json_build_object(
                        ''identifier'', ub2.name
                    )
                )
            )
            ORDER BY fp.sort_order NULLS LAST, fp.creation_date
        )
        FROM inventory_element ie
        LEFT JOIN status sie ON sie.id = ie.status_id
        LEFT JOIN measure m ON m.id = ie.measure_id
        LEFT JOIN unit_base ub ON ub.id = m.unit_base_id
        left JOIN finished_product fp ON fp.id = ie.element_fk
        left join unit_base ub2 on ub2.id = fp.unit_base_id
        LEFT JOIN status srm ON srm.id = fp.status_id
        WHERE ie.element_type = ''finished_product''
          AND ie.inventory_id = i.id
          AND fp.status_id <> 37
    )
) AS json_result
FROM inventory i
WHERE i.inventory_type = ''finished_product''','inventory','POST');


-- #############################################################################
-- VERIFICACIÓN
--   SELECT descripcion, "path" FROM sql_queries
--   WHERE "path" = '/retrieveFinishedProductInventoryV4';
--
--   Y probar el endpoint (cada finishedProduct debe traer unitsPerBox):
--   POST /retrieveFinishedProductInventoryV4  { "i": {} }
-- #############################################################################
