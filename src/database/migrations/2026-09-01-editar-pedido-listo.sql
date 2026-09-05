-- =============================================================================
-- Migración: editar un pedido que ya está en Listo(13)
-- Fecha: 2026-09-01
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Contexto: hoy un pedido se deja de poder editar al llegar a Listo. El
-- procedure update_product_for_sale_order_with_elements guarda solo nombre y
-- notas cuando el estado no es Pendiente(11) ni En curso(12), y la pantalla de
-- edición esconde la tabla de productos.
--
-- El motivo es real: al pasar a Listo, manage_product_for_sale_order_state_v5 ya
-- DESCONTÓ cada producto de finished_product/bodega y lo registró en
-- product_for_sale/in_transit. Editar el pedido después mueve inventario:
--
--     producto que se AGREGA  -> hay que descontar más de bodega
--     producto que se QUITA   -> hay que devolverlo a bodega
--
-- El caso peligroso es el primero: si no alcanza el inventario NO puede quedar la
-- mitad aplicada. Se resuelve solo: todo el ajuste corre dentro de un único CALL,
-- o sea una sola transacción, así que el RAISE de remove_inventory_element
-- revierte inventario, elementos y cabecera juntos.
--
-- De paso se arregla un bug del mismo procedure: Preparado(64) nació DESPUÉS de
-- esa lista de estados y nunca se agregó, así que hoy editar los productos de un
-- pedido Preparado responde OK y no guarda nada.
--
--     estado        productos          inventario        verificación
--     ---------------------------------------------------------------
--     Pendiente(11) se editan          no se mueve       -
--     En curso(12)  se editan          no se mueve       -
--     Preparado(64) se editan (NUEVO)  no se mueve       se borra si cambian
--     Listo(13)     se editan (NUEVO)  AJUSTE por delta  se borra si cambian
--     resto         solo nombre/notas  no se mueve       intacta
--
-- La verificación se borra porque una firma que sobreviviera a la edición
-- certificaría productos distintos de los que se despachan; es el mismo criterio
-- de 2026-08-30-retroceder-preparado-a-en-curso.sql. Volver a firmar es OPCIONAL:
-- el PASO 3 habilita el botón "Verificar" también en Listo, pero el pedido puede
-- seguir a Entregado o Devuelto sin firma (esas ramas del v5 no la piden).
--
-- Editar SOLO el nombre o las notas no borra la firma ni mueve inventario: el
-- procedure compara la lista de productos antes y después.
--
--     puede editar en Listo = can('orders.edit')
--                             AND can('orders.editAfterPending')
--                             AND can('orders.editReady')            <- NUEVA
--
-- ENFOQUE 100% ADITIVO: procedure y endpoints nuevos. No se toca ninguna tabla,
-- query ni procedure existente; update_product_for_sale_order_with_elements (v1) y
-- /updateProductForSaleStoreOrder quedan vivos, el front deja de llamarlos.
--
-- CUÁNDO CORRERLA: ANTES de desplegar el front nuevo.
--
-- IMPORTANTE: paths viaja en el JWT, que se arma al hacer login. El PASO 4 NO
-- aplica hasta que el usuario vuelva a iniciar sesión.
-- =============================================================================


-- #############################################################################
-- PASO 0 — Dependencias
--
-- Falla RUIDOSAMENTE si falta algo, en vez de dejar un procedure que reventaría
-- recién al usarlo.
-- #############################################################################

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc
                    WHERE proname = 'update_product_for_sale_order_with_elements') THEN
        RAISE EXCEPTION 'No existe update_product_for_sale_order_with_elements: esta base no es la esperada';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'product_for_sale_store_order'
                      AND column_name = 'verified_by_user_id') THEN
        RAISE EXCEPTION 'Falta 2026-08-29-verificacion-pedidos-bodega.sql: no existe product_for_sale_store_order.verified_by_user_id';
    END IF;

    -- El ajuste de inventario expresa la diferencia en la medida cuya
    -- unit_base_quantity es 1, para no dividir y no dejar polvo decimal. Si algún
    -- unit_base en uso no tiene esa medida, el ajuste no se puede hacer.
    IF EXISTS (
        SELECT 1
        FROM (SELECT DISTINCT fp.unit_base_id
              FROM finished_product fp
              WHERE fp.unit_base_id IS NOT NULL) u
        WHERE NOT EXISTS (SELECT 1 FROM measure m
                           WHERE m.unit_base_id = u.unit_base_id
                             AND m.unit_base_quantity = 1)
    ) THEN
        RAISE EXCEPTION 'Hay unit_base sin una medida con unit_base_quantity = 1; el ajuste de inventario no puede expresar la diferencia';
    END IF;
