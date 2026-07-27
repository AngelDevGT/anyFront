-- =============================================================================
-- Migración: orden personalizado de entidades (campo `sort_order`)
-- Fecha: 2026-07-10
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Objetivo: permitir un orden fijo, definido por el usuario (drag & drop),
-- independiente de la fecha de creación/actualización, para:
--   * finished_product          (Productos y Abarrotes -> finished_product_type_id)
--   * product_for_sale          (orden POR TIENDA        -> establishment_id)
--   * raw_material              (Materia prima base)
--   * raw_material_by_provider  (Proveedor y Empaque     -> raw_material_by_provider_type_id)
--
-- Enfoque 100% aditivo: NO modifica ni una sola query/columna existente.
--   * Columnas `sort_order` nullable -> las queries actuales no se ven afectadas.
--   * Las queries nuevas llevan versión (V3 / V2) y endpoints nuevos; las
--     originales quedan intactas para no romper nada en producción.
--
-- ORDEN DE EJECUCIÓN:
--   PASO 1 -> ALTER (agregar columnas)                    [ejecutar YA, no rompe nada]
--   PASO 2 -> Backfill de sort_order de lo ya existente   [ejecutar tras el PASO 1]
--   PASO 3 -> INSERT de las queries/endpoints nuevos      [ejecutar antes de desplegar el front]
-- =============================================================================


-- #############################################################################
-- PASO 1 — Columnas nuevas (nullable => las queries actuales no se ven afectadas).
-- #############################################################################
ALTER TABLE finished_product         ADD COLUMN IF NOT EXISTS sort_order int4 NULL;
ALTER TABLE product_for_sale         ADD COLUMN IF NOT EXISTS sort_order int4 NULL;
ALTER TABLE raw_material             ADD COLUMN IF NOT EXISTS sort_order int4 NULL;
ALTER TABLE raw_material_by_provider ADD COLUMN IF NOT EXISTS sort_order int4 NULL;


-- #############################################################################
-- PASO 2 — Backfill: asigna un orden inicial a todo lo existente según su fecha
--          de creación, particionado por el "grupo" en que se lista cada entidad.
--          Sólo toca filas con sort_order IS NULL (idempotente / re-ejecutable).
-- #############################################################################

-- finished_product: un orden por tipo (1 = Productos, 2 = Abarrotes).
UPDATE finished_product fp
SET sort_order = sub.rn
FROM (
    SELECT id, (row_number() OVER (PARTITION BY finished_product_type_id ORDER BY creation_date, id) - 1) AS rn
    FROM finished_product
) sub
WHERE fp.id = sub.id AND fp.sort_order IS NULL;

-- product_for_sale: un orden por tienda (establishment_id).
UPDATE product_for_sale pfs
SET sort_order = sub.rn
FROM (
    SELECT id, (row_number() OVER (PARTITION BY establishment_id ORDER BY creation_date, id) - 1) AS rn
    FROM product_for_sale
) sub
WHERE pfs.id = sub.id AND pfs.sort_order IS NULL;

-- raw_material: un único orden global.
UPDATE raw_material rm
SET sort_order = sub.rn
FROM (
    SELECT id, (row_number() OVER (ORDER BY creation_date, id) - 1) AS rn
    FROM raw_material
) sub
WHERE rm.id = sub.id AND rm.sort_order IS NULL;

-- raw_material_by_provider: un orden por tipo (1 = Proveedor, 2 = Empaque).
UPDATE raw_material_by_provider rmbp
SET sort_order = sub.rn
FROM (
    SELECT id, (row_number() OVER (PARTITION BY raw_material_by_provider_type_id ORDER BY creation_date, id) - 1) AS rn
    FROM raw_material_by_provider
) sub
WHERE rmbp.id = sub.id AND rmbp.sort_order IS NULL;


-- #############################################################################
-- PASO 3 — Endpoints/queries nuevos (filas nuevas en la tabla de ruteo sql_queries).
--
--   3.A  Retrieves de catálogo con versión nueva: agregan `sortOrder` y ordenan
--        por sort_order (los NULL al final). Copias fieles de la última versión
--        de cada retrieve, sin tocar las originales.
--   3.B  Endpoints nuevos de guardado del orden (batch): reciben un arreglo JSON
--        [{ "id": "...uuid...", "sort_order": 0 }, ...] en $1 y lo persisten en
--        un solo UPDATE.
--   3.C  Retrieves de inventario con versión nueva: mismos datos que hoy pero
--        ordenados por sort_order, para que el orden se refleje en los inventarios.
-- #############################################################################

