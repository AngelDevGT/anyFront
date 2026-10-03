-- =============================================================================
-- Migración: recibir y vender pedidos de tienda (EMB-ANY-004)
-- Fecha: 2026-10-02
-- Ejecución: MANUAL. Correr en el Postgres de producción, DESPUÉS de
--            2026-10-02-venta-de-pedidos.sql (usa register_shop_sale_with_elements_v8).
--
-- Objetivo: desde el detalle de un pedido Listo, el botón "Recibir y vender"
-- lleva a Registrar venta con el inventario de la tienda y el pedido sumados.
-- Al cobrar, el pedido se recibe y la venta se registra en UNA sola
-- transacción: si la venta falla, el pedido no queda recibido, y al revés.
--
-- POR QUÉ UNA PROCEDURE QUE LLAMA A LAS OTRAS DOS
-- No se repite ninguna lógica: la recepción es la de siempre
-- (manage_product_for_sale_order_state_v6 con Entregado(16), que mueve el
-- inventario in_transit -> tienda y deja el pedido Recibido) y la venta es la
-- de "Vender pedido" (register_shop_sale_with_elements_v8, que valida y liga la
-- venta al pedido). El orden importa: primero se recibe, así la venta descuenta
-- de un inventario que ya incluye el pedido y la v8 lo encuentra Recibido.
--
-- Las validaciones también son las de las dos procedures:
--   * la v6 exige el pedido Listo(13) o En camino(1);
--   * la v8 exige pedido de la misma tienda, tienda con "Vender pedidos"
--     habilitado y sin otra venta activa.
-- Esta procedure solo agrega que pfsStoreOrderId venga informado.
--
-- ENFOQUE 100% ADITIVO:
--   * Procedure y endpoint nuevos. Nada existente se toca.
--
-- Versiones que nacen acá:
--   receive_and_sell_pfs_order_v1  -> nueva
--   /receiveAndSellPFSOrderV1      -> nuevo
-- =============================================================================


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- Las dos procedures que se llaman tienen que existir (2 filas).
SELECT p.proname FROM pg_proc p
 WHERE p.proname IN ('manage_product_for_sale_order_state_v6', 'register_shop_sale_with_elements_v8');


-- #############################################################################
-- PASO 1 — PROCEDURE receive_and_sell_pfs_order_v1
--
-- Misma firma que register_shop_sale_with_elements_v8, para que el front arme
-- los parámetros igual que al registrar una venta.
-- #############################################################################

CREATE OR REPLACE PROCEDURE public.receive_and_sell_pfs_order_v1(
    IN _sale_properties jsonb,
    IN _sale_elements jsonb,
    IN _creator_user_id uuid
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
    _pfs_store_order_id uuid;
    _delivered_status_id INT := 16;
BEGIN
    _pfs_store_order_id := NULLIF(btrim(_sale_properties->>'pfsStoreOrderId'), '')::UUID;

    IF _pfs_store_order_id IS NULL THEN
        RAISE EXCEPTION 'Recibir y vender requiere el pedido de la venta.';
    END IF;

    -- 1) Recibir: in_transit -> tienda, pedido Recibido. Bloquea el pedido hasta el final.
    CALL manage_product_for_sale_order_state_v6(_pfs_store_order_id, _delivered_status_id, _creator_user_id);

    -- 2) Vender: valida, descuenta inventario y liga la venta al pedido.
    CALL register_shop_sale_with_elements_v8(_sale_properties, _sale_elements, _creator_user_id);
END;
$procedure$;


-- #############################################################################
-- PASO 2 — Endpoint
--
-- El DELETE previo lo hace idempotente.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/receiveAndSellPFSOrderV1';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('receiveAndSellPFSOrderV1','/receiveAndSellPFSOrderV1','call receive_and_sell_pfs_order_v1($1,$2,$3::uuid)','shop_sale','PATCH');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- La procedure y la ruta existen (1 fila cada una)
-- SELECT proname FROM pg_proc WHERE proname = 'receive_and_sell_pfs_order_v1';
-- SELECT "path", COUNT(*) AS veces FROM public.sql_queries
--  WHERE "path" = '/receiveAndSellPFSOrderV1' GROUP BY "path";
--
-- -- Prueba real: con "Vender pedidos" habilitado, abrir un pedido Listo,
-- -- "Recibir y vender" y cobrar. Luego el pedido debe estar Recibido y mostrar
-- -- "Ver venta":
-- --   SELECT store_status_id, received_date FROM product_for_sale_store_order WHERE id = '<id>';
-- --   SELECT id FROM shop_sale WHERE pfs_store_order_id = '<id>';
-- --
-- -- Prueba de atomicidad: con una tienda SIN "Vender pedidos", llamar al
-- -- endpoint a mano con un pedido Listo. Debe fallar y el pedido debe seguir
-- -- Listo (store_status_id 21), sin movimiento de inventario.
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front deja de llamarlo con revertir el commit. La base se deja como
-- estaba con:
--
-- DELETE FROM public.sql_queries WHERE "path" = '/receiveAndSellPFSOrderV1';
-- DROP PROCEDURE IF EXISTS public.receive_and_sell_pfs_order_v1(jsonb,jsonb,uuid);
-- #############################################################################
