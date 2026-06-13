-- DROP PROCEDURE public.add_inventory_element(text, text, uuid, int4, numeric, uuid, text, int4);

CREATE OR REPLACE PROCEDURE public.add_inventory_element(IN _inventory_type text, IN _unit_name text, IN _element_fk uuid, IN _measure_id integer, IN _quantity numeric, IN _creator_user_id uuid, IN _comment text, IN _action_type_id integer)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    _base_quantity NUMERIC(12,5);
    _base_unit_id INT;

    _normalized_quantity NUMERIC(12,5);

    _inventory_id uuid;
    _inventory_element_id INT;
    _existing_quantity NUMERIC(12,5);
    _element_measure_id INT;
    _element_base_quantity NUMERIC(12,5);
BEGIN
    -- 1. Obtener información de la medida usada para registrar
    SELECT unit_base_quantity, unit_base_id
    INTO _base_quantity, _base_unit_id
    FROM measure
    WHERE id = _measure_id;

    -- 2. Calcular la cantidad en unidades base
    _normalized_quantity := _base_quantity * _quantity;

    -- 3. Verificar si el inventario ya existe
    SELECT i.id
    INTO _inventory_id
    FROM inventory i
    WHERE i.inventory_type = _inventory_type AND i.unit_name = _unit_name
    LIMIT 1;

    IF _inventory_id IS NULL THEN
        INSERT INTO inventory (
            name, person_in_charge_id, inventory_type, unit_name, creator_user_id
        )
        VALUES (
            _inventory_type || '_' || _unit_name,
            _creator_user_id,
            _inventory_type,
            _unit_name,
            _creator_user_id
        )
        RETURNING id INTO _inventory_id;
    END IF;

    -- 4. Verificar si el elemento ya existe en el inventario
    SELECT ie.id, ie.quantity, m.id, m.unit_base_quantity
    INTO _inventory_element_id, _existing_quantity, _element_measure_id, _element_base_quantity
    FROM inventory_element ie
    JOIN measure m ON m.id = ie.measure_id
    WHERE ie.inventory_id = _inventory_id AND ie.element_fk = _element_fk
    LIMIT 1
    FOR UPDATE;

    -- 5. Si no existe el elemento, crearlo
    IF _inventory_element_id IS NULL THEN
        SELECT id, unit_base_quantity
        INTO _element_measure_id, _element_base_quantity
        FROM measure
        WHERE name = CASE
                        WHEN _base_unit_id = 1 THEN 'Unidad'
                        ELSE 'Libra'
                    END
        LIMIT 1;

        INSERT INTO inventory_element (
            inventory_id, element_type, element_table, element_fk,
            measure_id, quantity, creator_user_id
        )
        VALUES (
            _inventory_id,
            _inventory_type,
            _inventory_type,
            _element_fk,
            _element_measure_id,
            _normalized_quantity / _element_base_quantity,
            _creator_user_id
        )
        RETURNING id INTO _inventory_element_id;

    -- 6. Si ya existe, actualizar la cantidad
    ELSE
        UPDATE inventory_element
        SET quantity = _existing_quantity + (_normalized_quantity / _element_base_quantity),
			updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
        WHERE id = _inventory_element_id;
    END IF;

    -- 7. Registrar la acción en el historial de inventario
    INSERT INTO inventory_element_action (
        comment, source_inventory_element_id, quantity, measure_id,
        action_type_id, creator_user_id
    )
    VALUES (
        _comment,
        _inventory_element_id,
        _normalized_quantity / _element_base_quantity,
        _element_measure_id,
        _action_type_id,
        _creator_user_id
    );
END;
$procedure$
;

-- DROP PROCEDURE public.add_raw_material_order_payment(uuid, numeric, int4);

CREATE OR REPLACE PROCEDURE public.add_raw_material_order_payment(IN raw_material_order_id uuid, IN amount numeric, IN payment_type_id integer)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    raw_material_paid_amount NUMERIC(9,2);
    raw_material_pending_amount NUMERIC(9,2);
    raw_material_final_amount NUMERIC(9,2);
    raw_material_payment_status_id INT;
    paid_status_id INT := 5;
    partial_status_id INT := 4;
BEGIN
    -- Inicio transacción explícita
    BEGIN
        -- Bloquear fila para actualización
        SELECT paid_amount,
               final_amount,
               payment_status_id
        INTO raw_material_paid_amount,
             raw_material_final_amount,
             raw_material_payment_status_id
        FROM raw_material_order
        WHERE id = raw_material_order_id
        FOR UPDATE;

        -- Calcular nuevo monto pagado y pendiente
        raw_material_paid_amount := raw_material_paid_amount + amount;
        raw_material_pending_amount := raw_material_final_amount - raw_material_paid_amount;

        -- Validar exceso de pago
        IF raw_material_pending_amount < 0 THEN
            RAISE EXCEPTION 'El monto del pago excede el monto pendiente.';
        END IF;

        -- Determinar nuevo estado de pago
        IF raw_material_pending_amount <= 0 THEN
            raw_material_payment_status_id := paid_status_id;
        ELSIF raw_material_pending_amount < raw_material_final_amount THEN
            raw_material_payment_status_id := partial_status_id;
        END IF;

        -- Insertar nuevo pago
        INSERT INTO raw_material_order_payment (
            raw_material_order_id,
            amount,
            payment_type_id
        )
        VALUES (
            raw_material_order_id,
            amount,
            payment_type_id
        );

        -- Actualizar orden con nuevos montos y estado
        UPDATE raw_material_order
        SET payment_status_id = raw_material_payment_status_id,
            paid_amount = raw_material_paid_amount,
            pending_amount = raw_material_pending_amount,
			updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
        WHERE id = raw_material_order_id;

    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en adición de pago para pedido de materia prima: %', SQLERRM;
    END;
END;
$procedure$
;

-- DROP PROCEDURE public.add_remove_inventory_element(text, text, uuid, int4, numeric, uuid, text, int4);

CREATE OR REPLACE PROCEDURE public.add_remove_inventory_element(IN _inventory_type text, IN _unit_name text, IN _element_fk uuid, IN _measure_id integer, IN _quantity numeric, IN _creator_user_id uuid, IN _comment text, IN _action_type_id integer)
 LANGUAGE plpgsql
AS $procedure$
BEGIN
    IF _action_type_id in (1, 2, 5, 6, 9, 11, 12, 15, 16) THEN
        CALL add_inventory_element(
            _inventory_type,
            _unit_name,
            _element_fk,
            _measure_id,
            _quantity,
            _creator_user_id,
            _comment,
            _action_type_id
        );

    ELSIF _action_type_id in (3, 4, 7, 8, 10, 13, 14) THEN
        CALL remove_inventory_element(
            _inventory_type,
            _unit_name,
            _element_fk,
            _measure_id,
            _quantity,
            _creator_user_id,
            _comment,
            _action_type_id
        );
    ELSE
        RAISE EXCEPTION 'El tipo de acción % no es válido.', _action_type_id;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$procedure$
;

-- DROP FUNCTION public.armor(bytea);