END $$;


-- #############################################################################
-- PASO 1 — update_product_for_sale_order_with_elements_v2
--
-- Clon del v1 con un parámetro nuevo, _creator_user_id —los movimientos de
-- inventario necesitan autor, y el v1 no recibía ninguno—, y tres bloques nuevos:
--
--   a) La lista de estados con edición real de productos suma Preparado(64) y
--      Listo(13). El resto sigue cayendo en el atajo "solo nombre y notas".
--   b) Un recorrido de DIFERENCIAS producto por producto, en unidades base. Sirve
--      para dos cosas: saber si la lista cambió (borrar la firma) y, solo en
--      Listo, mover el inventario de esa diferencia.
--   c) La validación de stock del bucle de inserción se aplica SOLO cuando el
--      pedido no mueve inventario. En Listo esa validación estaría mal: compara
--      la cantidad COMPLETA del pedido contra un bodega del que ya se descontó.
--
-- Por qué diferencias y no "revertir todo y volver a aplicar": mover solo lo que
-- cambió deja el historial de inventario legible —un pedido de 20 productos al
-- que se le corrige uno genera 2 movimientos, no 80— y no toca los productos que
-- el usuario no editó.
--
-- Las devoluciones van PRIMERO (ORDER BY delta ASC): cambiar un producto por otro
-- o bajar uno para subir otro no falla por stock que el mismo guardado libera.
--
-- Los action_type son los que ya existen: 8/9 son los del paso a Listo y 10/15
-- los de la devolución desde la tienda. Lo que distingue el movimiento es el
-- comentario, que es lo que muestra el log de actividad.
-- #############################################################################

CREATE OR REPLACE PROCEDURE public.update_product_for_sale_order_with_elements_v2(IN _order_id uuid, IN _order_properties jsonb, IN _order_elements jsonb, IN _creator_user_id uuid)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    _item JSONB;

    _product_for_sale_id UUID;
	_finished_product_id UUID;
    _quantity NUMERIC;
    _measure_id INT;
    _price NUMERIC;
    _total_price NUMERIC;

    _fp_id uuid;
    _fp_name TEXT;
    _available_qty NUMERIC;
    _requested_qty NUMERIC;
	_order_status_id INT;

    -- NUEVO v2
    _moves_inventory BOOLEAN;
    _elements_changed BOOLEAN := FALSE;
    _delta RECORD;
    _delta_unit_base_id INT;
    _base_measure_id INT;

