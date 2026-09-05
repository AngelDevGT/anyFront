-- =============================================================================
-- Migración: acciones masivas de inventario de producto para venta (tienda)
-- Fecha: 2026-08-27
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- La pantalla
--   Tienda > Inventario de Producto Para Venta
--   /store/inventory/<tienda>
-- solo permitía mover UN producto a la vez: cada fila de la tabla abre su propio
-- modal (Agregar / Eliminar / Devolver) y cada uno dispara una petición. Ajustar
-- el inventario de una tienda completa significaba repetir el ciclo producto por
-- producto, con un motivo distinto escrito a mano en cada uno.
--
-- Ahora hay un botón "Acciones de inventario" en el encabezado, con el mismo
-- patrón que "Editar costos": lista TODOS los productos del inventario, una
-- casilla de cantidad por producto, un selector de acción (Agregar / Eliminar /
-- Devolver) y un único comentario que queda en el historial de todos los
-- movimientos de esa tanda.
--
-- QUÉ NECESITA EL BACKEND
-- Agregar y Eliminar ya estaban cubiertos: /multiAddRemoveInventoryElement
-- recibe un arreglo y llama a add_remove_inventory_element por elemento. Lo que
-- faltaba era el equivalente para Devolver, que NO es un add_remove: mueve dos
-- inventarios (saca de tienda con acción 17, entra a bodega con acción 18) y por
-- eso vive en su propio procedure, return_pfs_to_warehouse.
--
-- POR QUÉ UN PROCEDURE Y NO N LLAMADAS DESDE EL FRONT
-- Una tanda de devoluciones es una sola decisión del usuario: si la quinta falla
-- por falta de existencias, las cuatro anteriores no deberían quedar aplicadas.
-- Envueltas en un solo procedure, el RAISE de cualquier iteración revierte toda
-- la llamada. Es el mismo criterio con el que ya existe
-- multi_add_remove_inventory_elements.
--
-- ENFOQUE 100% ADITIVO:
--   * Procedure NUEVO: multi_return_pfs_to_warehouse(jsonb). return_pfs_to_warehouse
--     no se toca — el procedure nuevo lo invoca tal cual está en producción, así
--     que las reglas de validación y los tipos de acción quedan en un solo lugar.
--   * Fila NUEVA en sql_queries: /multiReturnPFSToWarehouse. /returnPFSToWarehouse
--     y /multiAddRemoveInventoryElement quedan vivos e intactos: los modales de
--     fila los siguen usando.
--   * No hay cambios de esquema: ninguna tabla ni columna se toca.
-- =============================================================================


-- #############################################################################
-- PASO 1 — multi_return_pfs_to_warehouse(jsonb)
--
-- Recorre el arreglo y delega cada elemento en return_pfs_to_warehouse, que ya
-- se encarga de:
--   1. remove_inventory_element sobre el inventario de tienda, acción 17
--      (remove_pfs_by_devolution). Ahí vive la validación de existencias: si se
--      pide devolver más de lo disponible, levanta excepción.
--   2. resolver el finished_product del product_for_sale.
--   3. add_inventory_element sobre 'finished_product'/'bodega', acción 18
--      (add_fp_by_devolution_from_store).
--
-- El comentario viaja repetido en cada elemento del arreglo: el front manda el
-- mismo texto para toda la tanda, y así cada fila de inventory_element_action
-- queda con su propio motivo legible sin depender de un join extra.
--
-- Sin bloque EXCEPTION a propósito: cualquier error se propaga y aborta la
-- llamada completa, que es justo lo que se quiere. La forma del payload es la
-- misma que consume multi_add_remove_inventory_elements, menos actionTypeId
-- (acá lo fija el procedure de devolución).
--
--   [
--     {
--       "inventoryType":  "product_for_sale",
--       "unitName":       "<establishment_id>",
--       "elementId":      "<product_for_sale_id>",
--       "measureId":      1,
--       "quantity":       3.5,
--       "creatorUserId":  "<user_id>",
--       "comment":        "Ajuste de inventario"
--     }
--   ]
-- #############################################################################

CREATE OR REPLACE PROCEDURE public.multi_return_pfs_to_warehouse(IN _data jsonb)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    item jsonb;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(_data)
    LOOP
        call public.return_pfs_to_warehouse(
            item ->> 'inventoryType',
            item ->> 'unitName',
            (item ->> 'elementId')::uuid,
            (item ->> 'measureId')::integer,
            (item ->> 'quantity')::numeric,
            (item ->> 'creatorUserId')::uuid,
            item ->> 'comment'
        );
    END LOOP;
END;
$procedure$
;


-- #############################################################################
-- PASO 2 — Endpoint /multiReturnPFSToWarehouse
--
-- El Function App resuelve la ruta contra sql_queries, así que el endpoint nuevo
-- es una fila nueva. El DELETE previo hace la migración re-ejecutable sin dejar
-- rutas duplicadas; no borra nada en uso porque el path no existía antes.
--
-- El arreglo llega como UN solo parámetro de texto ($1) con el JSON serializado,
-- igual que /multiAddRemoveInventoryElement.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/multiReturnPFSToWarehouse';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('multiReturnPFSToWarehouse','/multiReturnPFSToWarehouse','call multi_return_pfs_to_warehouse($1)','inventory_element','PATCH');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################

-- El procedure quedó creado:
-- SELECT p.proname
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'multi_return_pfs_to_warehouse';

-- Los tres endpoints que usa la pantalla siguen vivos:
-- SELECT "path" FROM public.sql_queries
-- WHERE "path" IN ('/returnPFSToWarehouse',
--                  '/multiAddRemoveInventoryElement',
--                  '/multiReturnPFSToWarehouse')
-- ORDER BY "path";
