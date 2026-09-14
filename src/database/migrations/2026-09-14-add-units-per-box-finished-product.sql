-- =============================================================================
-- Migración: unidades por cajilla en producto terminado (`units_per_box`)
-- Fecha: 2026-09-14
-- Ejecución: MANUAL. Correr en el Postgres de producción ANTES de desplegar el front.
--
-- Objetivo:
--   * Cada producto terminado (y abarrote) guarda cuántas unidades trae su
--     cajilla. Por defecto 240, el mismo factor de la medida global "Cajilla",
--     pero cada producto puede tener el suyo.
--   * El detalle y el listado de productos muestran el atributo.
--   * El inventario de producto para venta de tienda (/store/inventory/:id) lo
--     usa en las vistas "Docenas y unidades" y "Cajillas, docenas y unidades"
--     del selector de Unidad, que reparten la cantidad en varias columnas.
--
-- Enfoque 100% aditivo: NO se modifica ninguna query existente.
--   * La columna es NOT NULL DEFAULT 240: las filas actuales quedan con 240 y
--     /addFinishedProductV2 (insert genérico) toma el default cuando el payload
--     no manda `units_per_box`.
--   * Endpoints nuevos, clones de los que están en uso:
--       /getFinishedProductV3               <- /getFinishedProductV2               + unitsPerBox
--       /retrieveFinishedProductV4          <- /retrieveFinishedProductV3          + unitsPerBox
--       /updateFinishedProductV3            <- /updateFinishedProductV2            + units_per_box
--       /retrieveProductForSaleInventoryV4  <- /retrieveProductForSaleInventoryV2  + unitsPerBox
--       /retrieveProductForSaleInventoryV5  <- /retrieveProductForSaleInventoryV3  + unitsPerBox
--     La V2 de inventario la sigue usando la pantalla de venta de tienda.
--
-- ORDEN DE EJECUCIÓN:
--   PASO 1  -> ALTER (columna + check)                  [no rompe nada]
--   PASO 2  -> INSERT de las queries nuevas             [antes de desplegar el front]
-- =============================================================================


-- #############################################################################
-- PASO 1 — Columna nueva. El default rellena las filas existentes con 240.
-- #############################################################################
ALTER TABLE finished_product ADD COLUMN IF NOT EXISTS units_per_box int4 DEFAULT 240 NOT NULL;

-- ADD CONSTRAINT no tiene IF NOT EXISTS.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finished_product_units_per_box_check') THEN
        ALTER TABLE finished_product
            ADD CONSTRAINT finished_product_units_per_box_check CHECK (units_per_box > 0);
    END IF;
END $$;


-- #############################################################################
-- PASO 2 — Endpoints nuevos en sql_queries.
--
-- /updateFinishedProductV3: el orden de los parámetros posicionales es el de las
-- llaves del JSON que manda el front: name=$1, description=$2, photo=$3,
-- thumb=$4, units_per_box=$5, id=$6. Si $5 llega vacío vuelve al default 240.
-- #############################################################################
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('getFinishedProductV3','/getFinishedProductV3','SELECT json_build_object(
    ''id'', fp.id,
    ''name'', fp.name,
    ''description'', fp.description,
    ''photo'', fp.photo,
    ''thumb'', fp.thumb,
    ''creationDate'', fp.creation_date,
    ''updatedDate'', coalesce(fp.updated_date, fp.creation_date),
    ''finishedProductTypeId'', fp.finished_product_type_id,
    ''unitsPerBox'', fp.units_per_box,
    ''measure'', json_build_object(
        ''identifier'', ub.name,
        ''type'', ub."type"
    ),
    ''status'', json_build_object(
    	''id'', s.id,
    	''identifier'', s.name,
        ''name'', s.name,
        ''type'', s."type"
    ),
    ''creatorUser'', json_build_object(
    	''id'', u.id,
        ''name'', u.username,
        ''email'', u.email
    )
) as json_result
FROM finished_product fp
LEFT JOIN unit_base ub ON ub.id = fp.unit_base_id
LEFT JOIN status s ON s.id = fp.status_id
LEFT JOIN "user" u ON u.id = fp.creator_user_id','finished_product','POST'),
	 ('retrieveFinishedProductV4','/retrieveFinishedProductV4','SELECT json_agg(
    json_build_object(
        ''id'', fp.id,
        ''name'', fp.name,
        ''description'', fp.description,
        ''photo'', fp.photo,
        ''thumb'', fp.thumb,
        ''creationDate'', fp.creation_date,
        ''updatedDate'', coalesce(fp.updated_date, fp.creation_date),
        ''finishedProductTypeId'', fp.finished_product_type_id,
        ''sortOrder'', fp.sort_order,
        ''unitsPerBox'', fp.units_per_box,
        ''measure'', json_build_object(
            ''identifier'', ub.name,
            ''type'', ub."type"
        ),
        ''status'', json_build_object(
        	''id'', s.id,
        	''identifier'', s.name,
            ''name'', s.name,
            ''type'', s."type"
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    )
    ORDER BY fp.sort_order NULLS LAST, fp.creation_date
) as json_result
FROM finished_product fp
LEFT JOIN unit_base ub ON ub.id = fp.unit_base_id
LEFT JOIN status s ON s.id = fp.status_id
LEFT JOIN "user" u ON u.id = fp.creator_user_id','finished_product','POST'),
	 ('updateFinishedProductV3','/updateFinishedProductV3','UPDATE finished_product
SET name=$1, description=$2, photo=$3, thumb=$4, units_per_box=coalesce(nullif($5::text, '''')::int4, 240), updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
WHERE id=$6','finished_product','PATCH'),
	 ('retrieveProductForSaleInventoryV4','/retrieveProductForSaleInventoryV4','WITH inventory_elements_ordered AS (
    SELECT
        ie.inventory_id,
        ie.id AS ie_id,
        ie.element_type,
        ie.quantity,
        pfs.id AS pfs_id,
        pfs.price AS pfs_price,
        pfs.creation_date AS pfs_creation_date,
        pfs.sort_order AS pfs_sort_order,
        fp.id AS fp_id,
        fp.name AS fp_name,
        fp.photo AS fp_photo,
        fp.units_per_box AS fp_units_per_box,
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
                    ''finishedProduct'', json_build_object(
                        ''id'', oe.fp_id,
                        ''name'', oe.fp_name,
                        ''photo'', oe.fp_photo,
                        ''unitsPerBox'', oe.fp_units_per_box,
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
LEFT JOIN establishment e ON e.id::text = i.unit_name','inventory','POST'),
	 ('retrieveProductForSaleInventoryV5','/retrieveProductForSaleInventoryV5','WITH inventory_elements_ordered AS (
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
        fp.units_per_box AS fp_units_per_box,
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
                        ''unitsPerBox'', oe.fp_units_per_box,
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
--   SELECT id, name, units_per_box FROM finished_product ORDER BY name;
--
--   SELECT descripcion, "path" FROM sql_queries
--   WHERE "path" IN ('/getFinishedProductV3', '/retrieveFinishedProductV4', '/updateFinishedProductV3',
--                    '/retrieveProductForSaleInventoryV4', '/retrieveProductForSaleInventoryV5');
--
--   Y probar los endpoints:
--   POST  /getFinishedProductV3               { "fp": { "id": "<finished_product_id>" } }
--   POST  /retrieveProductForSaleInventoryV4  { "i": { "unit_name": "<establishment_id>" } }
-- #############################################################################