BEGIN
    BEGIN

		-- Bloqueo de fila para evitar conflictos concurrentes
	    SELECT factory_status_id INTO _order_status_id
	    FROM product_for_sale_store_order
	    WHERE id = _order_id
	    FOR UPDATE;

		-- Estados sin edición de productos: se guarda solo nombre y notas.
		-- Idéntico al v1, salvo que Preparado(64) y Listo(13) ya no caen acá.
	    IF _order_status_id NOT IN (11, 12, 64, 13) THEN
	        update product_for_sale_store_order
			set name = _order_properties->>'name', comment = _order_properties->>'comment', updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
			where id = _order_id;
			return;
	    END IF;

		-- Solo en Listo el producto ya salió de bodega, así que solo ahí hay
		-- inventario que ajustar.
		_moves_inventory := (_order_status_id = 13);

		-- Un elemento sin producto, sin medida o sin cantidad haría que la
		-- diferencia lo lea como "producto eliminado" y devuelva a bodega algo que
		-- en realidad sigue en el pedido. Se corta antes de mover nada.
		IF EXISTS (
			SELECT 1 FROM jsonb_array_elements(_order_elements) it
			WHERE (it -> 'productForSale' ->> 'id') IS NULL
			   OR (it -> 'measure' ->> 'id') IS NULL
			   OR (it ->> 'quantity') IS NULL
		) THEN
			RAISE EXCEPTION 'El pedido trae un producto sin medida o sin cantidad';
		END IF;

		-- Diferencia producto por producto, en unidades base. Solo aparecen los
		-- productos que cambiaron de cantidad, entraron o salieron del pedido.
		FOR _delta IN
			WITH antes AS (
				SELECT e.product_for_sale_id AS pfs_id,
				       SUM(e.quantity * m.unit_base_quantity) AS base_qty
				FROM product_for_sale_store_order_element e
				JOIN measure m ON m.id = e.measure_id
				WHERE e.pfsso_id = _order_id
				GROUP BY e.product_for_sale_id
			),
			despues AS (
				-- numeric(12,5) es el tipo de la columna: la cantidad se redondea igual
				-- que al insertarla, así que la diferencia coincide con lo que queda
				-- guardado y no deja descuadre entre el pedido y el inventario.
				SELECT (it -> 'productForSale' ->> 'id')::uuid AS pfs_id,
				       SUM((it ->> 'quantity')::numeric(12,5) * m.unit_base_quantity) AS base_qty
				FROM jsonb_array_elements(_order_elements) it
				JOIN measure m ON m.id = (it -> 'measure' ->> 'id')::int
				GROUP BY 1
			)
			SELECT COALESCE(d.pfs_id, a.pfs_id) AS pfs_id,
			       COALESCE(d.base_qty, 0) - COALESCE(a.base_qty, 0) AS delta
			FROM antes a
			FULL OUTER JOIN despues d ON d.pfs_id = a.pfs_id
			WHERE COALESCE(d.base_qty, 0) <> COALESCE(a.base_qty, 0)
			ORDER BY 2 ASC   -- primero las devoluciones, después los consumos
		LOOP
			_elements_changed := TRUE;
			CONTINUE WHEN NOT _moves_inventory;

			-- El inventario de bodega se dirige por finished_product y el de
			-- tránsito por product_for_sale, igual que en el paso a Listo.
			SELECT fp.id, fp.unit_base_id
			  INTO _fp_id, _delta_unit_base_id
			FROM product_for_sale pfs
			JOIN finished_product fp ON fp.id = pfs.finished_product_id
			WHERE pfs.id = _delta.pfs_id;

			IF _fp_id IS NULL THEN
				RAISE EXCEPTION 'Producto con ID % no existe', _delta.pfs_id;
			END IF;

			-- La medida con unit_base_quantity = 1 deja pasar la diferencia tal
			-- cual: sin división no hay redondeo que deje polvo en el inventario.
			SELECT id INTO _base_measure_id
			FROM measure
			WHERE unit_base_id = _delta_unit_base_id AND unit_base_quantity = 1
			LIMIT 1;

			IF _base_measure_id IS NULL THEN
				RAISE EXCEPTION 'No existe una medida base para la unidad %', _delta_unit_base_id;
			END IF;

			IF _delta.delta < 0 THEN
				-- El pedido pide MENOS: lo que sobra sale de tránsito y vuelve a bodega.
				call add_remove_inventory_element(
					'product_for_sale', 'in_transit', _delta.pfs_id, _base_measure_id,
					abs(_delta.delta), _creator_user_id, 'Salida de transito por edicion de pedido', 10);

				call add_remove_inventory_element(
					'finished_product', 'bodega', _fp_id, _base_measure_id,
					abs(_delta.delta), _creator_user_id, 'Reingreso a bodega por edicion de pedido', 15);
			ELSE
				-- El pedido pide MÁS: se descuenta de bodega y se registra en tránsito.
				-- Acá es donde revienta si no alcanza, y con eso se cae toda la edición.
				call add_remove_inventory_element(
					'finished_product', 'bodega', _fp_id, _base_measure_id,
					_delta.delta, _creator_user_id, 'Consumo de bodega por edicion de pedido', 8);

				call add_remove_inventory_element(
					'product_for_sale', 'in_transit', _delta.pfs_id, _base_measure_id,
					_delta.delta, _creator_user_id, 'Registro en transito por edicion de pedido', 9);
			END IF;

		END LOOP;

		-- Actualizar propiedades de la orden. La firma se borra solo si cambió la
		-- lista de productos: corregir el nombre no invalida una verificación.
	    UPDATE product_for_sale_store_order
	    SET
	        name = _order_properties->>'name',
	        comment = _order_properties->>'comment',
	        establishment_id = (_order_properties -> 'establishment' ->> 'id')::UUID,
	        final_amount = (_order_properties ->> 'finalAmount')::NUMERIC,
	        verified_by_user_id = CASE WHEN _elements_changed THEN NULL ELSE verified_by_user_id END,
	        verified_date       = CASE WHEN _elements_changed THEN NULL ELSE verified_date END,
			updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
	    	WHERE id = _order_id;

	    -- Eliminar elementos anteriores
	    DELETE FROM product_for_sale_store_order_element
	    WHERE pfsso_id = _order_id;

        -- Iterar elementos
        FOR _item IN SELECT * FROM jsonb_array_elements(_order_elements)
        LOOP
            _product_for_sale_id := (_item -> 'productForSale' ->> 'id')::UUID;
			_finished_product_id := (_item -> 'productForSale' -> 'finishedProduct' ->> 'id')::UUID;
            _quantity := (_item ->> 'quantity')::NUMERIC;
            _measure_id := (_item -> 'measure' ->> 'id')::INT;
            _price := (_item ->> 'price')::NUMERIC;
            _total_price := (_item ->> 'totalPrice')::NUMERIC;

            IF _moves_inventory THEN
                -- En Listo el stock ya lo validó la diferencia, producto por
                -- producto y contra lo que realmente falta descontar. Acá solo se
                -- comprueba que el producto exista.
                SELECT fp.id INTO _fp_id
                FROM product_for_sale pfs
                JOIN finished_product fp ON fp.id = pfs.finished_product_id
                WHERE pfs.id = _product_for_sale_id;

                IF _fp_id IS NULL THEN
                    RAISE EXCEPTION 'Producto con ID % no existe', _product_for_sale_id;
                END IF;
            ELSE
                -- Validar existencia y stock (bloque del v1, sin cambios)
                SELECT
                    fp.id,
                    fp.name,
                    ie.quantity * m1.unit_base_quantity,
                    _quantity * m2.unit_base_quantity
                INTO
                    _fp_id,
                    _fp_name,
                    _available_qty,
                    _requested_qty
                FROM product_for_sale pfs
                JOIN finished_product fp ON fp.id = pfs.finished_product_id
                JOIN measure m2 ON m2.id = _measure_id
                LEFT JOIN inventory_element ie ON ie.element_fk = fp.id
                LEFT JOIN measure m1 ON m1.id = ie.measure_id
                LEFT JOIN inventory i ON i.id = ie.inventory_id
                WHERE
                    pfs.id = _product_for_sale_id AND
                    i.inventory_type = 'finished_product' AND
                    i.unit_name = 'bodega'
                LIMIT 1;

                IF _fp_id IS NULL THEN
                    RAISE EXCEPTION 'Producto con ID % no existe en inventario', _product_for_sale_id;
                END IF;

                IF _available_qty IS NULL OR _available_qty < _requested_qty THEN
                    RAISE EXCEPTION 'Stock insuficiente para % (solicitado: %, disponible: %).',
                        _fp_name, _requested_qty, COALESCE(_available_qty, 0);
                END IF;
            END IF;

            -- Insertar elemento si la validación fue exitosa
            INSERT INTO product_for_sale_store_order_element (
                pfsso_id,
                product_for_sale_id,
                quantity,
                measure_id,
                price,
                total_price
            )
            VALUES (
                _order_id,
                _product_for_sale_id,
                _quantity,
                _measure_id,
                _price,
                _total_price
            );
        END LOOP;

    EXCEPTION WHEN OTHERS THEN
        RAISE;
    END;
