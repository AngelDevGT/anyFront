-- =============================================================================
-- Migración: retroceder un pedido de Preparado(64) a En curso(12)
-- Fecha: 2026-08-30
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- ###########################################################################
-- ORDEN: correr DESPUÉS de 2026-08-29-verificacion-pedidos-bodega.sql.
-- El UPDATE del PASO 2 limpia verified_by_user_id y verified_date, que crea esa
-- migración. El PASO 0 corta la ejecución si todavía no existen.
-- ###########################################################################
--
-- Hasta ahora Preparado era de una sola vía: la única salida era Listo(13), que
-- mueve inventario. Un pedido marcado como Preparado por error quedaba obligado a
-- seguir adelante y a devolverse después desde la tienda, moviendo inventario dos
-- veces para arreglar algo que nunca debió salir de bodega.
--
--     Pendiente(11) -> En curso(12) <-> Preparado(64) -> Listo(13)
--          ^______________|                    |
--                         |____________________|   (En curso -> Listo directo)
--
-- Es el reverso EXACTO de /prepareProductForSaleStoreOrder: mismo guard, y deja
-- la fila como estaba antes de prepararla.
--
-- QUÉ CONSERVA: encargado, hora de inicio y operadores. A diferencia de
-- /releaseProductForSaleStoreOrderV2 —que devuelve el pedido al pool y por eso
-- los borra— acá el pedido no cambia de manos: la misma persona lo sigue
-- teniendo, solo retrocede un paso para corregirlo. Por eso tampoco pide la
-- capacidad orders.release; alcanza con ser su encargado.
--
-- QUÉ BORRA:
--   * prepared_date, porque el pedido ya no está preparado. Si vuelve a
--     avanzar se reescribe con la hora nueva, que es la que corresponde. Y si
--     de ahí va directo a Listo, el diagrama de la vista de detalle omite el
--     paso Preparado, que es justo lo que pasó.
--   * verified_by_user_id y verified_date. Esto NO es una limpieza cosmética:
--     los productos del pedido se pueden EDITAR mientras está En curso
--     (update_product_for_sale_order_with_elements acepta 11 y 12). Si la firma
--     sobreviviera al retroceso, este camino cerraría un pedido con una
--     verificación que certifica productos distintos de los que salen:
--
--         Preparado verificado -> En curso -> editar productos -> Listo
--
--     y el procedure v5 no volvería a pedir verificador, porque la columna no
--     está vacía. Borrarla obliga a firmar de nuevo lo que se despacha.
--
--     Además es lo que espera quien lo usa: el motivo más común para retroceder
--     un pedido verificado es que la verificación encontró algo mal.
--
-- ENFOQUE 100% ADITIVO: un endpoint nuevo. No se toca ninguna query, procedure
-- ni columna existente.
-- =============================================================================


-- #############################################################################
-- PASO 0 — Dependencia
--
-- Falla RUIDOSAMENTE si falta la migración de verificación, en vez de insertar
-- un endpoint que reventaría recién al usarlo.
-- #############################################################################

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'product_for_sale_store_order'
          AND column_name = 'verified_by_user_id'
    ) THEN
        RAISE EXCEPTION 'Falta 2026-08-29-verificacion-pedidos-bodega.sql: no existe product_for_sale_store_order.verified_by_user_id';
    END IF;
END $$;


-- #############################################################################
-- PASO 1 — Preparado(64) -> En curso(12)
--
-- UPDATE puro: no mueve inventario y no toca store_status_id, porque para la
-- tienda nunca cambió nada (sigue en Pendiente, 19) ni mientras el pedido estuvo
-- En curso ni mientras estuvo Preparado.
--
-- El guard "and factory_status_id = 64" evita que un doble clic o dos personas a
-- la vez apliquen el retroceso dos veces, y el de encargado es el mismo de
-- /prepareProductForSaleStoreOrder: el pedido lo retrocede quien lo tiene, o un
-- admin.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/unprepareProductForSaleStoreOrder';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('unprepareProductForSaleStoreOrder','/unprepareProductForSaleStoreOrder','update product_for_sale_store_order
set factory_status_id = 12,
    prepared_date = null,
    verified_by_user_id = null,
    verified_date = null,
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1::uuid
  and factory_status_id = 64
  and (assigned_user_id = $2::uuid
       or assigned_user_id is null
       or exists (select 1 from "user" u where u.id = $2::uuid and u.role_id = 1))','product_for_sale_store_order','PATCH');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- El endpoint quedó, una sola vez
-- SELECT "path", COUNT(*) AS veces FROM sql_queries
--  WHERE "path" = '/unprepareProductForSaleStoreOrder' GROUP BY "path";
--
-- -- /prepareProductForSaleStoreOrder sigue intacto (debe seguir diciendo 64)
-- SELECT consulta_sql FROM sql_queries WHERE "path" = '/prepareProductForSaleStoreOrder';
--
-- -- Tras retroceder un pedido en el tablero: vuelve a 12, sin fechas de
-- -- preparación ni verificación, PERO conservando encargado y operadores.
-- SELECT order_number, factory_status_id, store_status_id, start_date, prepared_date,
--        verified_date, verified_by_user_id, assigned_user_id, operators
--   FROM product_for_sale_store_order
--  ORDER BY updated_date DESC LIMIT 5;
--
-- -- Nadie debería quedar en 64 con verificación y sin prepared_date, ni al revés
-- SELECT count(*) AS inconsistentes FROM product_for_sale_store_order
--  WHERE (prepared_date IS NULL AND factory_status_id = 64)
--     OR (verified_date IS NULL AND verified_by_user_id IS NOT NULL);
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- DELETE FROM public.sql_queries WHERE "path" = '/unprepareProductForSaleStoreOrder';
--
-- No hay nada más que revertir: la migración no toca esquema ni procedures. Los
-- pedidos que ya retrocedieron se quedan donde están, que es un estado válido.
-- #############################################################################
