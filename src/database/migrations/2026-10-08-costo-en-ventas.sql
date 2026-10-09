-- =============================================================================
-- Migración: costo de los productos en las ventas (EMB-ANY-015)
-- Fecha: 2026-10-08
-- Ejecución: MANUAL. Correr en el Postgres de producción, DESPUÉS de
--            2026-10-02-venta-de-pedidos.sql y 2026-10-02-recibir-y-vender-pedidos.sql.
--
-- Objetivo: cada producto vendido guarda el costo que tenía al momento de la
-- venta. Hoy solo existe product_for_sale.cost, que es el costo ACTUAL: si se
-- cambia, cambian también el costo y el margen de todas las ventas anteriores
-- en los dashboards.
--
-- UNA SOLA COLUMNA: shop_sale_element.base_cost
-- Copia EXACTA de product_for_sale.cost al vender: costo por UNIDAD BASE, el
-- mismo dato y el mismo tipo que la columna de origen. No se guarda el costo
-- total de la línea: se calcula donde haga falta como
--
--     quantity * measure.unit_base_quantity * base_cost
--
-- sumando sin redondear y redondeando solo al final, igual que lo hacían los
-- dashboards. Guardar el total ya redondeado a 2 decimales por línea acumulaba
-- diferencias de centavos al sumar muchas ventas (ver PASO 0).
--
-- Se llama base_cost y no cost porque en shop_sale_element price es POR
-- MEDIDA: "cost" junto a "price" haría pensar que también lo es.
--
-- Lo copia la BASE, no el front: el costo solo lo ve el rol Sistema, quien
-- vende no tiene por qué recibirlo, y un valor que viaja desde el navegador se
-- puede alterar. Si el producto no tiene costo capturado se usa su precio,
-- mismo criterio que los dashboards.
--
-- ENFOQUE ADITIVO para producción:
--   * Columna nueva NULLABLE.
--   * register_shop_sale_with_elements_v8 NO se toca. La v9 se DERIVA del
--     código vivo de la v8 con pg_get_functiondef + replace(), con cada ancla
--     verificada (mismo mecanismo que 2026-10-02-venta-de-pedidos.sql).
--   * receive_and_sell_pfs_order_v1 llama a la v8 por nombre, así que no se
--     edita: nace la v2, que llama a la v9.
--   * Las ventas anteriores se llenan con el costo actual (PASO 6): es el mismo
--     valor que los dashboards ya usaban para ellas, así que los números no
--     cambian; solo dejan de moverse si el costo cambia después.
--
-- Versiones que nacen acá:
--   register_shop_sale_with_elements_v8  -> v9
--   /registerShopV8                       -> /registerShopV9
--   receive_and_sell_pfs_order_v1         -> v2
--   /receiveAndSellPFSOrderV1             -> /receiveAndSellPFSOrderV2
-- =============================================================================


-- #############################################################################
-- PASO 0 — LIMPIEZA DE LA PRIMERA VERSIÓN DE ESTA MIGRACIÓN
--
-- La primera versión de este archivo (solo corrida en PRUEBAS) guardaba
-- shop_sale_element.total_cost: el costo total de la línea redondeado a 2
-- decimales. Al sumar muchas ventas, el redondeo por línea se acumulaba y el
-- dashboard daba centavos de más o de menos contra el cálculo sin redondear.
--
-- Se borra todo lo que creó: la columna y las dos procedures que la usaban
-- (la v9 la escribía y receive_and_sell_pfs_order_v2 llama a la v9), junto con
-- sus endpoints. Los pasos siguientes vuelven a crear las procedures y los
-- endpoints con base_cost.
--
-- Todo va con IF EXISTS: en producción, donde nunca corrió la primera versión,
-- este paso no hace nada.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" IN ('/registerShopV9', '/receiveAndSellPFSOrderV2');

DROP PROCEDURE IF EXISTS public.receive_and_sell_pfs_order_v2(jsonb, jsonb, uuid);
DROP PROCEDURE IF EXISTS public.register_shop_sale_with_elements_v9(jsonb, jsonb, uuid);

ALTER TABLE public.shop_sale_element DROP COLUMN IF EXISTS total_cost;

-- Ninguna otra procedure o función debería escribir shop_sale_element.total_cost.
-- Esta consulta lista las que mencionan las dos cosas, para revisarlas a mano
-- si sale alguna (0 filas esperadas; otras tablas tienen columnas total_cost
-- propias, por eso se busca junto con shop_sale_element):
SELECT p.proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prosrc LIKE '%shop_sale_element%'
   AND p.prosrc LIKE '%total_cost%';


