-- =============================================================================
-- Migración: venta de pedidos de tienda (EMB-ANY-003)
-- Fecha: 2026-10-02
-- Ejecución: MANUAL. Correr en el Postgres de producción, DESPUÉS de
--            2026-10-02-vender-pedidos-por-tienda.sql (usa establishment.sell_orders_enabled).
--
-- Objetivo: desde el detalle de un pedido Recibido, el botón "Vender pedido"
-- lleva a Registrar venta con los productos del pedido ya cargados. La venta
-- queda ligada al pedido, para:
--   * no vender dos veces el mismo pedido;
--   * mostrar desde el pedido la venta que salió de él (y, en EMB-ANY-005, el
--     detalle de cantidades vendidas contra pedidas).
--
-- ENFOQUE 100% ADITIVO:
--   * Columna nueva shop_sale.pfs_store_order_id, NULLABLE: las ventas normales
--     y todas las existentes quedan en NULL.
--   * register_shop_sale_with_elements_v7 NO se toca. La v8 se DERIVA del
--     código vivo de la v7 con pg_get_functiondef + replace(), igual que
--     2026-09-22-fecha-de-pago-y-cierre-congelado.sql derivó el cierre v6. Cada
--     ancla se verifica antes de reemplazar: si alguna no aparece exactamente
--     una vez, el bloque aborta y no se crea nada.
--   * /getProductForSaleStoreOrderV6 se clona a V7; la V6 sigue viva.
--
-- Versiones que nacen acá:
--   register_shop_sale_with_elements_v7 -> v8
--   /registerShopV7                      -> /registerShopV8
--   /getProductForSaleStoreOrderV6       -> /getProductForSaleStoreOrderV7
-- =============================================================================


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- 0.a La migración de "Vender pedidos" ya corrió (1 fila).
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'establishment' AND column_name = 'sell_orders_enabled';

-- 0.b La procedure v7 existe (1 fila) y la v8 todavía no (0 filas).
SELECT p.proname FROM pg_proc p
 WHERE p.proname IN ('register_shop_sale_with_elements_v7', 'register_shop_sale_with_elements_v8');

-- 0.c El detalle V6 existe y trae las anclas del PASO 4 (las dos en true).
SELECT "path",
       consulta_sql LIKE '%e.receive_pending_orders_enabled%' AS ancla_tienda,
       consulta_sql LIKE '%''receivedDate'', pfsso.received_date,%' AS ancla_fecha
  FROM public.sql_queries
 WHERE "path" = '/getProductForSaleStoreOrderV6';


-- #############################################################################
-- PASO 1 — Columna nueva: de qué pedido salió la venta
-- #############################################################################

ALTER TABLE public.shop_sale
    ADD COLUMN IF NOT EXISTS pfs_store_order_id uuid NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_sale_fk_pfs_store_order_id') THEN
        ALTER TABLE public.shop_sale
            ADD CONSTRAINT shop_sale_fk_pfs_store_order_id
            FOREIGN KEY (pfs_store_order_id) REFERENCES public.product_for_sale_store_order(id);
    END IF;
END $$;

-- La lectura del pedido busca su venta por esta columna.
CREATE INDEX IF NOT EXISTS shop_sale_pfs_store_order_id_idx
    ON public.shop_sale (pfs_store_order_id)
    WHERE pfs_store_order_id IS NOT NULL;

COMMENT ON COLUMN public.shop_sale.pfs_store_order_id IS
    'Pedido de tienda del que salió la venta ("Vender pedido"). NULL en las ventas normales y en todas las anteriores a 2026-10-02.';


-- #############################################################################
-- PASO 2 — PROCEDURE register_shop_sale_with_elements_v8
--
-- Igual a la v7 más una cosa: si _sale_properties trae pfsStoreOrderId, la
-- venta se liga al pedido. Antes de insertar se valida, con el pedido
-- bloqueado (FOR UPDATE) para que dos ventas simultáneas no lo vendan dos veces:
--   * que el pedido exista y sea de la misma tienda que la venta;
--   * que esté Recibido (store_status_id 22);
--   * que la tienda tenga habilitado "Vender pedidos";
--   * que no tenga ya una venta activa (status 52). Una venta cancelada libera
--     el pedido para volver a venderlo.
--
-- Sin pfsStoreOrderId se comporta exactamente como la v7: el front llama
-- siempre a la v8.
--
-- Anclas (todas del cuerpo de la v7, que pg_get_functiondef devuelve tal cual
-- se escribió en 2026-09-22-fecha-de-pago-y-cierre-congelado.sql):
--   a) el nombre de la procedure
--   b) la última variable del DECLARE           -> declaraciones nuevas
--   c) la asignación de _customer_id            -> validación del pedido
--   d) la última columna del INSERT de shop_sale -> pfs_store_order_id
--   e) el último valor del INSERT de shop_sale  -> _pfs_store_order_id
--   f) el mensaje de error                      -> v8
-- #############################################################################

