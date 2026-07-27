-- =============================================================================
-- Migración: soporte de thumbnails (campo `thumb`)
-- Fecha: 2026-07-06
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Enfoque 100% aditivo: NO modifica ni una sola query/columna existente.
--   * Columnas nullable -> las queries actuales no se ven afectadas.
--   * product_for_sale NO lleva columna: hereda el thumb de finished_product.
--
-- ORDEN DE EJECUCIÓN:
--   PASO 1  -> ALTER (agregar columnas)                 [ejecutar YA, no rompe nada]
--   PASO 2  -> INSERT de las queries V2 en sql_queries  [ejecutar antes de desplegar el front]
--   PASO 3  -> UPDATE que puebla `thumb`                [ejecutar DESPUÉS del script de blobs]
-- =============================================================================


-- #############################################################################
-- PASO 1 — Columnas nuevas (nullable => las queries actuales no se ven afectadas).
-- #############################################################################
ALTER TABLE raw_material     ADD COLUMN IF NOT EXISTS thumb text NULL;
ALTER TABLE finished_product ADD COLUMN IF NOT EXISTS thumb text NULL;


-- #############################################################################
-- PASO 2 — Endpoints/queries V2 (filas nuevas en la tabla de ruteo sql_queries).
--          Copias de las queries de imagen agregando el campo `thumb`.
--          Las filas originales (addRawMaterial, UpdateRawMaterial, etc.) quedan intactas.
-- #############################################################################
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('addRawMaterialV2','/addRawMaterialV2','insert into raw_material','raw_material','PUT'),
	 ('UpdateRawMaterialV2','/UpdateRawMaterialV2','update raw_material
set name = $1, description = $2, photo = $3, thumb = $4, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $5','raw_material','PATCH'),
	 ('getRawMaterialV2','/getRawMaterialV2','select json_build_object(
    ''id'', rm.id,
    ''rm_id'', rm.id,
    ''name'', rm.name,
    ''photo'', rm.photo,
    ''thumb'', rm.thumb,
    ''description'', rm.description,
    ''creationDate'', rm.creation_date,
    ''updatedDate'', coalesce(rm.updated_date, rm.creation_date),
    ''measure'', json_build_object(
    	''id'', ub.id,
        ''identifier'', ub.name,
        ''type'', ub."type"
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
    )
) as json_result
FROM raw_material rm
LEFT JOIN unit_base ub ON ub.id = rm.unit_base_id
LEFT JOIN status s ON s.id = rm.status_id
LEFT JOIN "user" u ON u.id = rm.creator_user_id','raw_material','POST'),
	 ('retrieveRawMaterialV2','/retrieveRawMaterialV2','SELECT json_agg(
    json_build_object(
        ''id'', rm.id,
        ''rm_id'', rm.id,
        ''name'', rm.name,
        ''photo'', rm.photo,
        ''thumb'', rm.thumb,
	    ''description'', rm.description,
	    ''creationDate'', rm.creation_date,
	    ''updatedDate'', coalesce(rm.updated_date, rm.creation_date),
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
) as json_result
FROM raw_material rm
LEFT JOIN unit_base ub ON ub.id = rm.unit_base_id
LEFT JOIN status s ON s.id = rm.status_id
LEFT JOIN "user" u ON u.id = rm.creator_user_id','raw_material','POST'),
	 ('addFinishedProductV2','/addFinishedProductV2','insert into finished_product','finished_product','PUT'),
	 ('updateFinishedProductV2','/updateFinishedProductV2','UPDATE finished_product
SET name=$1, description=$2, photo=$3, thumb=$4, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
WHERE id=$5','finished_product','PATCH'),
	 ('getFinishedProductV2','/getFinishedProductV2','SELECT json_build_object(
    ''id'', fp.id,
    ''name'', fp.name,
    ''description'', fp.description,
    ''photo'', fp.photo,
    ''thumb'', fp.thumb,
    ''creationDate'', fp.creation_date,
    ''updatedDate'', coalesce(fp.updated_date, fp.creation_date),
    ''finishedProductTypeId'', fp.finished_product_type_id,
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
	 ('retrieveFinishedProductV2','/retrieveFinishedProductV2','SELECT json_agg(
    json_build_object(
        ''id'', fp.id,
        ''name'', fp.name,
        ''description'', fp.description,
        ''photo'', fp.photo,
        ''thumb'', fp.thumb,
        ''creationDate'', fp.creation_date,
        ''updatedDate'', coalesce(fp.updated_date, fp.creation_date),
        ''finishedProductTypeId'', fp.finished_product_type_id,
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
) as json_result
FROM finished_product fp
LEFT JOIN unit_base ub ON ub.id = fp.unit_base_id
LEFT JOIN status s ON s.id = fp.status_id
LEFT JOIN "user" u ON u.id = fp.creator_user_id','finished_product','POST'),
	 ('getProductForSaleV2','/getProductForSaleV2','SELECT json_build_object(
    ''id'', pfs.id,
    ''price'', pfs.price,
    ''creationDate'', pfs.creation_date,
    ''updatedDate'', coalesce(pfs.updated_date, pfs.creation_date),
    ''finishedProduct'', json_build_object(
        ''id'', fp.id,
        ''name'', fp.name,
        ''photo'', fp.photo,
        ''thumb'', fp.thumb,
        ''description'', fp.description,
        ''measure'', json_build_object(
            ''identifier'', ub.name,
            ''type'', ub."type"
        )
    ),
    ''status'', json_build_object(
        ''name'', s.name,
        ''identifier'', s.name,
        ''type'', s."type"
    ),
    ''establishment'', json_build_object(
        ''id'', e.id,
        ''name'', e.name
    ),
    ''creatorUser'', json_build_object(
        ''id'', u.id,
        ''name'', u.username,
        ''email'', u.email
    )
) as json_result
FROM product_for_sale pfs
LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
LEFT JOIN establishment e ON e.id = pfs.establishment_id
LEFT JOIN status s ON s.id = pfs.status_id
left join "user" u on u.id = pfs.creator_user_id','product_for_sale','POST'),
	 ('retrieveProductsForSaleV2','/retrieveProductsForSaleV2','WITH products_ordered AS (
    SELECT pfs1.id, pfs1.creation_date, pfs1.updated_date, pfs1.price,
           fp.id AS fp_id, fp.name AS fp_name, fp.photo, fp.thumb, fp.description,
           ub.name AS ub_name, ub."type" AS ub_type,
           s.name AS s_name, s.id as status_id, s."type" AS s_type,
           e.id AS establishment_id, e.name AS e_name
    FROM product_for_sale pfs1
    LEFT JOIN finished_product fp ON pfs1.finished_product_id = fp.id
    LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
    LEFT JOIN establishment e ON e.id = pfs1.establishment_id
    LEFT JOIN status s ON s.id = pfs1.status_id
    ORDER BY pfs1.creation_date ASC
)
SELECT json_agg(
    json_build_object(
        ''id'', pfs.id,
        ''creationDate'', pfs.creation_date,
        ''updatedDate'', coalesce(pfs.updated_date, pfs.creation_date),
        ''price'', pfs.price,
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
) AS json_result
FROM products_ordered pfs','product_for_sale','POST');


-- #############################################################################
-- PASO 3 — Poblar `thumb` para las imágenes YA existentes.
--          CORRER SÓLO DESPUÉS de que el script de blobs haya subido los thumbs.
--          Deriva el nombre: foto.jpg -> foto_thumb.jpg  (mismo criterio que el script).
--          Si algún `photo` no tuviera extensión, la regex no matchea y `thumb`
--          queda igual al `photo`; el script de blobs usa la misma regla.
-- #############################################################################
UPDATE raw_material
SET thumb = regexp_replace(photo, '(\.[^.]+)$', '_thumb\1')
WHERE photo IS NOT NULL AND photo <> '';

UPDATE finished_product
SET thumb = regexp_replace(photo, '(\.[^.]+)$', '_thumb\1')
WHERE photo IS NOT NULL AND photo <> '';


-- =============================================================================
-- VERIFICACIÓN OPCIONAL (queries de lectura, no modifican nada):
--
--   -- Confirmar que las columnas existen:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name IN ('raw_material','finished_product') AND column_name = 'thumb';
--
--   -- Confirmar que las 10 queries V2 quedaron registradas:
--   SELECT descripcion, "path" FROM public.sql_queries WHERE "path" LIKE '%V2' ORDER BY descripcion;
--
--   -- Ver cuántas filas quedaron con thumb poblado:
--   SELECT count(*) FILTER (WHERE thumb IS NOT NULL) AS con_thumb, count(*) AS total FROM raw_material;
--   SELECT count(*) FILTER (WHERE thumb IS NOT NULL) AS con_thumb, count(*) AS total FROM finished_product;
-- =============================================================================
