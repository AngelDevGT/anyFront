-- =============================================================================
-- Migración: ocultar elementos ELIMINADOS en los inventarios de fábrica/bodega
-- Fecha: 2026-08-06
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Problema: el borrado de productos y materias primas es LÓGICO
--   * deleteFinishedProduct -> finished_product.status_id = 37 (Eliminado)
--   * deleteRawMaterial     -> raw_material.status_id      = 33 (Eliminado)
-- pero las queries de inventario NO filtran por ese estado: sólo filtran por
-- `ie.element_type` y `ie.inventory_id`. La fila de `inventory_element` sigue
-- existiendo, así que el producto/abarrote/materia prima eliminado sigue
-- apareciendo en las pantallas de inventario.
--
-- El JOIN a `status` ya existía en las tres queries, pero se usaba únicamente
-- para DEVOLVER el estado dentro del JSON, nunca en el WHERE.
--
-- Referencia del patrón correcto: /retrieveProductForSaleInventoryV2 sí filtra
-- (`sie."name" = ''Activo''`) y /retrievePackagingMaterialInventoryV2 ya filtra
-- el proveedor eliminado (`rmbp.status_id <> 35`) — pero no la materia prima base.
--
-- Enfoque 100% aditivo: NO se modifica ninguna query existente.
--   * Las V2 quedan intactas por si algo más las consume.
--   * Se agregan V3, clones exactos de las V2 con UNA sola línea extra en el
--     WHERE (la exclusión del estado eliminado).
--
-- Se usa `<> <id_eliminado>` en vez de `= <id_activo>` / `name = ''Activo''`
-- para no ocultar filas si en el futuro aparece un tercer estado.
--
-- Nota sobre el LEFT JOIN de finished_product: al agregar `fp.status_id <> 37`
-- al WHERE, un `inventory_element` huérfano (element_fk que no resuelve a
-- ningún producto) evalúa NULL <> 37 -> NULL y queda descartado. Es decir, el
-- LEFT JOIN pasa a comportarse como INNER. Es el efecto deseado.
--
-- Alcance: esto sólo OCULTA. Si un producto eliminado tenía existencia, la fila
-- de `inventory_element` conserva su cantidad; si el producto se reactivara
-- (status_id = 36 / 32) volvería a aparecer con ese stock antiguo. No se toca
-- ningún dato en esta migración.
--
-- Endpoints nuevos:
--   /retrieveFinishedProductInventoryV3   (Productos terminados y Abarrotes)
--   /retrieveRawMaterialInventoryV3       (Materia prima)
--   /retrievePackagingMaterialInventoryV3 (Material de empaque)
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1) INVENTARIO DE PRODUCTO TERMINADO / ABARROTES
--    Clon de /retrieveFinishedProductInventoryV2 + AND fp.status_id <> 37
-- ---------------------------------------------------------------------------
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveFinishedProductInventoryV3','/retrieveFinishedProductInventoryV3','SELECT json_build_object(
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
          AND fp.status_id <> 37
    )
) AS json_result
FROM inventory i
WHERE i.inventory_type = ''finished_product''','inventory','POST');


-- ---------------------------------------------------------------------------
-- 2) INVENTARIO DE MATERIA PRIMA
--    Clon de /retrieveRawMaterialInventoryV2 + AND rm.status_id <> 33
-- ---------------------------------------------------------------------------
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveRawMaterialInventoryV3','/retrieveRawMaterialInventoryV3','SELECT json_build_object(
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
          AND rm.status_id <> 33
    )
) as json_result
FROM inventory i
where i.inventory_type = ''raw_material''','inventory','POST');


-- ---------------------------------------------------------------------------
-- 3) INVENTARIO DE MATERIAL DE EMPAQUE
--    Clon de /retrievePackagingMaterialInventoryV2 + AND rm.status_id <> 33
--    (la V2 ya excluía el raw_material_by_provider eliminado, pero no la
--     materia prima base). Se versiona junto con la de materia prima porque
--     las pantallas de bodega alternan entre ambos endpoints con un ternario.
-- ---------------------------------------------------------------------------
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrievePackagingMaterialInventoryV3','/retrievePackagingMaterialInventoryV3','SELECT json_build_object(
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
          AND rm.status_id <> 33
          AND EXISTS (
              SELECT 1 FROM raw_material_by_provider rmbp
              WHERE rmbp.raw_material_base_id = rm.id
                AND rmbp.raw_material_by_provider_type_id = 2
                AND rmbp.status_id <> 35
          )
    )
) AS json_result
FROM inventory i
WHERE i.inventory_type = ''packaging_material''','inventory','POST');


-- =============================================================================
-- VERIFICACIÓN (opcional, después de correr los INSERT)
-- =============================================================================
-- SELECT descripcion, "path" FROM public.sql_queries
-- WHERE "path" IN ('/retrieveFinishedProductInventoryV3',
--                  '/retrieveRawMaterialInventoryV3',
--                  '/retrievePackagingMaterialInventoryV3');
--
-- ¿Cuántos elementos de inventario apuntan hoy a algo eliminado?
-- SELECT ie.element_type, count(*)
-- FROM inventory_element ie
-- LEFT JOIN finished_product fp ON fp.id = ie.element_fk
-- LEFT JOIN raw_material rm    ON rm.id = ie.element_fk
-- WHERE fp.status_id = 37 OR rm.status_id = 33
-- GROUP BY ie.element_type;