DO $do$
DECLARE
    _def text;
    _anchor text;
    _replacement text;
    _nl text := chr(10);
    _anchors text[];
    _replacements text[];
    i int;
BEGIN
    SELECT pg_get_functiondef(p.oid) INTO _def
      FROM pg_proc p
     WHERE p.proname = 'register_shop_sale_with_elements_v7';

    IF _def IS NULL THEN
        RAISE EXCEPTION 'No existe register_shop_sale_with_elements_v7: no se crea la v8.';
    END IF;

    -- Si la v7 se corrió desde un archivo con fin de línea de Windows, el cuerpo guardado trae
    -- CRLF y las anclas de varias líneas tienen que usarlo también.
    IF position(chr(13) || chr(10) IN _def) > 0 THEN
        _nl := chr(13) || chr(10);
    END IF;

    _anchors := ARRAY[
        -- a)
        'public.register_shop_sale_with_elements_v7(',
        -- b)
        '    _delivery_deposit_reference_no VARCHAR(50);' || _nl || 'BEGIN',
        -- c)
        $a$        _customer_id := NULLIF(_sale_properties -> 'customer' ->> 'id', '')::UUID;$a$ || _nl,
        -- d)
        '            delivery_payment_status_id' || _nl || '        )' || _nl || '        VALUES (',
        -- e)
        '            _delivery_payment_status_id' || _nl || '        )' || _nl || '        RETURNING id INTO _new_ss_id;',
        -- f)
        'Error en registro de venta v7'
    ];

    _replacements := ARRAY[
        -- a)
        'public.register_shop_sale_with_elements_v8(',
        -- b)
        '    _delivery_deposit_reference_no VARCHAR(50);' || _nl
        || '    -- Pedido del que sale la venta ("Vender pedido"). NULL en una venta normal.' || _nl
        || '    _pfs_store_order_id uuid;' || _nl
        || '    _order_establishment_id uuid;' || _nl
        || '    _order_store_status_id INT;' || _nl
        || '    _order_received_status_id INT := 22;' || _nl
        || 'BEGIN',
        -- c)
        $r$        _customer_id := NULLIF(_sale_properties -> 'customer' ->> 'id', '')::UUID;

        -- ── Venta de un pedido ──────────────────────────────────────────────
        -- El pedido se bloquea hasta el final de la transacción: dos ventas
        -- simultáneas del mismo pedido no pueden pasar las dos la validación.
        _pfs_store_order_id := NULLIF(btrim(_sale_properties->>'pfsStoreOrderId'), '')::UUID;

        IF _pfs_store_order_id IS NOT NULL THEN
            SELECT pfsso.establishment_id, pfsso.store_status_id
              INTO _order_establishment_id, _order_store_status_id
              FROM product_for_sale_store_order pfsso
             WHERE pfsso.id = _pfs_store_order_id
               FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'El pedido de la venta no existe.';
            END IF;

            IF _order_establishment_id <> _establishment_id THEN
                RAISE EXCEPTION 'El pedido no pertenece a la tienda de la venta.';
            END IF;

            IF _order_store_status_id <> _order_received_status_id THEN
                RAISE EXCEPTION 'Solo se puede vender un pedido Recibido.';
            END IF;

            IF NOT COALESCE((SELECT e.sell_orders_enabled FROM establishment e WHERE e.id = _establishment_id), false) THEN
                RAISE EXCEPTION 'La tienda no tiene habilitada la venta de pedidos.';
            END IF;

            IF EXISTS (SELECT 1 FROM shop_sale ss
                        WHERE ss.pfs_store_order_id = _pfs_store_order_id
                          AND ss.status_id = _status_id) THEN
                RAISE EXCEPTION 'El pedido ya tiene una venta registrada.';
            END IF;
        END IF;
$r$,
        -- d)
        '            delivery_payment_status_id,' || _nl || '            pfs_store_order_id' || _nl || '        )' || _nl || '        VALUES (',
        -- e)
        '            _delivery_payment_status_id,' || _nl || '            _pfs_store_order_id' || _nl || '        )' || _nl || '        RETURNING id INTO _new_ss_id;',
        -- f)
        'Error en registro de venta v8'
    ];

    FOR i IN 1 .. array_length(_anchors, 1) LOOP
        _anchor := _anchors[i];
        _replacement := _replacements[i];
        IF (length(_def) - length(replace(_def, _anchor, ''))) / length(_anchor) <> 1 THEN
            RAISE EXCEPTION 'El ancla % no aparece exactamente una vez en la v7: no se crea la v8. Ancla: %', i, _anchor;
        END IF;
        _def := replace(_def, _anchor, _replacement);
    END LOOP;

    EXECUTE _def;
END
$do$;


