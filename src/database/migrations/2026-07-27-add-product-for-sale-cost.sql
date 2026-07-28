-- =============================================================================
-- Migración: costo por producto para venta (campo `cost`)
-- Fecha: 2026-07-27
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Objetivo: guardar un COSTO por cada `product_for_sale`, visible y editable
-- únicamente por el rol Sistema (role.id = 1). El precio de venta (`price`)
-- no se toca: costo y precio son dos valores independientes.
--
-- Regla de negocio: al CREARSE un producto para venta, el costo nace con el
-- mismo valor del precio. Después son independientes -> si se edita el precio,
-- el costo NO se re-sincroniza, y viceversa.
--
-- Enfoque 100% aditivo: NO modifica ni una sola query/columna existente.
--   * Columna `cost` nullable + backfill -> las queries actuales no se afectan.
--   * El default (cost = price) se aplica con un TRIGGER BEFORE INSERT, no
--     tocando las procedures. Motivo: hay tres caminos de inserción distintos
--     (insert_multi_product_for_sale en sus dos sobrecargas, y el endpoint
--     /addProductForSale, que es un stub donde el INSERT lo arma la Function
--     App desde el body). El trigger los cubre a los tres y sigue permitiendo
--     mandar un `cost` explícito si algún día se agrega al alta.
--   * Las queries de lectura nuevas llevan versión/sufijo y endpoints nuevos;
--     las originales quedan intactas para no romper nada en producción.
--
-- ORDEN DE EJECUCIÓN (una sola corrida, ANTES de desplegar el front nuevo):
--   PASO 1 -> ALTER: agrega la columna cost (nullable, no rompe nada)
--   PASO 2 -> Backfill: cost = price en todo lo ya existente
--   PASO 3 -> Trigger: default cost = price para todo insert futuro
--   PASO 4 -> INSERT de las queries/endpoints nuevos
--   PASO 5 -> (OPCIONAL, tras verificar) NOT NULL sobre cost
--   PASO 6 -> (NOTA) permisos de ruta para la vista nueva
-- =============================================================================


-- #############################################################################
-- PASO 1 — ALTER: columna nueva, nullable.
--          Nullable a propósito: en este punto las procedures de inserción
--          todavía no mandan `cost` y el trigger del PASO 3 aún no existe.
-- #############################################################################
ALTER TABLE product_for_sale ADD COLUMN IF NOT EXISTS cost numeric(10, 2) NULL;


-- #############################################################################
-- PASO 2 — BACKFILL: todo lo que ya existe arranca con costo = precio de venta.
--          A partir de aquí el rol Sistema puede ajustarlos uno por uno o en
--          masa desde el listado.
-- #############################################################################
UPDATE product_for_sale
SET cost = price
WHERE cost IS NULL;


-- #############################################################################
-- PASO 3 — TRIGGER: aplica el default (cost = price) en cada inserción nueva.
--          Solo actúa cuando no viene un costo explícito, así que no estorba
--          si en el futuro el alta empieza a mandarlo.
-- #############################################################################
CREATE OR REPLACE FUNCTION product_for_sale_default_cost() RETURNS trigger AS $$
BEGIN
    IF NEW.cost IS NULL THEN
        NEW.cost := NEW.price;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_for_sale_default_cost ON product_for_sale;
CREATE TRIGGER trg_product_for_sale_default_cost
    BEFORE INSERT ON product_for_sale
    FOR EACH ROW
    EXECUTE FUNCTION product_for_sale_default_cost();


-- #############################################################################
-- PASO 4 — QUERIES / ENDPOINTS NUEVOS
--
--   Lectura: se clonan las queries actuales agregando `cost`, en endpoints
--   aparte. El front solo los llama cuando el usuario es Sistema, de modo que
--   el payload de un usuario de tienda no lleva el costo.
--
--   IMPORTANTE: esto es ocultamiento, no control de acceso. El backend es
--   routing SQL puro, sin validación de rol, así que cualquier usuario
--   autenticado podría llamar el endpoint a mano. Enforzarlo de verdad
--   requeriría lógica de rol en la Function App.
--
--   Escritura: /updateProductForSaleCost (uno) y /updateManyProductForSaleCost
--   (todos). El masivo es UN SOLO statement -> atómico por definición: se
--   aplican todos los costos o ninguno. Mismo patrón ya probado en
--   /updateProductForSaleSortOrder.
-- #############################################################################

-- Clon de /retrieveProductsForSaleV3 + `cost`. Usado por el listado cuando el usuario es Sistema.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveProductsForSaleV4','/retrieveProductsForSaleV4','WITH products_ordered AS (
    SELECT pfs1.id, pfs1.creation_date, pfs1.updated_date, pfs1.price, pfs1.cost, pfs1.sort_order,
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
        ''cost'', pfs.cost,
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
FROM products_ordered pfs','product_for_sale','POST'),

-- Clon de /getProductForSale + `cost`. Usado por la vista de detalle y por la de editar costo.
	 ('getProductForSaleWithCost','/getProductForSaleWithCost','SELECT json_build_object(
    ''id'', pfs.id,
    ''price'', pfs.price,
    ''cost'', pfs.cost,
    ''creationDate'', pfs.creation_date,
    ''updatedDate'', coalesce(pfs.updated_date, pfs.creation_date),
    ''finishedProduct'', json_build_object(
        ''id'', fp.id,
        ''name'', fp.name,
        ''photo'', fp.photo,
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

-- Edición del costo de UN producto.
	 ('updateProductForSaleCost','/updateProductForSaleCost','update product_for_sale
set cost = $1::numeric, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $2::uuid','product_for_sale','PATCH'),

-- Edición MASIVA de costos: un solo UPDATE -> todos los cambios se aplican juntos.
	 ('updateManyProductForSaleCost','/updateManyProductForSaleCost','UPDATE product_for_sale AS pfs
SET cost = v.cost, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
FROM jsonb_to_recordset($1::jsonb) AS v(id uuid, cost numeric)
WHERE pfs.id = v.id','product_for_sale','PATCH');


-- #############################################################################
-- PASO 5 — (OPCIONAL) Endurecer la columna una vez verificado que el backfill
--          y el trigger quedaron bien. Correr solo después de confirmar que
--          no hay filas con cost NULL:
--            SELECT count(*) FROM product_for_sale WHERE cost IS NULL;  -- debe dar 0
-- #############################################################################
-- ALTER TABLE product_for_sale ALTER COLUMN cost SET NOT NULL;


-- #############################################################################
-- PASO 6 — (NOTA) Permisos de ruta para la vista nueva de edición de costo:
--            /productsForSale/cost/edit/:id
--
--          El guard canActivateV2 valida la ruta contra role.paths. Si el rol
--          Sistema ya tiene un patrón amplio del módulo (ej. "^\/productsForSale(\/.*)?$")
--          la ruta nueva YA queda cubierta y no hay nada que hacer.
--          Verificar primero el contenido actual:
--            SELECT id, "name", paths FROM "role";
--
--          Si el patrón fuera exacto por ruta, agregar el de la vista nueva:
--
-- UPDATE "role"
-- SET paths = (
--     paths::jsonb || '[{"matchPattern": "^\\/productsForSale\\/cost\\/edit\\/.*$"}]'::jsonb
-- )::text
-- WHERE id = 1;
--
--          Ojo: el guard solo valida la RUTA, no el rol. La vista además
--          redirige por su cuenta si el usuario no es Sistema.
-- #############################################################################