END;
$procedure$
;


-- #############################################################################
-- PASO 2 — /updateProductForSaleStoreOrderV2
--
-- $4 es el usuario que edita: queda como autor de los movimientos de inventario
-- en el log de actividad. /updateProductForSaleStoreOrder (v1) no se toca.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/updateProductForSaleStoreOrderV2';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('updateProductForSaleStoreOrderV2','/updateProductForSaleStoreOrderV2','call update_product_for_sale_order_with_elements_v2($1::uuid, $2, $3, $4::uuid)','product_for_sale_store_order','PATCH');


-- #############################################################################
-- PASO 3 — /verifyProductForSaleStoreOrderV2
--
-- Clon de /verifyProductForSaleStoreOrderPrepared con un solo cambio:
-- factory_status_id in (64, 13) en vez de = 64. Es lo que permite volver a firmar
-- un pedido Listo que perdió la verificación al editarse.
--
-- Los otros dos guards quedan igual: la firma no se reemplaza
-- (verified_by_user_id is null) y el verificador tiene que ser un usuario activo
-- con rol Sistema(1), Bodega(7) o Administrador(9).
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/verifyProductForSaleStoreOrderV2';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('verifyProductForSaleStoreOrderV2','/verifyProductForSaleStoreOrderV2','update product_for_sale_store_order
set verified_by_user_id = $2::uuid,
    verified_date = timezone(''UTC''::text, CURRENT_TIMESTAMP),
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1::uuid
  and factory_status_id in (64, 13)
  and verified_by_user_id is null
  and exists (select 1 from "user" u
               where u.id = $2::uuid
                 and u.role_id in (1, 7, 9)
                 and u.status_id = 2)','product_for_sale_store_order','PATCH');