CREATE OR REPLACE FUNCTION public.armor(bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_armor$function$
;

-- DROP FUNCTION public.armor(bytea, _text, _text);

CREATE OR REPLACE FUNCTION public.armor(bytea, text[], text[])
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_armor$function$
;

-- DROP PROCEDURE public.cancel_shop_sale(uuid, uuid);

CREATE OR REPLACE PROCEDURE public.cancel_shop_sale(IN _shop_sale_id uuid, IN _creator_user_id uuid)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
	_shop_sale_status_id INT;
	_curr_pfs_element RECORD;
	_establishment_id UUID;

	_inventory_type varchar(25) := 'product_for_sale';
	_action_type_id INT := 16;
	_comment varchar(100) := 'Reingreso de producto en tienda por cancelacion de venta';
	
	_curr_source_element_fk_id UUID;
	_curr_target_element_fk_id UUID;
BEGIN

	-- Bloqueo de fila para evitar conflictos concurrentes
    SELECT status_id, establishment_id INTO _shop_sale_status_id, _establishment_id
    FROM shop_sale
    WHERE id = _shop_sale_id
    FOR UPDATE;

	if _shop_sale_status_id <> 52 then
		RAISE EXCEPTION 'El estado de la venta no se encuentra Activo para pasar el estado a Cancelado';
	end if;

	FOR _curr_pfs_element IN SELECT product_for_sale_id, quantity, measure_id
		FROM shop_sale_element
		WHERE shop_sale_id = _shop_sale_id 
	LOOP
		
		-- INGRESO de elemento de inventario
		
		call add_remove_inventory_element(
			_inventory_type, 
			_establishment_id::text, 
			_curr_pfs_element.product_for_sale_id, 
			_curr_pfs_element.measure_id, 
			_curr_pfs_element.quantity, 
			_creator_user_id, 
			_comment, 
			_action_type_id);


    END LOOP;

	update shop_sale 
	set status_id = 54, updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
	where id = _shop_sale_id;
	
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en cancelacion de venta: %', SQLERRM;

END;
$procedure$
;

-- DROP PROCEDURE public.create_product_for_sale_order_with_elements(jsonb, jsonb);

CREATE OR REPLACE PROCEDURE public.create_product_for_sale_order_with_elements(IN _order_properties jsonb, IN _order_elements jsonb)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    _new_order_id UUID;
    _factory_status_id INT := 11;
	_store_status_id INT := 19;
    _item JSONB;

    _product_for_sale_id UUID;
    _quantity NUMERIC;
    _measure_id INT;
    _price NUMERIC;
    _total_price NUMERIC;

    _fp_id uuid;
    _fp_name TEXT;
    _available_qty NUMERIC;
    _requested_qty NUMERIC;

BEGIN
    BEGIN
        -- Paso 1: Insertar encabezado de orden
        INSERT INTO product_for_sale_store_order (
            name,
            comment,
            establishment_id,
            final_amount,
            store_status_id,
            factory_status_id,
            creator_user_id
        )
        VALUES (
            _order_properties ->> 'name',
            _order_properties ->> 'comment',
            (_order_properties -> 'establishment' ->> 'id')::UUID,
            (_order_properties ->> 'finalAmount')::NUMERIC,
            _store_status_id,
            _factory_status_id,
            (_order_properties -> 'creatorUser' ->> 'id')::UUID
        )
        RETURNING id INTO _new_order_id;

        -- Paso 2: Iterar elementos
        FOR _item IN SELECT * FROM jsonb_array_elements(_order_elements)
        LOOP
            _product_for_sale_id := (_item -> 'productForSale' ->> 'id')::UUID;
            _quantity := (_item ->> 'quantity')::NUMERIC;
            _measure_id := (_item -> 'measure' ->> 'id')::INT;
            _price := (_item ->> 'price')::NUMERIC;
            _total_price := (_item ->> 'totalPrice')::NUMERIC;

            -- Validar existencia y stock
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
                RAISE EXCEPTION 'Producto con ID % no existe en inventario.', _product_for_sale_id;
            END IF;

            IF _available_qty IS NULL OR _available_qty < _requested_qty THEN
                RAISE EXCEPTION 'Stock insuficiente para % (solicitado: %, disponible: %).',
                    _fp_name, _requested_qty, COALESCE(_available_qty, 0);
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
                _new_order_id,
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

-- DROP PROCEDURE public.create_raw_material_order_with_elements(jsonb, jsonb);

CREATE OR REPLACE PROCEDURE public.create_raw_material_order_with_elements(IN order_properties jsonb, IN order_elements jsonb)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    _new_order_id UUID;
    status_id INT := 38;
    payment_status_id INT := 3;
BEGIN
    -- Iniciar transacción implícitamente controlada
    BEGIN

        -- Insertar en raw_material_order
        INSERT INTO raw_material_order (
            name,
            description,
            provider_id,
            payment_type_id,
            pending_amount,
            paid_amount,
            final_amount,
            payment_status_id,
            status_id,
            creator_user_id,
            raw_material_by_provider_type_id
        )
        VALUES (
            order_properties->>'name',
            order_properties->>'description',
            (order_properties->'provider'->>'id')::UUID,
            (order_properties->'paymentType'->>'id')::INT,
            (order_properties->>'pendingAmount')::NUMERIC,
            (order_properties->>'paidAmount')::NUMERIC,
            (order_properties->>'finalAmount')::NUMERIC,
            payment_status_id,
            status_id,
            (order_properties->'creatorUser'->>'id')::UUID,
            COALESCE((order_properties->>'rawMaterialByProviderTypeId')::INT, 1)
        )
        RETURNING id INTO _new_order_id;

        -- Insertar los elementos asociados
        INSERT INTO raw_material_order_element (
            raw_material_order_id,
            raw_material_by_provider_id,
            quantity,
            discount,
            measure_id,
            price,
            subtotal_price,
            total_discount,
            total_price
        )
        SELECT 
            _new_order_id,
            (elem->'rawMaterialByProvider'->>'id')::UUID,
            (elem->>'quantity')::NUMERIC,
            (elem->>'discount')::NUMERIC,
            (elem->'measure'->>'id')::INT,
            (elem->>'price')::NUMERIC,
            (elem->>'subtotalPrice')::NUMERIC,
            (elem->>'totalDiscount')::NUMERIC,
            (elem->>'totalPrice')::NUMERIC
        FROM jsonb_array_elements(order_elements) AS elem;

    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en creación de pedido de materia prima: %', SQLERRM;
        -- La transacción se deshará automáticamente si falla
    END;
END;
$procedure$
;

-- DROP FUNCTION public.crypt(text, text);

CREATE OR REPLACE FUNCTION public.crypt(text, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_crypt$function$
;

-- DROP FUNCTION public.dearmor(text);

CREATE OR REPLACE FUNCTION public.dearmor(text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_dearmor$function$
;

-- DROP FUNCTION public.decrypt(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.decrypt(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_decrypt$function$
;

-- DROP FUNCTION public.decrypt_iv(bytea, bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.decrypt_iv(bytea, bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_decrypt_iv$function$
;

-- DROP FUNCTION public.digest(text, text);

CREATE OR REPLACE FUNCTION public.digest(text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_digest$function$
;

-- DROP FUNCTION public.digest(bytea, text);

CREATE OR REPLACE FUNCTION public.digest(bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_digest$function$
;

-- DROP FUNCTION public.encrypt(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.encrypt(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_encrypt$function$
;

-- DROP FUNCTION public.encrypt_iv(bytea, bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.encrypt_iv(bytea, bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_encrypt_iv$function$
;

-- DROP FUNCTION public.gen_random_bytes(int4);

CREATE OR REPLACE FUNCTION public.gen_random_bytes(integer)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_random_bytes$function$
;

-- DROP FUNCTION public.gen_random_uuid();

CREATE OR REPLACE FUNCTION public.gen_random_uuid()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE
AS '$libdir/pgcrypto', $function$pg_random_uuid$function$
;

-- DROP FUNCTION public.gen_salt(text);

CREATE OR REPLACE FUNCTION public.gen_salt(text)
 RETURNS text
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_gen_salt$function$
;

-- DROP FUNCTION public.gen_salt(text, int4);

CREATE OR REPLACE FUNCTION public.gen_salt(text, integer)
 RETURNS text
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_gen_salt_rounds$function$
;

-- DROP FUNCTION public.hmac(text, text, text);

CREATE OR REPLACE FUNCTION public.hmac(text, text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_hmac$function$
;

-- DROP FUNCTION public.hmac(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.hmac(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pg_hmac$function$
;

-- DROP PROCEDURE public.insert_multi_product_for_sale(jsonb, uuid);

CREATE OR REPLACE PROCEDURE public.insert_multi_product_for_sale(IN _products_for_sale jsonb, IN _creator_user_id uuid)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    _item JSONB;
BEGIN
    BEGIN
        -- Recorremos cada objeto del array JSON
        FOR _item IN SELECT * FROM jsonb_array_elements(_products_for_sale)
        LOOP
            INSERT INTO product_for_sale (
                price,
                establishment_id,
                finished_product_id,
                status_id,
                creator_user_id
            )
            VALUES (
                (_item ->> 'price')::NUMERIC,
                (_item -> 'establishment' ->> 'id')::UUID,
                (_item -> 'finishedProduct' ->> 'id')::UUID,
                50,
                _creator_user_id
            );
        END LOOP;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE;
    END;
END;
$procedure$
;

-- DROP PROCEDURE public.insert_multi_product_for_sale(jsonb);

CREATE OR REPLACE PROCEDURE public.insert_multi_product_for_sale(IN _products_for_sale jsonb)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    _item JSONB;
BEGIN
    BEGIN
        -- Recorremos cada objeto del array JSON
        FOR _item IN SELECT * FROM jsonb_array_elements(_products_for_sale)
        LOOP
            INSERT INTO product_for_sale (
                price,
                establishment_id,
                finished_product_id,
                status_id,
                creator_user_id
            )
            VALUES (
                (_item ->> 'price')::NUMERIC,
                (_item -> 'establishment' ->> 'id')::UUID,
                (_item -> 'finishedProduct' ->> 'id')::UUID,
                (_item -> 'status' ->> 'id')::INT,
                (_item -> 'creatorUser' ->> 'id')::UUID
            );
        END LOOP;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE;
    END;
END;
$procedure$
;

-- DROP PROCEDURE public.manage_product_for_sale_order_state(uuid, int4, uuid);

CREATE OR REPLACE PROCEDURE public.manage_product_for_sale_order_state(IN _order_id uuid, IN _new_factory_status_id integer, IN _creator_user_id uuid)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    _current_factory_status_id INT;
	_current_establishment_id uuid;
	_source_inventory_type varchar(25) := 'product_for_sale';
	_target_inventory_type varchar(25) := 'product_for_sale';
	_source_unit_name varchar(150);
	_target_unit_name varchar(150);
	_source_action_type_id INT;
	_target_action_type_id INT;
	_source_comment varchar(100);
	_target_comment varchar(100);
	_factory_status_id INT;
	_store_status_id INT;
	_action_type_id INT;
	_curr_pfs_element RECORD;
	_curr_source_element_fk_id UUID;
	_curr_target_element_fk_id UUID;
BEGIN

	-- Bloqueo de fila para evitar conflictos concurrentes
    SELECT factory_status_id, establishment_id INTO _current_factory_status_id, _current_establishment_id
    FROM product_for_sale_store_order
    WHERE id = _order_id
    FOR UPDATE;

	_factory_status_id := _new_factory_status_id;

	-- Validación del estado
	IF _new_factory_status_id = 13 THEN
		IF _current_factory_status_id in (11, 12) THEN

			_source_inventory_type := 'finished_product';
			_source_unit_name := 'bodega';
			_source_comment := 'Consumo de producto terminado';
			_source_action_type_id := 8;

			_target_comment := 'Registro de producto para venta';
			_target_unit_name := 'in_transit';
			_target_action_type_id := 9;

			_store_status_id := 21;

		else
			RAISE EXCEPTION 'El estado del pedido no se encuentra Pendiente para pasar el estado a Listo';
		end if;
	elsif _new_factory_status_id in (16) then
		if _current_factory_status_id in (13, 1) then

			_source_unit_name := 'in_transit';
			_source_comment := 'Consumo de producto para venta';
			_source_action_type_id := 10;

			_target_unit_name := _current_establishment_id::text;
			_target_comment := 'Registro de producto para venta';
			_target_action_type_id := 11;

			_store_status_id := 22;
		else
			RAISE EXCEPTION 'El estado del pedido no se encuentra En camino o Listo para pasar el estado a Recibido';
		end if;
	elsif _new_factory_status_id = 18 then
		if _current_factory_status_id in (13, 1) then
	
			_source_unit_name := 'in_transit';
			_source_comment := 'Consumo de producto para venta';
			_source_action_type_id := 10;

			_target_inventory_type := 'finished_product';
			_target_unit_name := 'bodega';
			_target_comment := 'Reingreso de producto terminado';
			_target_action_type_id := 15;

			_store_status_id := 26;

		else
			RAISE EXCEPTION 'El estado del pedido no se encuentra En camino o Listo para pasar el estado a Devuelto';
		end if;
	else
		RAISE EXCEPTION 'No es posible cambiar el estado del pedido. Estado no permitido';
	end if;

	FOR _curr_pfs_element IN SELECT elmt.product_for_sale_id, elmt.quantity, elmt.measure_id, pfs.finished_product_id
		FROM product_for_sale_store_order_element elmt 
		left join product_for_sale pfs on pfs.id = elmt.product_for_sale_id 
		WHERE pfsso_id = _order_id 
	LOOP

		-- CONSUMO de elemento de inventario

		if _source_inventory_type = 'finished_product' then
			_curr_source_element_fk_id := _curr_pfs_element.finished_product_id;
		else 
			_curr_source_element_fk_id := _curr_pfs_element.product_for_sale_id;
		end if;

		if _target_inventory_type = 'finished_product' then
			_curr_target_element_fk_id := _curr_pfs_element.finished_product_id;
		else 
			_curr_target_element_fk_id := _curr_pfs_element.product_for_sale_id;
		end if;

		-- RETIRO de elemento de inventario

		call add_remove_inventory_element(
			_source_inventory_type, 
			_source_unit_name, 
			_curr_source_element_fk_id, 
			_curr_pfs_element.measure_id, 
			_curr_pfs_element.quantity, 
			_creator_user_id, 
			_source_comment, 
			_source_action_type_id);
		
		
		-- INGRESO de elemento de inventario
		
		call add_remove_inventory_element(
			_target_inventory_type, 
			_target_unit_name, 
			_curr_target_element_fk_id, 
			_curr_pfs_element.measure_id, 
			_curr_pfs_element.quantity, 
			_creator_user_id, 
			_target_comment, 
			_target_action_type_id);


    END LOOP;

	update product_for_sale_store_order 
	set factory_status_id = _factory_status_id, store_status_id = _store_status_id, updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
	where id = _order_id;
	
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en manage_product_for_sale_order_state: %', SQLERRM;

END;
$procedure$
;

-- DROP PROCEDURE public.multi_add_remove_inventory_elements(jsonb);

CREATE OR REPLACE PROCEDURE public.multi_add_remove_inventory_elements(IN _data jsonb)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    item jsonb;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(_data)
    LOOP
        call public.add_remove_inventory_element(
            item ->> 'inventoryType',
            item ->> 'unitName',
            (item ->> 'elementId')::uuid,
            (item ->> 'measureId')::integer,
            (item ->> 'quantity')::numeric,
            (item ->> 'creatorUserId')::uuid,
            item ->> 'comment',
            (item ->> 'actionTypeId')::integer
        );
    END LOOP;
END;
$procedure$
;

-- DROP FUNCTION public.pgp_armor_headers(in text, out text, out text);

CREATE OR REPLACE FUNCTION public.pgp_armor_headers(text, OUT key text, OUT value text)
 RETURNS SETOF record
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_armor_headers$function$
;

-- DROP FUNCTION public.pgp_key_id(bytea);

CREATE OR REPLACE FUNCTION public.pgp_key_id(bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_key_id_w$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt(bytea, bytea, text, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt(bytea, bytea, text, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt(bytea, bytea, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt(bytea, bytea);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt(bytea, bytea)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_pub_encrypt(text, bytea);

CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt(text, bytea)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_text$function$
;

-- DROP FUNCTION public.pgp_pub_encrypt(text, bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt(text, bytea, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_text$function$
;

-- DROP FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea);

CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_sym_decrypt(bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt(bytea, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_text$function$
;

-- DROP FUNCTION public.pgp_sym_decrypt(bytea, text, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt(bytea, text, text)
 RETURNS text
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_text$function$
;

-- DROP FUNCTION public.pgp_sym_decrypt_bytea(bytea, text, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt_bytea(bytea, text, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_sym_decrypt_bytea(bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt_bytea(bytea, text)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_sym_encrypt(text, text, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt(text, text, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_text$function$
;

-- DROP FUNCTION public.pgp_sym_encrypt(text, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt(text, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_text$function$
;

-- DROP FUNCTION public.pgp_sym_encrypt_bytea(bytea, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt_bytea(bytea, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_bytea$function$
;

-- DROP FUNCTION public.pgp_sym_encrypt_bytea(bytea, text, text);

CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt_bytea(bytea, text, text)
 RETURNS bytea
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_bytea$function$
;

-- DROP PROCEDURE public.register_cash_closing(text, uuid, uuid);

CREATE OR REPLACE PROCEDURE public.register_cash_closing_v4(IN _note text, IN _establishment_id uuid, IN _user_request_id uuid, IN _sobrante numeric DEFAULT 0)
 LANGUAGE plpgsql
AS $procedure$
declare
	_last_cash_closing_id UUID;
	_last_inventory jsonb;
	_last_cash_closing_date timestamp;
	_credit_balance numeric(10,2) := 0;
begin

	select cc0.creation_date, cc0.inventory_capture
	into _last_cash_closing_date, _last_inventory
	from cash_closing cc0
	where cc0.establishment_id = _establishment_id
	order by cc0.creation_date desc
	limit 1;

	-- Saldo nuevo = saldo anterior + créditos nuevos del período (pedido + envío) - pagos de crédito del período
	SELECT
		COALESCE((
			SELECT cc_prev.credit_balance FROM cash_closing cc_prev
			WHERE cc_prev.establishment_id = _establishment_id
			ORDER BY cc_prev.creation_date DESC LIMIT 1
		), 0)
		-- Créditos nuevos del PEDIDO (subtotal = total - delivery) cuando el pedido es a crédito
		+ COALESCE((
			SELECT SUM(ss_c.total - ss_c.delivery) FROM shop_sale ss_c
			JOIN payment_type pt_c ON pt_c.id = ss_c.payment_type_id
			WHERE ss_c.establishment_id = _establishment_id
			AND pt_c.name = 'Crédito' AND ss_c.status_id = 52
			AND (_last_cash_closing_date IS NULL OR ss_c.creation_date >= _last_cash_closing_date)
		), 0)
		-- Créditos nuevos del ENVÍO (delivery) cuando el envío es a crédito
		+ COALESCE((
			SELECT SUM(ss_d.delivery) FROM shop_sale ss_d
			JOIN payment_type pt_d ON pt_d.id = ss_d.delivery_payment_type_id
			WHERE ss_d.establishment_id = _establishment_id
			AND pt_d.name = 'Crédito' AND ss_d.status_id = 52
			AND (_last_cash_closing_date IS NULL OR ss_d.creation_date >= _last_cash_closing_date)
		), 0)
		-- Pagos de crédito del período (todos: pedido y envío)
		- COALESCE((
			SELECT SUM(ssp.amount) FROM shop_sale_payment ssp
			JOIN shop_sale ss2 ON ss2.id = ssp.shop_sale_id
			WHERE ss2.establishment_id = _establishment_id
			AND ss2.status_id = 52
			AND (_last_cash_closing_date IS NULL OR ssp."date" >= _last_cash_closing_date)
		), 0)
	INTO _credit_balance;

	insert into cash_closing(
		establishment_id, status_id, shop_sales, sale_store_orders, last_inventory_capture,
		last_inventory_creation_date, inventory_capture,
		inventory_element_actions, validator_user, note, credit_balance, sobrante)
	values (
		_establishment_id, 55, 
		(
			SELECT json_agg(
			    json_build_object(
			        'id', ss.id,
				    'nameClient', ss.name_client,
				    'nitClient', ss.nit_client,
				    'nota', ss.nota,
				    'total', ss.total,
					'totalDiscount', ss.total_discount,
				    'delivery', ss.delivery,
				    'paidAmount', ss.paid_amount,
				    'pendingAmount', ss.pending_amount,
				    'deliveryPendingAmount', ss.delivery_pending_amount,
				    'updatedDate', coalesce(ss.updated_date, ss.creation_date),
				    'creationDate', ss.creation_date,
				    'status', json_build_object(
				        'identifier', s.name,
				        'id', s.id
				    ),
				    'paymentType', json_build_object(
				        'identifier', pt."name",
				        'id', pt.id
				    ),
				    'deliveryPaymentType', json_build_object(
				        'identifier', dpt."name",
				        'id', dpt.id
				    ),
				    'itemsList', (
					    SELECT json_agg(
						    json_build_object(
						    	'id', sse.id,
						    	'quantity', sse.quantity,
						    	'price', sse.price,
						    	'totalDiscount', sse.total_discount,
						    	'total', sse.total,
						    	'productForSale', json_build_object(
							        'id', pfs.id,
							        'finishedProduct', json_build_object(
							            'id', fp.id,
							            'name', fp.name
							        )
								),
								'measure', json_build_object(
									'identifier', m2."name",
									'id', m2.id
								)
						    )
						)
						from shop_sale_element sse
						left join product_for_sale pfs on pfs.id = sse.product_for_sale_id 
						LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
						left join measure m2 on sse.measure_id = m2.id
						WHERE sse.shop_sale_id = ss.id
					)
			    )
			) AS json_result
			from shop_sale ss
			left join status s on ss.status_id = s.id
			left join payment_type pt on ss.payment_type_id = pt.id
			left join payment_type dpt on ss.delivery_payment_type_id = dpt.id
			left join "user" u on ss.creator_user_id = u.id
			left join establishment e3 on ss.establishment_id = e3.id
			where  ss.establishment_id = _establishment_id
			and ss.status_id = 52
			and (_last_cash_closing_date IS NULL OR ss.creation_date >= _last_cash_closing_date)
		)::jsonb,
		(
		SELECT json_agg(
		    json_build_object(
		        'id', pfsso.id,
		        'name', pfsso.name,
		        'comment', pfsso.comment,
		        'finalAmount', pfsso.final_amount,
		        'updatedDate', coalesce(pfsso.updated_date, pfsso.creation_date),
		        'creationDate', pfsso.creation_date,
		        'storeStatus', json_build_object(
		            'identifier', s.name,
		            'id', s.id
		        ),
		        'factoryStatus', json_build_object(
		            'identifier', s2.name,
		            'id', s2.id
		        ),
		        'creatorUser', json_build_object(
		            'name', u.username,
		            'email', u.email,
		            'id', u.id
		        ),
		        'productForSaleStoreOrderElements', (
				    SELECT json_agg(
					    json_build_object(
					    	'id', pfssoe.id,
					    	'price', pfssoe.price,
					    	'quantity', pfssoe.quantity,
					    	'totalPrice', pfssoe.total_price,
					    	'date', pfssoe."date",
					    	'measure', json_build_object(
					    		'identifier', m1.name,
					    		'id', m1.id
					    	),
					        'productForSale', json_build_object(
					        	'id', pfs.id,
						        'creationDate', pfs.creation_date,
							    'updatedDate', pfs.updated_date,
						        'price', pfs.price,
						        'finishedProduct', json_build_object(
						            'id', fp.id,
						            'name', fp.name,
						            'photo', fp.photo,
						            'description', fp.description
						        )
					        )
					    )
					)
					from product_for_sale_store_order_element pfssoe
					LEFT JOIN measure m1 on m1.id = pfssoe.measure_id
					left join product_for_sale pfs on pfs.id = pfssoe.product_for_sale_id
					LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
					LEFT JOIN establishment e3 ON e3.id = pfs.establishment_id
					LEFT JOIN status s3 ON s3.id = pfs.status_id
					WHERE pfssoe.pfsso_id = pfsso.id
				)
		    )
		) AS json_result
		from product_for_sale_store_order pfsso 
		left join establishment e2 on e2.id = pfsso.establishment_id
		left join status s on s.id = pfsso.store_status_id
		left join status s2 on s2.id = pfsso.factory_status_id
		left join "user" u on u.id = pfsso.creator_user_id
		where pfsso.establishment_id = _establishment_id
		and (_last_cash_closing_date IS NULL OR pfsso.creation_date >= _last_cash_closing_date)
		)::jsonb,
		(_last_inventory),
		(_last_cash_closing_date),
		(
		SELECT json_agg(
            json_build_object(
                'id', ie.id,
                'element_type', ie.element_type,
                'quantity', ie.quantity,
                'status', json_build_object(
                    'identifier', sie.name,
                    'id', sie.id
                ),
                'measure', json_build_object(
                    'id', m.id,
                    'identifier', m.name,
                    'unitBase', json_build_object(
                        'quantity', m.unit_base_quantity,
                        'name', ub.name,
                        'id', ub.id
                    )
                ),
                'productForSale', json_build_object(
                	'id', pfs.id,
                	'price', pfs.price,
	                'finishedProduct', json_build_object(
	                    'id', fp.id,
	                    'name', fp.name,
	                    'photo', fp.photo,
	                    'status', json_build_object(
	                        'id', srm.id,
	                        'identifier', srm.name
	                    )
	                )
                )
            )
        )
        FROM inventory i1
        join inventory_element ie on i1.id = ie.inventory_id
        join product_for_sale pfs on ie.element_fk = pfs.id
        left JOIN finished_product fp ON fp.id = pfs.finished_product_id
        LEFT JOIN status sie ON sie.id = ie.status_id
        LEFT JOIN measure m ON m.id = ie.measure_id
        LEFT JOIN unit_base ub ON ub.id = m.unit_base_id
        LEFT JOIN status srm ON srm.id = fp.status_id
        WHERE ie.element_type = 'product_for_sale'
          and i1.unit_name = _establishment_id::text
		)::jsonb,
		(
		SELECT json_agg(
		    json_build_object(
		    	'id', iea.id,
		    	'creationDate', iea.creation_date,
		    	'reason', iea."comment",
		    	'element', json_build_object(
		    		'name', fp3."name"
		    	),
		    	'price', pfs3.price,
		    	'measure', json_build_object(
		            'identifier', m3.name,
		            'unitBase', json_build_object(
		                'quantity', m3.unit_base_quantity
		            )
		        ),
		    	'quantity', iea.quantity,
		    	'creatorUser', json_build_object(
		            'name', u3.username,
		            'email', u3.email
		        ),
		        'actionType', json_build_object(
		        	'color', at.color,
		        	'action', at.action,
		        	'type', at.type,
		            'name', at."name"
		        )
		    )
		) as json_result
		from inventory_element_action iea
		left join inventory_element ie3 on ie3.id = iea.source_inventory_element_id
		left join inventory i3 on i3.id = ie3.inventory_id
		left join measure m3 on m3.id = iea.measure_id 
		left join "user" u3 on u3.id = iea.creator_user_id
		left join action_type at on at.id = iea.action_type_id 
		join product_for_sale pfs3 on ie3.element_fk = pfs3.id
		left JOIN finished_product fp3 ON fp3.id = pfs3.finished_product_id
		where i3.unit_name = _establishment_id::text
		and (_last_cash_closing_date IS NULL OR iea.creation_date >= _last_cash_closing_date)
		)::jsonb,
		_user_request_id, _note, _credit_balance, _sobrante
	);


exception
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en generacion de cierre de caja: %', SQLERRM;

END;
$procedure$
;

-- DROP PROCEDURE public.register_shop_sale_with_elements(jsonb, jsonb, uuid);

CREATE OR REPLACE PROCEDURE public.register_shop_sale_with_elements(IN _sale_properties jsonb, IN _sale_elements jsonb, IN _creator_user_id uuid)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    _new_ss_id uuid;
    _status_id INT := 52;
	_item JSONB;
	_establishment_id uuid;
	_price NUMERIC;
	_subtotal NUMERIC;
	_total NUMERIC;
	_total_discount NUMERIC;
	_product_for_sale_id UUID;
	_quantity NUMERIC;
	_measure_id INT;
	_discount NUMERIC;
	
BEGIN
    -- Iniciar transacción implícitamente controlada
    BEGIN

		_establishment_id := (_sale_properties -> 'establishment' ->> 'id')::UUID;

        -- Insertar en raw_material_order
		INSERT INTO public.shop_sale(
			name_client, 
			nota, 
			delivery, 
			nit_client, 
			establishment_id, 
			status_id, 
			total, 
			total_discount, 
			payment_type_id, 
			creator_user_id
		)
        VALUES (
            _sale_properties->>'nameClient',
            _sale_properties->>'nota',
            ROUND((_sale_properties->>'delivery')::NUMERIC, 2),
            (_sale_properties->>'nitClient')::VARCHAR(10),
            _establishment_id,
			_status_id,
			ROUND((_sale_properties->>'total')::NUMERIC, 2),
            ROUND((_sale_properties->>'totalDiscount')::NUMERIC, 2),
            (_sale_properties->'paymentType'->>'id')::INT,
            _creator_user_id
        )
        RETURNING id INTO _new_ss_id;

        FOR _item IN SELECT * FROM jsonb_array_elements(_sale_elements)
        LOOP

			_price := (_item->>'price')::NUMERIC;
			_subtotal := ROUND((_item->>'subtotal')::NUMERIC, 2);
			_total := ROUND((_item->>'total')::NUMERIC, 2);
			_total_discount := ROUND((_item->>'totalDiscount')::NUMERIC, 2);
			_product_for_sale_id := (_item -> 'productForSale' ->> 'id')::UUID;
			_quantity := ROUND((_item ->> 'quantity')::NUMERIC, 2);
            _measure_id := (_item -> 'measure' ->> 'id')::INT;
			_discount := ROUND((_item->>'discount')::NUMERIC, 2);

            --Registrar venta
			call add_remove_inventory_element(
				'product_for_sale', 
				_establishment_id::text, 
				_product_for_sale_id, 
				_measure_id, 
				_quantity, 
				_creator_user_id, 
				'Venta de producto en tienda', 
				14);

			--Registrar elementos de la venta

			INSERT INTO public.shop_sale_element(
				shop_sale_id, 
				product_for_sale_id, 
				price, 
				subtotal, 
				total, 
				discount, 
				total_discount, 
				quantity, 
				measure_id)
			VALUES(
				_new_ss_id, 
				_product_for_sale_id, 
				_price, 
				_subtotal, 
				_total, 
				_discount, 
				_total_discount, 
				_quantity, 
				_measure_id);
			
        END LOOP;

    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en registro de venta: %', SQLERRM;
    END;
END;
$procedure$
;

-- DROP PROCEDURE public.return_pfs_to_warehouse(text, text, uuid, int4, numeric, uuid, text);

CREATE OR REPLACE PROCEDURE public.return_pfs_to_warehouse(
    IN _inventory_type text,
    IN _unit_name text,
    IN _element_fk uuid,
    IN _measure_id integer,
    IN _quantity numeric,
    IN _creator_user_id uuid,
    IN _comment text
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
    _finished_product_id UUID;
BEGIN
    -- 1. Quitar del inventario de tienda (product_for_sale), acción: remove_pfs_by_devolution (17)
    CALL remove_inventory_element(
        _inventory_type,
        _unit_name,
        _element_fk,
        _measure_id,
        _quantity,
        _creator_user_id,
        _comment,
        17
    );

    -- 2. Obtener el finished_product_id a partir del product_for_sale
    SELECT finished_product_id
    INTO _finished_product_id
    FROM product_for_sale
    WHERE id = _element_fk;

    IF _finished_product_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró el producto terminado asociado al producto para venta con ID %.', _element_fk;
    END IF;

    -- 3. Agregar al inventario de bodega (finished_product), acción: add_fp_by_devolution_from_store (18)
    CALL add_inventory_element(
        'finished_product',
        'bodega',
        _finished_product_id,
        _measure_id,
        _quantity,
        _creator_user_id,
        _comment,
        18
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$procedure$
;

-- DROP PROCEDURE public.remove_inventory_element(text, text, uuid, int4, numeric, uuid, text, int4);

CREATE OR REPLACE PROCEDURE public.remove_inventory_element(IN _inventory_type text, IN _unit_name text, IN _element_fk uuid, IN _measure_id integer, IN _quantity numeric, IN _creator_user_id uuid, IN _comment text, IN _action_type_id integer)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    _input_unit_base_quantity NUMERIC(12,5);
    _input_base_quantity NUMERIC(12,5);

    _ie_id INT;
    _ie_quantity NUMERIC(12,5);
    _ie_measure_id INT;
    _ie_unit_base_quantity NUMERIC(12,5);

    _final_quantity NUMERIC(12,5);
BEGIN
    -- 1. Obtener cantidad base de la unidad de entrada
    SELECT unit_base_quantity
    INTO _input_unit_base_quantity
    FROM measure
    WHERE id = _measure_id;

    IF _input_unit_base_quantity IS NULL THEN
        RAISE EXCEPTION 'La medida con ID % no existe.', _measure_id;
    END IF;

    -- 2. Calcular cantidad base a remover
    _input_base_quantity := _input_unit_base_quantity * _quantity;

    -- 3. Buscar el elemento en inventario
    SELECT ie.id, ie.quantity, m.id, m.unit_base_quantity
    INTO _ie_id, _ie_quantity, _ie_measure_id, _ie_unit_base_quantity
    FROM inventory i
    JOIN inventory_element ie ON ie.inventory_id = i.id
    JOIN measure m ON m.id = ie.measure_id
    WHERE i.inventory_type = _inventory_type
      AND i.unit_name = _unit_name
      AND ie.element_fk = _element_fk
    LIMIT 1
    FOR UPDATE;

    -- 4. Validar existencia
    IF _ie_id IS NULL THEN
        RAISE EXCEPTION 'El elemento no existe en el inventario.';
    END IF;

    -- 5. Convertir cantidad a la unidad del inventario
    _input_base_quantity := _input_base_quantity / _ie_unit_base_quantity;

    -- 6. Validar cantidad suficiente
    IF _input_base_quantity > _ie_quantity THEN
        RAISE EXCEPTION 'No hay suficiente cantidad en inventario para eliminar. Disponible: %, Requerido: %', _ie_quantity, _input_base_quantity;
    END IF;

    -- 7. Calcular nueva cantidad y actualizar
    _final_quantity := _ie_quantity - _input_base_quantity;

    UPDATE inventory_element
    SET quantity = _final_quantity, updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
    WHERE id = _ie_id;

    -- 8. Registrar la acción
    INSERT INTO inventory_element_action (
        comment, source_inventory_element_id, quantity, measure_id, action_type_id, creator_user_id
    ) VALUES (
        _comment, _ie_id, _input_base_quantity, _ie_measure_id, _action_type_id, _creator_user_id
    );
END;
$procedure$
;

-- DROP PROCEDURE public.update_product_for_sale_order_with_elements(uuid, jsonb, jsonb);

CREATE OR REPLACE PROCEDURE public.update_product_for_sale_order_with_elements(IN _order_id uuid, IN _order_properties jsonb, IN _order_elements jsonb)
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

BEGIN
    BEGIN
		
		-- Bloqueo de fila para evitar conflictos concurrentes
	    SELECT factory_status_id INTO _order_status_id
	    FROM product_for_sale_store_order
	    WHERE id = _order_id
	    FOR UPDATE;

		 -- Validación del estado (ejemplo: 38 = Activo)
	    IF _order_status_id not in (11, 12) THEN
	        update product_for_sale_store_order 
			set name = _order_properties->>'name', comment = _order_properties->>'comment', updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
			where id = _order_id;
			return;
	    END IF;

		-- Actualizar propiedades de la orden
	    UPDATE product_for_sale_store_order
	    SET
	        name = _order_properties->>'name',
	        comment = _order_properties->>'comment',
	        establishment_id = (_order_properties -> 'establishment' ->> 'id')::UUID,
	        final_amount = (_order_properties ->> 'finalAmount')::NUMERIC,
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

            -- Validar existencia y stock
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

-- DROP PROCEDURE public.update_raw_material_order_elements(uuid, jsonb, jsonb);

CREATE OR REPLACE PROCEDURE public.update_raw_material_order_elements(IN order_id uuid, IN order_properties jsonb, IN order_elements jsonb)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    trans_iniciada_por_este_proceso BOOLEAN := FALSE;
    order_status_id INT;
BEGIN

    -- Bloqueo de fila para evitar conflictos concurrentes
    SELECT status_id INTO order_status_id
    FROM raw_material_order
    WHERE id = order_id
    FOR UPDATE;

    -- Validación del estado (ejemplo: 38 = Activo)
    IF order_status_id <> 38 THEN
        RAISE EXCEPTION 'El estado del pedido no se encuentra ACTIVO para la actualización de sus elementos';
    END IF;

    -- Actualizar propiedades de la orden
    UPDATE raw_material_order
    SET
        name = order_properties->>'name',
        description = order_properties->>'description',
        payment_type_id = (order_properties->'paymentType'->>'id')::INT,
        pending_amount = (order_properties->>'pendingAmount')::NUMERIC,
        paid_amount = (order_properties->>'paidAmount')::NUMERIC,
        final_amount = (order_properties->>'finalAmount')::NUMERIC
    WHERE id = order_id;

    -- Eliminar elementos anteriores
    DELETE FROM raw_material_order_element
    WHERE raw_material_order_id = order_id;

    -- Insertar nuevos elementos
    INSERT INTO raw_material_order_element (
        raw_material_order_id,
        raw_material_by_provider_id,
        quantity,
        discount,
        measure_id,
        price,
        subtotal_price,
        total_discount,
        total_price
    )
    SELECT 
        order_id,
        (elem->'rawMaterialByProvider'->>'id')::UUID,
        (elem->>'quantity')::NUMERIC,
        (elem->>'discount')::NUMERIC,
        (elem->'measure'->>'id')::INT,
        (elem->>'price')::NUMERIC,
        (elem->>'subtotalPrice')::NUMERIC,
        (elem->>'totalDiscount')::NUMERIC,
        (elem->>'totalPrice')::NUMERIC
    FROM jsonb_array_elements(order_elements) AS elem;

EXCEPTION
    WHEN OTHERS THEN
        -- Manejo de error y rollback implícito
        RAISE EXCEPTION 'Error en update_raw_material_order_elements: %', SQLERRM;
END;
$procedure$
;

-- DROP PROCEDURE public.verify_cash_closing(uuid, uuid);

CREATE OR REPLACE PROCEDURE public.verify_cash_closing(IN _cash_closing_id uuid, IN _confirm_user_id uuid)
 LANGUAGE plpgsql
AS $procedure$
begin
	
	update cash_closing set status_id = 57, updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP), confirm_user = _confirm_user_id
	where id = _cash_closing_id;
	
exception
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en verificacion de cierre de caja: %', SQLERRM;

END;
$procedure$
;

-- DROP PROCEDURE public.verify_raw_material_order(uuid, jsonb, jsonb, uuid);

CREATE OR REPLACE PROCEDURE public.verify_raw_material_order(IN order_id uuid, IN order_properties jsonb, IN order_elements jsonb, IN creator_user_id uuid)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    verified_status_id INT := 45;
    current_status_id INT;
    element_id UUID;
    element_measure_id INT;
    element_quantity NUMERIC(9,5);
	curr_order_pending_amount NUMERIC;
	curr_order_final_amount NUMERIC;
	new_payment_status_id INT := 3;
	paid_status_id INT := 5;
    partial_status_id INT := 4;
    _order_type_id INT;
    _element_type VARCHAR;
    _inventory_type VARCHAR;
    _inventory_note VARCHAR;
BEGIN
    -- Obtener estado actual y tipo del pedido
    SELECT status_id, raw_material_by_provider_type_id INTO current_status_id, _order_type_id
    FROM raw_material_order
    WHERE id = order_id
    FOR UPDATE;

    -- Validar que esté activo (ID = 38)
    IF current_status_id <> 38 THEN
        RAISE EXCEPTION 'No se puede modificar el inventario: el estado del pedido no se encuentra ACTIVO.';
    END IF;

    -- Determinar tipo de inventario según tipo de pedido
    IF _order_type_id = 2 THEN
        _element_type := 'packaging_material';
        _inventory_type := 'packaging_material';
        _inventory_note := 'Registro de material de empaque a partir de verificación de orden';
    ELSE
        _element_type := 'raw_material';
        _inventory_type := 'bodega';
        _inventory_note := 'Registro de materia prima a partir de verificación de orden';
    END IF;

    -- Llamar al procedimiento para actualizar la orden
    CALL update_raw_material_order_elements(order_id, order_properties, order_elements);

    -- Iterar sobre los elementos de la orden para registrar en inventario
    FOR element_id, element_measure_id, element_quantity IN
        SELECT
            rm.id,
            rmoe.measure_id,
            rmoe.quantity
        FROM raw_material_order_element rmoe
        LEFT JOIN raw_material_by_provider rmbp ON rmbp.id = rmoe.raw_material_by_provider_id
        LEFT JOIN raw_material rm ON rm.id = rmbp.raw_material_base_id
        WHERE rmoe.raw_material_order_id = order_id
    LOOP
        -- Llamar al procedimiento que registra en inventario
        CALL add_inventory_element(
            _element_type,
            _inventory_type,
            element_id,
            element_measure_id,
            element_quantity,
            creator_user_id,
            _inventory_note,
            1
        );
    END LOOP;

	curr_order_pending_amount = (order_properties->>'pendingAmount')::NUMERIC;
	curr_order_final_amount = (order_properties->>'finalAmount')::NUMERIC;
	
	-- Determinar nuevo estado de pago
    IF curr_order_pending_amount <= 0 THEN
        new_payment_status_id := paid_status_id;
    elsif curr_order_pending_amount < curr_order_final_amount THEN
        new_payment_status_id := partial_status_id;
    END IF;

    -- Cambiar estado del pedido a "verificado"
    UPDATE raw_material_order
    SET status_id = verified_status_id, payment_status_id = new_payment_status_id
    WHERE id = order_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en verify_raw_material_order: %', SQLERRM;
END;
$procedure$
;

-- DROP PROCEDURE public.confirm_and_receive_pfs_order(uuid, uuid);

CREATE OR REPLACE PROCEDURE public.confirm_and_receive_pfs_order(IN _order_id uuid, IN _creator_user_id uuid)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    _current_factory_status_id INT;
    _current_establishment_id uuid;
    _curr_pfs_element RECORD;
BEGIN

    -- Bloqueo de fila para evitar conflictos concurrentes
    SELECT factory_status_id, establishment_id INTO _current_factory_status_id, _current_establishment_id
    FROM product_for_sale_store_order
    WHERE id = _order_id
    FOR UPDATE;

    IF _current_factory_status_id != 11 THEN
        RAISE EXCEPTION 'El pedido debe estar en estado Pendiente para confirmar y recibir';
    END IF;

    FOR _curr_pfs_element IN
        SELECT elmt.product_for_sale_id, elmt.quantity, elmt.measure_id, pfs.finished_product_id
        FROM product_for_sale_store_order_element elmt
        LEFT JOIN product_for_sale pfs ON pfs.id = elmt.product_for_sale_id
        WHERE pfsso_id = _order_id
    LOOP
        -- RETIRO de finished_product/bodega
        CALL add_remove_inventory_element(
            'finished_product',
            'bodega',
            _curr_pfs_element.finished_product_id,
            _curr_pfs_element.measure_id,
            _curr_pfs_element.quantity,
            _creator_user_id,
            'Consumo directo de producto terminado',
            8);

        -- INGRESO a product_for_sale/{establishment_id}
        CALL add_remove_inventory_element(
            'product_for_sale',
            _current_establishment_id::text,
            _curr_pfs_element.product_for_sale_id,
            _curr_pfs_element.measure_id,
            _curr_pfs_element.quantity,
            _creator_user_id,
            'Registro directo de producto para venta en tienda',
            11);
    END LOOP;

    UPDATE product_for_sale_store_order
    SET factory_status_id = 16, store_status_id = 22, updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
    WHERE id = _order_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en confirm_and_receive_pfs_order: %', SQLERRM;

END;
$procedure$
;
;

-- ============================================================
-- V2: register_shop_sale_with_elements_v2
-- Same as v1 but adds paid_amount, pending_amount, payment_status_id
-- based on whether payment type is 'Crédito'
-- ============================================================

CREATE OR REPLACE PROCEDURE public.register_shop_sale_with_elements_v2(
    IN _sale_properties jsonb,
    IN _sale_elements jsonb,
    IN _creator_user_id uuid
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
    _new_ss_id uuid;
    _status_id INT := 52;
    _item JSONB;
    _establishment_id uuid;
    _price NUMERIC;
    _subtotal NUMERIC;
    _total NUMERIC;
    _total_discount NUMERIC;
    _product_for_sale_id UUID;
    _quantity NUMERIC;
    _measure_id INT;
    _discount NUMERIC;
    _payment_type_identifier VARCHAR;
    _paid_amount NUMERIC(10,2);
    _pending_amount NUMERIC(10,2);
    _payment_status_id INT;
    _paid_status_id INT := 5;
    _pending_status_id INT := 3;
BEGIN
    BEGIN
        _establishment_id := (_sale_properties -> 'establishment' ->> 'id')::UUID;
        _total := ROUND((_sale_properties->>'total')::NUMERIC, 2);
        _total_discount := ROUND((_sale_properties->>'totalDiscount')::NUMERIC, 2);

        SELECT pt."name" INTO _payment_type_identifier
        FROM payment_type pt
        WHERE pt.id = (_sale_properties->'paymentType'->>'id')::INT;

        IF _payment_type_identifier = 'Crédito' THEN
            _payment_status_id := _pending_status_id;
            _paid_amount := 0;
            _pending_amount := _total;
        ELSE
            _payment_status_id := _paid_status_id;
            _paid_amount := _total;
            _pending_amount := 0;
        END IF;

        INSERT INTO public.shop_sale(
            name_client,
            nota,
            delivery,
            nit_client,
            establishment_id,
            status_id,
            total,
            total_discount,
            payment_type_id,
            creator_user_id,
            paid_amount,
            pending_amount,
            payment_status_id
        )
        VALUES (
            _sale_properties->>'nameClient',
            _sale_properties->>'nota',
            ROUND((_sale_properties->>'delivery')::NUMERIC, 2),
            (_sale_properties->>'nitClient')::VARCHAR(10),
            _establishment_id,
            _status_id,
            _total,
            _total_discount,
            (_sale_properties->'paymentType'->>'id')::INT,
            _creator_user_id,
            _paid_amount,
            _pending_amount,
            _payment_status_id
        )
        RETURNING id INTO _new_ss_id;

        FOR _item IN SELECT * FROM jsonb_array_elements(_sale_elements)
        LOOP
            _price := (_item->>'price')::NUMERIC;
            _subtotal := ROUND((_item->>'subtotal')::NUMERIC, 2);
            _total := ROUND((_item->>'total')::NUMERIC, 2);
            _total_discount := ROUND((_item->>'totalDiscount')::NUMERIC, 2);
            _product_for_sale_id := (_item -> 'productForSale' ->> 'id')::UUID;
            _quantity := ROUND((_item ->> 'quantity')::NUMERIC, 2);
            _measure_id := (_item -> 'measure' ->> 'id')::INT;
            _discount := ROUND((_item->>'discount')::NUMERIC, 2);

            CALL add_remove_inventory_element(
                'product_for_sale',
                _establishment_id::text,
                _product_for_sale_id,
                _measure_id,
                _quantity,
                _creator_user_id,
                'Venta de producto en tienda',
                14);

            INSERT INTO public.shop_sale_element(
                shop_sale_id,
                product_for_sale_id,
                price,
                subtotal,
                total,
                discount,
                total_discount,
                quantity,
                measure_id)
            VALUES(
                _new_ss_id,
                _product_for_sale_id,
                _price,
                _subtotal,
                _total,
                _discount,
                _total_discount,
                _quantity,
                _measure_id);
        END LOOP;

    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en registro de venta v2: %', SQLERRM;
    END;
END;
$procedure$
;

-- ============================================================
-- V3: register_shop_sale_with_elements_v3
-- Igual que v2 pero rastrea por separado el crédito del pedido
-- (paid_amount/pending_amount sobre el subtotal = total - delivery) y
-- el crédito del envío (delivery_paid_amount/delivery_pending_amount).
-- Acepta deliveryPaymentType en _sale_properties.
-- ============================================================

CREATE OR REPLACE PROCEDURE public.register_shop_sale_with_elements_v3(
    IN _sale_properties jsonb,
    IN _sale_elements jsonb,
    IN _creator_user_id uuid
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
    _new_ss_id uuid;
    _status_id INT := 52;
    _item JSONB;
    _establishment_id uuid;
    _price NUMERIC;
    _subtotal NUMERIC;
    _total NUMERIC;
    _total_discount NUMERIC;
    _delivery NUMERIC;
    _order_amount NUMERIC;
    _product_for_sale_id UUID;
    _quantity NUMERIC;
    _measure_id INT;
    _discount NUMERIC;
    _payment_type_id INT;
    _delivery_payment_type_id INT;
    _payment_type_identifier VARCHAR;
    _delivery_payment_identifier VARCHAR;
    _paid_amount NUMERIC(10,2);
    _pending_amount NUMERIC(10,2);
    _payment_status_id INT;
    _delivery_paid_amount NUMERIC(10,2);
    _delivery_pending_amount NUMERIC(10,2);
    _delivery_payment_status_id INT;
    _paid_status_id INT := 5;
    _pending_status_id INT := 3;
BEGIN
    BEGIN
        _establishment_id := (_sale_properties -> 'establishment' ->> 'id')::UUID;
        _total := ROUND((_sale_properties->>'total')::NUMERIC, 2);
        _total_discount := ROUND((_sale_properties->>'totalDiscount')::NUMERIC, 2);
        _delivery := ROUND(COALESCE((_sale_properties->>'delivery')::NUMERIC, 0), 2);
        _order_amount := ROUND(_total - _delivery, 2);

        _payment_type_id := (_sale_properties->'paymentType'->>'id')::INT;
        _delivery_payment_type_id := (_sale_properties->'deliveryPaymentType'->>'id')::INT;

        SELECT pt."name" INTO _payment_type_identifier FROM payment_type pt WHERE pt.id = _payment_type_id;
        SELECT pt."name" INTO _delivery_payment_identifier FROM payment_type pt WHERE pt.id = _delivery_payment_type_id;

        -- Crédito del pedido (subtotal)
        IF _payment_type_identifier = 'Crédito' THEN
            _payment_status_id := _pending_status_id;
            _paid_amount := 0;
            _pending_amount := _order_amount;
        ELSE
            _payment_status_id := _paid_status_id;
            _paid_amount := _order_amount;
            _pending_amount := 0;
        END IF;

        -- Crédito del envío
        IF _delivery_payment_identifier = 'Crédito' THEN
            _delivery_payment_status_id := _pending_status_id;
            _delivery_paid_amount := 0;
            _delivery_pending_amount := _delivery;
        ELSE
            _delivery_payment_status_id := _paid_status_id;
            _delivery_paid_amount := _delivery;
            _delivery_pending_amount := 0;
        END IF;

        INSERT INTO public.shop_sale(
            name_client,
            nota,
            delivery,
            nit_client,
            establishment_id,
            status_id,
            total,
            total_discount,
            payment_type_id,
            creator_user_id,
            paid_amount,
            pending_amount,
            payment_status_id,
            delivery_payment_type_id,
            delivery_paid_amount,
            delivery_pending_amount,
            delivery_payment_status_id
        )
        VALUES (
            _sale_properties->>'nameClient',
            _sale_properties->>'nota',
            _delivery,
            (_sale_properties->>'nitClient')::VARCHAR(10),
            _establishment_id,
            _status_id,
            _total,
            _total_discount,
            _payment_type_id,
            _creator_user_id,
            _paid_amount,
            _pending_amount,
            _payment_status_id,
            _delivery_payment_type_id,
            _delivery_paid_amount,
            _delivery_pending_amount,
            _delivery_payment_status_id
        )
        RETURNING id INTO _new_ss_id;

        FOR _item IN SELECT * FROM jsonb_array_elements(_sale_elements)
        LOOP
            _price := (_item->>'price')::NUMERIC;
            _subtotal := ROUND((_item->>'subtotal')::NUMERIC, 2);
            _total := ROUND((_item->>'total')::NUMERIC, 2);
            _total_discount := ROUND((_item->>'totalDiscount')::NUMERIC, 2);
            _product_for_sale_id := (_item -> 'productForSale' ->> 'id')::UUID;
            _quantity := ROUND((_item ->> 'quantity')::NUMERIC, 2);
            _measure_id := (_item -> 'measure' ->> 'id')::INT;
            _discount := ROUND((_item->>'discount')::NUMERIC, 2);

            CALL add_remove_inventory_element(
                'product_for_sale',
                _establishment_id::text,
                _product_for_sale_id,
                _measure_id,
                _quantity,
                _creator_user_id,
                'Venta de producto en tienda',
                14);

            INSERT INTO public.shop_sale_element(
                shop_sale_id,
                product_for_sale_id,
                price,
                subtotal,
                total,
                discount,
                total_discount,
                quantity,
                measure_id)
            VALUES(
                _new_ss_id,
                _product_for_sale_id,
                _price,
                _subtotal,
                _total,
                _discount,
                _total_discount,
                _quantity,
                _measure_id);
        END LOOP;

    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en registro de venta v3: %', SQLERRM;
    END;
END;
$procedure$
;

-- ============================================================
-- add_shop_sale_payment
-- Registers a partial or full payment against a credit shop sale
-- ============================================================

CREATE OR REPLACE PROCEDURE public.add_shop_sale_payment(
    IN _shop_sale_id uuid,
    IN _amount numeric,
    IN _payment_type_id integer
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
    _paid_amount NUMERIC(9,2);
    _pending_amount NUMERIC(9,2);
    _total NUMERIC(9,2);
    _payment_status_id INT;
    _paid_status_id INT := 5;
    _partial_status_id INT := 4;
BEGIN
    BEGIN
        SELECT paid_amount, total, payment_status_id
        INTO _paid_amount, _total, _payment_status_id
        FROM shop_sale
        WHERE id = _shop_sale_id
        FOR UPDATE;

        _paid_amount := _paid_amount + _amount;
        _pending_amount := _total - _paid_amount;

        IF _pending_amount < 0 THEN
            RAISE EXCEPTION 'El monto del pago excede el monto pendiente.';
        END IF;

        IF _pending_amount <= 0 THEN
            _payment_status_id := _paid_status_id;
        ELSIF _pending_amount < _total THEN
            _payment_status_id := _partial_status_id;
        END IF;

        INSERT INTO shop_sale_payment (shop_sale_id, amount, payment_type_id)
        VALUES (_shop_sale_id, _amount, _payment_type_id);

        UPDATE shop_sale
        SET payment_status_id = _payment_status_id,
            paid_amount = _paid_amount,
            pending_amount = _pending_amount,
            updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
        WHERE id = _shop_sale_id;

    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en adición de pago para venta: %', SQLERRM;
    END;
END;
$procedure$
;

-- ============================================================
-- add_shop_sale_payment_v2
-- Igual que add_shop_sale_payment pero distingue el destino del pago
-- (_payment_target = 'ORDER' | 'DELIVERY') para rastrear por separado
-- el crédito del pedido y el del envío.
-- ============================================================

CREATE OR REPLACE PROCEDURE public.add_shop_sale_payment_v2(
    IN _shop_sale_id uuid,
    IN _amount numeric,
    IN _payment_type_id integer,
    IN _payment_target varchar DEFAULT 'ORDER'
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
    _paid_amount NUMERIC(9,2);
    _pending_amount NUMERIC(9,2);
    _base_amount NUMERIC(9,2);   -- subtotal del pedido (total - delivery) o monto del envío
    _payment_status_id INT;
    _paid_status_id INT := 5;
    _partial_status_id INT := 4;
BEGIN
    BEGIN
        IF _payment_target = 'DELIVERY' THEN
            SELECT delivery_paid_amount, delivery, delivery_payment_status_id
            INTO _paid_amount, _base_amount, _payment_status_id
            FROM shop_sale
            WHERE id = _shop_sale_id
            FOR UPDATE;
        ELSE
            SELECT paid_amount, (total - delivery), payment_status_id
            INTO _paid_amount, _base_amount, _payment_status_id
            FROM shop_sale
            WHERE id = _shop_sale_id
            FOR UPDATE;
        END IF;

        _paid_amount := _paid_amount + _amount;
        _pending_amount := _base_amount - _paid_amount;

        IF _pending_amount < 0 THEN
            RAISE EXCEPTION 'El monto del pago excede el monto pendiente.';
        END IF;

        IF _pending_amount <= 0 THEN
            _payment_status_id := _paid_status_id;
        ELSIF _pending_amount < _base_amount THEN
            _payment_status_id := _partial_status_id;
        END IF;

        INSERT INTO shop_sale_payment (shop_sale_id, amount, payment_type_id, payment_target)
        VALUES (_shop_sale_id, _amount, _payment_type_id, _payment_target);

        IF _payment_target = 'DELIVERY' THEN
            UPDATE shop_sale
            SET delivery_payment_status_id = _payment_status_id,
                delivery_paid_amount = _paid_amount,
                delivery_pending_amount = _pending_amount,
                updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
            WHERE id = _shop_sale_id;
        ELSE
            UPDATE shop_sale
            SET payment_status_id = _payment_status_id,
                paid_amount = _paid_amount,
                pending_amount = _pending_amount,
                updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
            WHERE id = _shop_sale_id;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en adición de pago para venta: %', SQLERRM;
    END;
END;
$procedure$
;