-- #############################################################################
-- PASO 1 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- 1.a La v8 existe (1 fila) y la v9 ya no (0 filas, la borró el PASO 0).
SELECT p.proname FROM pg_proc p
 WHERE p.proname IN ('register_shop_sale_with_elements_v8', 'register_shop_sale_with_elements_v9');

-- 1.b La columna no debería existir todavía (0 filas).
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'shop_sale_element' AND column_name = 'base_cost';


-- #############################################################################
-- PASO 2 — Columna nueva
-- #############################################################################

ALTER TABLE public.shop_sale_element
    ADD COLUMN IF NOT EXISTS base_cost numeric(10, 2) NULL;

COMMENT ON COLUMN public.shop_sale_element.base_cost IS
    'Costo del producto POR UNIDAD BASE al momento de la venta: copia de product_for_sale.cost (o price si no hay costo). El costo de la línea es quantity * measure.unit_base_quantity * base_cost.';


-- #############################################################################
-- PASO 3 — PROCEDURE register_shop_sale_with_elements_v9
--
-- Igual a la v8 más la copia del costo en cada producto. Anclas, todas del
-- cuerpo vivo de la v8:
--   a) el nombre de la procedure
--   b) la última variable del DECLARE            -> _base_cost
--   c) la asignación de _discount en el loop     -> lectura del costo
--   d) la última columna del INSERT del elemento -> base_cost
--   e) el último valor del INSERT del elemento   -> _base_cost
--   f) el mensaje de error                       -> v9
-- Si alguna no aparece exactamente una vez, el bloque aborta y no se crea nada.
-- #############################################################################

DO $do$
DECLARE
    _def text;
    _nl text := chr(10);
    _anchors text[];
    _replacements text[];
    i int;
BEGIN
    SELECT pg_get_functiondef(p.oid) INTO _def
      FROM pg_proc p
     WHERE p.proname = 'register_shop_sale_with_elements_v8';

    IF _def IS NULL THEN
        RAISE EXCEPTION 'No existe register_shop_sale_with_elements_v8: no se crea la v9.';
    END IF;

    -- Si la v8 heredó fin de línea de Windows, las anclas de varias líneas lo usan también.
    IF position(chr(13) || chr(10) IN _def) > 0 THEN
        _nl := chr(13) || chr(10);
    END IF;

    _anchors := ARRAY[
        -- a)
        'public.register_shop_sale_with_elements_v8(',
        -- b)
        '    _order_received_status_id INT := 22;' || _nl || 'BEGIN',
        -- c)
        $a$            _discount := ROUND((_item->>'discount')::NUMERIC, 2);$a$ || _nl,
        -- d)
        '                quantity,' || _nl || '                measure_id)' || _nl || '            VALUES(',
        -- e)
        '                _quantity,' || _nl || '                _measure_id);',
        -- f)
        'Error en registro de venta v8'
    ];

    _replacements := ARRAY[
        -- a)
        'public.register_shop_sale_with_elements_v9(',
        -- b)
        '    _order_received_status_id INT := 22;' || _nl
        || '    -- Costo por unidad base del producto al vender (EMB-ANY-015).' || _nl
        || '    _base_cost NUMERIC(10,2);' || _nl
        || 'BEGIN',
        -- c)
        $r$            _discount := ROUND((_item->>'discount')::NUMERIC, 2);

            -- Costo VIGENTE del producto, por unidad base, copiado tal cual.
            -- Si el producto no tiene costo capturado se usa su precio.
            SELECT COALESCE(pfs.cost, pfs.price)
              INTO _base_cost
              FROM product_for_sale pfs
             WHERE pfs.id = _product_for_sale_id;
$r$,
        -- d)
        '                quantity,' || _nl || '                measure_id,' || _nl || '                base_cost)' || _nl || '            VALUES(',
        -- e)
        '                _quantity,' || _nl || '                _measure_id,' || _nl || '                _base_cost);',
        -- f)
        'Error en registro de venta v9'
    ];

    FOR i IN 1 .. array_length(_anchors, 1) LOOP
        IF (length(_def) - length(replace(_def, _anchors[i], ''))) / length(_anchors[i]) <> 1 THEN
            RAISE EXCEPTION 'El ancla % no aparece exactamente una vez en la v8: no se crea la v9. Ancla: %', i, _anchors[i];
        END IF;
        _def := replace(_def, _anchors[i], _replacements[i]);
    END LOOP;

    EXECUTE _def;