-- #############################################################################
-- PASO 4 — Capacidad orders.editReady
--
-- Tercer escalón de la escalera que ya existe:
--
--     orders.edit              editar un pedido, incluso Pendiente
--     orders.editAfterPending  seguir editándolo pasado Pendiente
--     orders.editReady         editar uno que ya está Listo (mueve inventario)
--
-- Los tres hacen falta para editar en Listo: editReady por sí sola no habilita
-- nada. El rol Sistema (id 1) no necesita ninguna: can() le devuelve true antes
-- de mirar paths.
--
-- El UPDATE declara las DOS capacidades que le faltan a un rol que hoy solo tiene
-- orders.edit, para no tener que correr dos sentencias. Es idempotente: correrlo
-- dos veces deja una sola entrada de cada una.
-- #############################################################################

UPDATE "role" r
SET paths = (
    COALESCE(r.paths::jsonb, '[]'::jsonb) || (
        SELECT COALESCE(jsonb_agg(nueva.entrada), '[]'::jsonb)
        FROM (VALUES
            ('orders.editAfterPending'),
            ('orders.editReady')
        ) AS caps(cap)
        CROSS JOIN LATERAL (
            SELECT jsonb_build_object(
                'name',         'perm:' || caps.cap,
                'route',        'perm:' || caps.cap,
                'matchPattern', '^perm:' || replace(caps.cap, '.', '\.') || '$'
            ) AS entrada
        ) AS nueva
        WHERE NOT COALESCE(r.paths::jsonb, '[]'::jsonb) @> jsonb_build_array(
            jsonb_build_object('matchPattern', nueva.entrada->>'matchPattern')
        )
    )
)::text
WHERE r.id = 0;  -- <<<<<< CAMBIAR por el id del rol. Con 0 no afecta ninguna fila.


-- #############################################################################
-- PASO 5 — VERIFICAR
-- #############################################################################

