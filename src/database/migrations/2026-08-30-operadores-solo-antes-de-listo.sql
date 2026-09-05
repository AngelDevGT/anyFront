-- =============================================================================
-- Migración: los operadores solo se editan antes de que el pedido llegue a Listo
-- Fecha: 2026-08-30
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Problema: /updateProductForSaleStoreOrderOperators solo rechaza los pedidos
-- Eliminado(10) y Cancelado(15), así que deja reescribir los operadores de un
-- pedido ya cerrado —Listo(13), En camino(1), Entregado(16), Devuelto(18)—. Los
-- operadores son el registro de QUIÉN preparó el pedido en bodega; una vez que
-- el pedido salió, ese registro es histórico y no debería moverse.
--
-- La regla nueva: se editan solo mientras el pedido siga en bodega, o sea
-- Pendiente(11), En curso(12) o Preparado(64).
--
-- Es una LISTA BLANCA y no un "not in (...)" a propósito: con el enfoque
-- anterior, cada estado que se agregara al ciclo de vida nacía permitiendo la
-- edición y había que acordarse de excluirlo. Así nace prohibiéndola, que es el
-- lado seguro.
--
-- QUÉ SE PIERDE
-- El endpoint existía, entre otras cosas, para ponerle operadores a un pedido
-- que se cerró desde la vista de detalle: ese camino va de Pendiente(11) a
-- Listo(13) directo y nunca los pide, así que se cargaban después. Con esta
-- migración ese caso hay que atenderlo ANTES de marcar el pedido como Listo. Los
-- pedidos ya cerrados sin operadores se quedan sin ellos.
--
-- Si eso resultara molesto, la vuelta atrás no es revertir esta migración sino
-- pedir los operadores en la transición a Listo de la vista de detalle, como ya
-- hace el tablero al tomar el pedido.
--
-- QUÉ NO CAMBIA
--   * startProductForSaleOrder (Pendiente -> En curso con operadores) no se
--     toca: escribe los operadores por otra puerta, en su propia query.
--   * Ningún estado, procedure ni inventario.
--
-- ENFOQUE 100% ADITIVO: fila NUEVA (V2). La V1 queda viva e intacta, así que un
-- rollback del front no necesita tocar la base.
-- =============================================================================


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- 0.a La V1 tiene que existir. Si no sale la fila, correr antes
--     2026-08-26-operadores-pedidos.sql.
SELECT "path", consulta_sql FROM public.sql_queries
 WHERE "path" = '/updateProductForSaleStoreOrderOperators';

-- 0.b Los ids de estado de la lista blanca. Deben ser Pendiente = 11,
--     En curso = 12 y Preparado = 64; si acá salen otros números, corregirlos en
--     el PASO 1.
SELECT s.id, s."name" FROM status s WHERE s.id IN (11, 12, 64) ORDER BY s.id;

-- 0.c Cuántos pedidos quedan fuera de la regla nueva, o sea cuántos dejarían de
--     poder editarse. Es solo informativo: no se toca ninguno.
SELECT factory_status_id, COUNT(*) AS pedidos
  FROM product_for_sale_store_order
 WHERE factory_status_id NOT IN (11, 12, 64)
 GROUP BY factory_status_id
 ORDER BY factory_status_id;


-- #############################################################################
-- PASO 1 — /updateProductForSaleStoreOrderOperatorsV2
--
-- Clon de la V1 con el guard cambiado. Se escribe entera en vez de derivarla con
-- replace(): son cuatro líneas y así queda a la vista qué se está permitiendo,
-- que es justamente el punto de la migración.
--
-- El nullif($2, '') se conserva tal cual: la lista vacía deja la columna en NULL,
-- que es un caso válido (quitarle todos los operadores a un pedido).
--
-- El DELETE previo la hace idempotente: sql_queries no tiene unique en "path".
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/updateProductForSaleStoreOrderOperatorsV2';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('updateProductForSaleStoreOrderOperatorsV2','/updateProductForSaleStoreOrderOperatorsV2','update product_for_sale_store_order
set operators = nullif($2, ''''),
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1::uuid
  and factory_status_id in (11, 12, 64)','product_for_sale_store_order','PATCH');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- La ruta nueva existe una sola vez
-- SELECT "path", COUNT(*) AS veces FROM sql_queries
--  WHERE "path" = '/updateProductForSaleStoreOrderOperatorsV2' GROUP BY "path";
--
-- -- La V2 lleva la lista blanca y la V1 sigue con el "not in"
-- SELECT "path",
--        consulta_sql LIKE '%in (11, 12, 64)%' AS lista_blanca,
--        consulta_sql LIKE '%not in (10, 15)%' AS regla_vieja
--   FROM sql_queries
--  WHERE "path" IN ('/updateProductForSaleStoreOrderOperators',
--                   '/updateProductForSaleStoreOrderOperatorsV2');
--
-- -- Prueba real. Tomar un pedido En curso(12) y otro Listo(13):
-- --   SELECT id, order_number, factory_status_id, operators
-- --     FROM product_for_sale_store_order
-- --    WHERE factory_status_id IN (12, 13) ORDER BY creation_date DESC LIMIT 10;
-- -- Llamar al endpoint con {"$1": "<id>", "$2": "Prueba"} sobre cada uno:
-- --   * el de En curso debe quedar con operators = 'Prueba';
-- --   * el de Listo NO debe cambiar (0 filas afectadas, sin error).
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve a la V1 con revertir el commit; la base se deja como estaba con:
--
-- DELETE FROM public.sql_queries WHERE "path" = '/updateProductForSaleStoreOrderOperatorsV2';
-- #############################################################################