END
$do$;


-- #############################################################################
-- PASO 4 — PROCEDURE receive_and_sell_pfs_order_v2
--
-- Igual a la v1, pero la venta la registra la v9. La v1 sigue viva.
-- #############################################################################

CREATE OR REPLACE PROCEDURE public.receive_and_sell_pfs_order_v2(
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

    -- 2) Vender: valida, descuenta inventario, guarda el costo y liga la venta al pedido.
    CALL register_shop_sale_with_elements_v9(_sale_properties, _sale_elements, _creator_user_id);
END;
$procedure$;


-- #############################################################################
-- PASO 5 — Endpoints
--
-- Misma firma que las versiones anteriores. El DELETE previo los hace idempotentes.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" IN ('/registerShopV9', '/receiveAndSellPFSOrderV2');

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('registerShopV9','/registerShopV9','call register_shop_sale_with_elements_v9($1,$2,$3::uuid)','shop_sale','PATCH'),
	 ('receiveAndSellPFSOrderV2','/receiveAndSellPFSOrderV2','call receive_and_sell_pfs_order_v2($1,$2,$3::uuid)','shop_sale','PATCH');


-- #############################################################################
-- PASO 6 — Costo de las ventas anteriores
--
-- Se llenan con el costo ACTUAL de cada producto. No es el costo que tenían al
-- venderse —ese dato no existe—, pero es exactamente el que los dashboards ya
-- usaban para ellas, así que los números no cambian: solo dejan de moverse si
-- el costo de un producto cambia después.
--
-- Solo toca filas sin costo, así que no pisa las ventas registradas con la v9 y
-- se puede volver a correr sin efecto.
-- #############################################################################

UPDATE public.shop_sale_element sse
   SET base_cost = COALESCE(pfs.cost, pfs.price)
  FROM public.product_for_sale pfs
 WHERE pfs.id = sse.product_for_sale_id
   AND sse.base_cost IS NULL;


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- total_cost ya no existe y base_cost sí (1 fila: base_cost)
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'shop_sale_element' AND column_name IN ('total_cost', 'base_cost');
--
-- -- Las procedures nuevas existen (2 filas)
-- SELECT proname FROM pg_proc
--  WHERE proname IN ('register_shop_sale_with_elements_v9', 'receive_and_sell_pfs_order_v2');
--
-- -- La v9 copia el costo y ya no menciona total_cost (true, false)
-- SELECT pg_get_functiondef(p.oid) LIKE '%base_cost%'  AS copia_costo,
--        pg_get_functiondef(p.oid) LIKE '%total_cost%' AS usa_total_cost
--   FROM pg_proc p WHERE p.proname = 'register_shop_sale_with_elements_v9';
--
-- -- Las rutas existen y ninguna está duplicada (2 filas, veces = 1)
-- SELECT "path", COUNT(*) AS veces FROM public.sql_queries
--  WHERE "path" IN ('/registerShopV9', '/receiveAndSellPFSOrderV2')
--  GROUP BY "path" ORDER BY "path";
--
-- -- Todas las líneas quedaron con costo (0 esperado)
-- SELECT COUNT(*) FROM shop_sale_element WHERE base_cost IS NULL;
--
-- -- Mientras no cambie ningún costo, el guardado es igual al actual (0 esperado)
-- SELECT COUNT(*)
--   FROM shop_sale_element sse
--   JOIN product_for_sale pfs ON pfs.id = sse.product_for_sale_id
--  WHERE sse.base_cost <> COALESCE(pfs.cost, pfs.price);
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve a /registerShopV8 y /receiveAndSellPFSOrderV1 con revertir el
-- commit. La base se deja como estaba con:
--
-- DELETE FROM public.sql_queries WHERE "path" IN ('/registerShopV9', '/receiveAndSellPFSOrderV2');
-- DROP PROCEDURE IF EXISTS public.receive_and_sell_pfs_order_v2(jsonb,jsonb,uuid);
-- DROP PROCEDURE IF EXISTS public.register_shop_sale_with_elements_v9(jsonb,jsonb,uuid);
--
-- La columna se puede dejar: es NULLABLE y la v8 no la escribe. Para sacarla —y
-- perder el costo congelado de las ventas—:
-- ALTER TABLE public.shop_sale_element DROP COLUMN IF EXISTS base_cost;
-- #############################################################################