-- 5.a El procedure y los endpoints quedaron una sola vez.
-- SELECT proname FROM pg_proc WHERE proname = 'update_product_for_sale_order_with_elements_v2';
-- SELECT "path", COUNT(*) AS veces FROM sql_queries
--  WHERE "path" IN ('/updateProductForSaleStoreOrderV2','/verifyProductForSaleStoreOrderV2')
--  GROUP BY "path" ORDER BY "path";

-- 5.b Los originales siguen intactos.
-- SELECT "path" FROM sql_queries
--  WHERE "path" IN ('/updateProductForSaleStoreOrder','/verifyProductForSaleStoreOrderPrepared');

-- 5.c Quién quedó con la capacidad.
-- SELECT r.id, r."name", p->>'name' AS capacidad
--   FROM "role" r, jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
--  WHERE p->>'matchPattern' = '^perm:orders\.editReady$'
--  ORDER BY r.id;

-- 5.d CRÍTICO: ningún rol con editReady sin los dos escalones de abajo. Esa
--     combinación no edita nada. Si devuelve filas, volver al PASO 4 con esos ids.
-- SELECT r.id, r."name"
--   FROM "role" r
--  WHERE COALESCE(r.paths::jsonb, '[]'::jsonb) @> jsonb_build_array(
--            jsonb_build_object('matchPattern', '^perm:orders\.editReady$'))
--    AND NOT (COALESCE(r.paths::jsonb, '[]'::jsonb) @> jsonb_build_array(
--                 jsonb_build_object('matchPattern', '^perm:orders\.edit$'))
--             AND COALESCE(r.paths::jsonb, '[]'::jsonb) @> jsonb_build_array(
--                 jsonb_build_object('matchPattern', '^perm:orders\.editAfterPending$')));

-- 5.e Los regex no se pisan entre sí. Debe dar: true, true, false, false.
-- SELECT 'perm:orders.editReady' ~ '^perm:orders\.editReady$'        AS ready_ok,
--        'perm:orders.edit'      ~ '^perm:orders\.edit$'             AS edit_ok,
--        'perm:orders.editReady' ~ '^perm:orders\.edit$'             AS ready_no_da_edit,
--        'perm:orders.edit'      ~ '^perm:orders\.editReady$'        AS edit_no_da_ready;

-- 5.f Prueba en vivo, con un pedido Listo de prueba: bajar la cantidad de un
--     producto y comprobar que bodega sube, tránsito baja y el pedido queda sin
--     firma. Cambiar el :id y el JSON por los del pedido.
--
-- SELECT ie.quantity, i.unit_name FROM inventory_element ie
--   JOIN inventory i ON i.id = ie.inventory_id
--  WHERE ie.element_fk IN ('<finished_product_id>','<product_for_sale_id>');
--
-- SELECT iea.creation_date, iea."comment", iea.quantity, at."name"
--   FROM inventory_element_action iea
--   JOIN action_type at ON at.id = iea.action_type_id
--  WHERE iea."comment" LIKE '%edicion de pedido%'
--  ORDER BY iea.creation_date DESC LIMIT 10;


-- #############################################################################
-- PASO 6 — ROLLBACK
-- #############################################################################
--
-- El front vuelve a los endpoints anteriores revirtiendo el commit; la base se
-- deja como estaba con:
--
-- DELETE FROM public.sql_queries WHERE "path" IN
--   ('/updateProductForSaleStoreOrderV2','/verifyProductForSaleStoreOrderV2');
-- DROP PROCEDURE IF EXISTS public.update_product_for_sale_order_with_elements_v2(uuid, jsonb, jsonb, uuid);
--
-- UPDATE "role" r SET paths = (
--     SELECT COALESCE(jsonb_agg(p), '[]'::jsonb)
--     FROM jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
--     WHERE p->>'matchPattern' IS DISTINCT FROM '^perm:orders\.editReady$'
-- )::text WHERE r.id = 0;  -- <<<<<< id del rol
--
-- Lo que NO se deshace: el inventario que ya se movió por una edición. Si hay que
-- revertirlo, es a mano desde las pantallas de inventario.