-- ---------------------------------------------------------------------------
-- 3.A  RETRIEVES DE CATÁLOGO (con sortOrder + ORDER BY sort_order)
-- ---------------------------------------------------------------------------
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveRawMaterialV3','/retrieveRawMaterialV3','SELECT json_agg(
    json_build_object(
        ''id'', rm.id,
        ''rm_id'', rm.id,
        ''name'', rm.name,
        ''photo'', rm.photo,
        ''thumb'', rm.thumb,
	    ''description'', rm.description,
	    ''creationDate'', rm.creation_date,
	    ''updatedDate'', coalesce(rm.updated_date, rm.creation_date),
        ''sortOrder'', rm.sort_order,
        ''measure'', json_build_object(
        	''id'', ub.id,
            ''identifier'', ub.name,
            ''type'', ub."type"
        ),
        ''status'', json_build_object(
        	''id'', s.id,
            ''name'', s.name,
            ''type'', s."type"
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    )
    ORDER BY rm.sort_order NULLS LAST, rm.creation_date
) as json_result
FROM raw_material rm
LEFT JOIN unit_base ub ON ub.id = rm.unit_base_id
LEFT JOIN status s ON s.id = rm.status_id
LEFT JOIN "user" u ON u.id = rm.creator_user_id','raw_material','POST'),

	 ('retrieveRawMaterialByProviderV2','/retrieveRawMaterialByProviderV2','SELECT json_agg(
    json_build_object(
        ''id'', rmbp.id,
        ''rawMaterialByProviderTypeId'', rmbp.raw_material_by_provider_type_id,
        ''price'', rmbp.price,
        ''updatedDate'', coalesce(rmbp.updated_date, rmbp.creation_date),
        ''creationDate'', rmbp.creation_date,
        ''sortOrder'', rmbp.sort_order,
        ''rawMaterialBase'', json_build_object(
        	''id'', rm.id,
            ''name'', rm.name,
            ''description'', rm.description,
            ''photo'', rm.photo,
            ''measure'', json_build_object(
                ''identifier'', ub.name,
                ''type'', ub."type"
            )
        ),
        ''status'', json_build_object(
        	''id'', s.id,
            ''identifier'', s.name,
            ''type'', s."type"
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        ),
        ''provider'', json_build_object(
        	''id'', p.id,
            ''name'', p.name,
            ''email'', p.email
        )
    )
    ORDER BY rmbp.sort_order NULLS LAST, rmbp.creation_date
) as json_result
FROM raw_material_by_provider rmbp
LEFT JOIN raw_material rm ON rmbp.raw_material_base_id = rm.id
LEFT JOIN unit_base ub ON rm.unit_base_id = ub.id
LEFT JOIN provider p ON p.id = rmbp.provider_id
LEFT JOIN status s ON s.id = rmbp.status_id
LEFT JOIN "user" u ON u.id = rmbp.creator_user_id','raw_material_by_provider','POST'),

	 ('retrieveFinishedProductV3','/retrieveFinishedProductV3','SELECT json_agg(
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

	 ('retrieveProductsForSaleV3','/retrieveProductsForSaleV3','WITH products_ordered AS (
    SELECT pfs1.id, pfs1.creation_date, pfs1.updated_date, pfs1.price, pfs1.sort_order,
           fp.id AS fp_id, fp.name AS fp_name, fp.photo, fp.thumb, fp.description,
           ub.name AS ub_name, ub."type" AS ub_type,
           s.name AS s_name, s.id as status_id, s."type" AS s_type,
           e.id AS establishment_id, e.name AS e_name
    FROM product_for_sale pfs1
    LEFT JOIN finished_product fp ON pfs1.finished_product_id = fp.id
    LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
    LEFT JOIN establishment e ON e.id = pfs1.establishment_id
    LEFT JOIN status s ON s.id = pfs1.status_id
)
SELECT json_agg(
    json_build_object(
        ''id'', pfs.id,
        ''creationDate'', pfs.creation_date,
        ''updatedDate'', coalesce(pfs.updated_date, pfs.creation_date),
        ''price'', pfs.price,
        ''sortOrder'', pfs.sort_order,
        ''finishedProduct'', json_build_object(
            ''id'', pfs.fp_id,
            ''name'', pfs.fp_name,
            ''photo'', pfs.photo,
            ''thumb'', pfs.thumb,
            ''description'', pfs.description,
            ''measure'', json_build_object(
                ''identifier'', pfs.ub_name,
                ''type'', pfs.ub_type
            )
        ),
        ''status'', json_build_object(
        	''id'', pfs.status_id,
            ''name'', pfs.s_name,
            ''type'', pfs.s_type
        ),
        ''establishment'', json_build_object(
            ''id'', pfs.establishment_id,
            ''name'', pfs.e_name
        )
    )
    ORDER BY pfs.sort_order NULLS LAST, pfs.creation_date
) AS json_result
FROM products_ordered pfs','product_for_sale','POST');


-- ---------------------------------------------------------------------------
-- 3.B  ENDPOINTS DE GUARDADO DEL ORDEN (batch por arreglo JSON en $1)
--       Payload esperado: $1 = ''[{"id":"<uuid>","sort_order":0}, ...]''
-- ---------------------------------------------------------------------------
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('updateFinishedProductSortOrder','/updateFinishedProductSortOrder','UPDATE finished_product AS fp
SET sort_order = v.sort_order
FROM jsonb_to_recordset($1::jsonb) AS v(id uuid, sort_order int)
WHERE fp.id = v.id','finished_product','PATCH'),

	 ('updateProductForSaleSortOrder','/updateProductForSaleSortOrder','UPDATE product_for_sale AS pfs
SET sort_order = v.sort_order
FROM jsonb_to_recordset($1::jsonb) AS v(id uuid, sort_order int)
WHERE pfs.id = v.id','product_for_sale','PATCH'),

	 ('updateRawMaterialSortOrder','/updateRawMaterialSortOrder','UPDATE raw_material AS rm
SET sort_order = v.sort_order
FROM jsonb_to_recordset($1::jsonb) AS v(id uuid, sort_order int)
WHERE rm.id = v.id','raw_material','PATCH'),

	 ('updateRawMaterialByProviderSortOrder','/updateRawMaterialByProviderSortOrder','UPDATE raw_material_by_provider AS rmbp
SET sort_order = v.sort_order
FROM jsonb_to_recordset($1::jsonb) AS v(id uuid, sort_order int)
WHERE rmbp.id = v.id','raw_material_by_provider','PATCH');


-- ---------------------------------------------------------------------------
-- 3.C  RETRIEVES DE INVENTARIO (versión nueva, ordenados por sort_order)
--       Mismos datos/forma que las versiones actuales; sólo cambia el orden.
--       Nota: los inventarios de bodega (materia prima / empaque) se ordenan por
--       raw_material.sort_order, ya que el inventory_element apunta a raw_material.
-- ---------------------------------------------------------------------------
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveFinishedProductInventoryV2','/retrieveFinishedProductInventoryV2','SELECT json_build_object(
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
    )
) AS json_result
FROM inventory i
WHERE i.inventory_type = ''finished_product''','inventory','POST'),

	 ('retrieveRawMaterialInventoryV2','/retrieveRawMaterialInventoryV2','SELECT json_build_object(
    ''id'', i.id,
    ''name'', i."name",
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''updatedDate'', i.updated_date,
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', ie.id,
                ''element_type'', ie.element_type,
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
                ''rawMaterialBase'', json_build_object(
                    ''id'', rm.id,
                    ''name'', rm.name,
                    ''photo'', rm.photo,
                    ''status'', json_build_object(
                        ''id'', srm.id,
                        ''identifier'', srm.name
                    ),
                    ''measure'', json_build_object(
                        ''identifier'', ub.name
                    )
                )
            )
            ORDER BY rm.sort_order NULLS LAST, rm.creation_date
        )
        FROM inventory_element ie
        LEFT JOIN status sie ON ie.status_id = sie.id
        LEFT JOIN measure m ON ie.measure_id = m.id
        LEFT JOIN unit_base ub ON m.unit_base_id = ub.id
        JOIN raw_material rm ON ie.element_fk = rm.id
        left join unit_base ub2 on ub2.id = rm.unit_base_id
        LEFT JOIN status srm ON srm.id = rm.status_id
        WHERE ie.element_type = ''raw_material''
          AND ie.inventory_id = i.id
    )
) as json_result
FROM inventory i
where i.inventory_type = ''raw_material''','inventory','POST'),

	 ('retrievePackagingMaterialInventoryV2','/retrievePackagingMaterialInventoryV2','SELECT json_build_object(
    ''id'', i.id,
    ''name'', i."name",
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''updatedDate'', i.updated_date,
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', ie.id,
                ''element_type'', ie.element_type,
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
                ''rawMaterialBase'', json_build_object(
                    ''id'', rm.id,
                    ''name'', rm.name,
                    ''photo'', rm.photo,
                    ''status'', json_build_object(
                        ''id'', srm.id,
                        ''identifier'', srm.name
                    ),
                    ''measure'', json_build_object(
                        ''identifier'', ub.name
                    )
                )
            )
            ORDER BY rm.sort_order NULLS LAST, rm.creation_date
        )
        FROM inventory_element ie
        LEFT JOIN status sie ON ie.status_id = sie.id
        LEFT JOIN measure m ON ie.measure_id = m.id
        LEFT JOIN unit_base ub ON m.unit_base_id = ub.id
        JOIN raw_material rm ON ie.element_fk = rm.id
        LEFT JOIN unit_base ub2 ON ub2.id = rm.unit_base_id
        LEFT JOIN status srm ON srm.id = rm.status_id
        WHERE ie.element_type = ''packaging_material''
          AND ie.inventory_id = i.id
          AND EXISTS (
              SELECT 1 FROM raw_material_by_provider rmbp
              WHERE rmbp.raw_material_base_id = rm.id
                AND rmbp.raw_material_by_provider_type_id = 2
                AND rmbp.status_id <> 35
          )
    )
) AS json_result
FROM inventory i
WHERE i.inventory_type = ''packaging_material''','inventory','POST'),

	 ('retrieveProductForSaleInventoryV2','/retrieveProductForSaleInventoryV2','WITH inventory_elements_ordered AS (
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

	 ('retrieveAllProductForSaleInventoryV2','/retrieveAllProductForSaleInventoryV2','WITH inventory_elements_ordered AS (
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
SELECT json_agg(
    json_build_object(
        ''id'', i.id,
        ''inventoryType'', i.inventory_type,
        ''unitName'', i.unit_name,
        ''creationDate'', i.creation_date,
        ''establishment'', json_build_object(
            ''id'', e.id,
            ''name'', e."name"
        ),
        ''inventoryElements'', (
            SELECT COALESCE(json_agg(
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
                            ''status'', json_build_object(
                                ''id'', oe.srm_id,
                                ''identifier'', oe.srm_name
                            ),
                            ''measure'', json_build_object(
                                ''identifier'', oe.ub_name
                            )
                        )
                    )
                ) ORDER BY oe.pfs_sort_order NULLS LAST, oe.pfs_creation_date ASC
            ), ''[]''::json)
            FROM inventory_elements_ordered oe
            WHERE oe.inventory_id = i.id
        )
    )
) AS json_result
FROM inventory i
INNER JOIN establishment e ON e.id::text = i.unit_name','inventory','POST');


-- =============================================================================
-- VERIFICACIÓN OPCIONAL (queries de lectura, no modifican nada):
--
--   -- Confirmar que las columnas existen:
--   SELECT table_name, column_name FROM information_schema.columns
--   WHERE column_name = 'sort_order'
--     AND table_name IN ('finished_product','product_for_sale','raw_material','raw_material_by_provider');
--
--   -- Confirmar que no quedaron filas sin orden:
--   SELECT count(*) FILTER (WHERE sort_order IS NULL) AS sin_orden, count(*) AS total FROM finished_product;
--   SELECT count(*) FILTER (WHERE sort_order IS NULL) AS sin_orden, count(*) AS total FROM product_for_sale;
--   SELECT count(*) FILTER (WHERE sort_order IS NULL) AS sin_orden, count(*) AS total FROM raw_material;
--   SELECT count(*) FILTER (WHERE sort_order IS NULL) AS sin_orden, count(*) AS total FROM raw_material_by_provider;
--
--   -- Confirmar que los endpoints nuevos quedaron registrados:
--   SELECT descripcion, "path" FROM public.sql_queries
--   WHERE "path" IN (
--     '/retrieveRawMaterialV3','/retrieveRawMaterialByProviderV2','/retrieveFinishedProductV3','/retrieveProductsForSaleV3',
--     '/updateFinishedProductSortOrder','/updateProductForSaleSortOrder','/updateRawMaterialSortOrder','/updateRawMaterialByProviderSortOrder',
--     '/retrieveFinishedProductInventoryV2','/retrieveRawMaterialInventoryV2','/retrievePackagingMaterialInventoryV2',
--     '/retrieveProductForSaleInventoryV2','/retrieveAllProductForSaleInventoryV2'
--   ) ORDER BY descripcion;
-- =============================================================================