-- #############################################################################
-- PASO 3 — Endpoint de registro de venta
--
-- Misma firma que /registerShopV7. El DELETE previo la hace idempotente.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/registerShopV8';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('registerShopV8','/registerShopV8','call register_shop_sale_with_elements_v8($1,$2,$3::uuid)','shop_sale','PATCH');


-- #############################################################################
-- PASO 4 — Lectura del detalle del pedido
--
-- Se deriva con replace() de la fila VIVA de /getProductForSaleStoreOrderV6 y
-- agrega dos cosas:
--   * establishment.sellOrdersEnabled, para saber si mostrar "Vender pedido";
--   * shopSaleId: la venta activa (status 52) que salió del pedido, o null. Con
--     venta, el detalle muestra "Ver venta" en lugar de "Vender pedido".
--
-- Las dos anclas aparecen una sola vez en la consulta; el guard lo verifica.
-- #############################################################################

DO $do$
DECLARE
    _sql text;
    _a1 text := 'e.receive_pending_orders_enabled';
    _a2 text := $a$'receivedDate', pfsso.received_date,$a$;
BEGIN
    IF EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderV7') THEN
        RAISE NOTICE '/getProductForSaleStoreOrderV7 ya existe: no se vuelve a crear.';
        RETURN;
    END IF;

    SELECT consulta_sql INTO _sql FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderV6';
    IF _sql IS NULL THEN
        RAISE EXCEPTION 'No existe /getProductForSaleStoreOrderV6.';
    END IF;

    IF (length(_sql) - length(replace(_sql, _a1, ''))) / length(_a1) <> 1
       OR (length(_sql) - length(replace(_sql, _a2, ''))) / length(_a2) <> 1 THEN
        RAISE EXCEPTION 'Las anclas no aparecen exactamente una vez en /getProductForSaleStoreOrderV6.';
    END IF;

    _sql := replace(_sql, _a1, _a1 || ',
		''sellOrdersEnabled'', e.sell_orders_enabled');
    _sql := replace(_sql, _a2, _a2 || '
    ''shopSaleId'', (select ss.id from shop_sale ss
                      where ss.pfs_store_order_id = pfsso.id and ss.status_id = 52
                      order by ss.creation_date desc limit 1),');

    INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
    SELECT 'getProductForSaleStoreOrderV7', '/getProductForSaleStoreOrderV7', _sql, principal_table, "type"
      FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderV6';
END
$do$;


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- La v8 existe y trae la columna nueva en el INSERT
-- SELECT pg_get_functiondef(p.oid) LIKE '%pfs_store_order_id%' AS liga_pedido
--   FROM pg_proc p WHERE p.proname = 'register_shop_sale_with_elements_v8';
--
-- -- Diff rápido: la v8 solo debe diferir de la v7 en las anclas del PASO 2
-- -- (copiar las dos definiciones a un archivo y compararlas)
-- SELECT pg_get_functiondef(p.oid) FROM pg_proc p
--  WHERE p.proname IN ('register_shop_sale_with_elements_v7','register_shop_sale_with_elements_v8');
--
-- -- Las rutas existen y ninguna está duplicada (2 filas, veces = 1)
-- SELECT "path", COUNT(*) AS veces FROM public.sql_queries
--  WHERE "path" IN ('/registerShopV8','/getProductForSaleStoreOrderV7')
--  GROUP BY "path" ORDER BY "path";
--
-- -- El detalle V7 trae los dos campos nuevos
-- SELECT consulta_sql LIKE '%sellOrdersEnabled%' AS trae_flag,
--        consulta_sql LIKE '%shopSaleId%' AS trae_venta
--   FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderV7';
--
-- -- Prueba real: habilitar "Vender pedidos" en una tienda, abrir un pedido
-- -- Recibido, "Vender pedido" y cobrar. Luego:
-- --   SELECT id, pfs_store_order_id FROM shop_sale ORDER BY creation_date DESC LIMIT 1;
-- -- y volver a abrir el pedido: debe mostrar "Ver venta".
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve a /registerShopV7 y /getProductForSaleStoreOrderV6 con
-- revertir el commit. La base se deja como estaba con:
--
-- DELETE FROM public.sql_queries
--  WHERE "path" IN ('/registerShopV8','/getProductForSaleStoreOrderV7');
-- DROP PROCEDURE IF EXISTS public.register_shop_sale_with_elements_v8(jsonb,jsonb,uuid);
--
-- La columna se puede dejar: es NULLABLE y la v7 no la escribe. Para sacarla —y
-- perder qué venta salió de qué pedido—:
-- ALTER TABLE public.shop_sale DROP CONSTRAINT IF EXISTS shop_sale_fk_pfs_store_order_id;
-- DROP INDEX IF EXISTS shop_sale_pfs_store_order_id_idx;
-- ALTER TABLE public.shop_sale DROP COLUMN IF EXISTS pfs_store_order_id;
-- #############################################################################
