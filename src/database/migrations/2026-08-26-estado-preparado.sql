-- =============================================================================
-- Migración: estado "Preparado" en el tablero de pedidos de bodega
-- Fecha: 2026-08-26
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- ###########################################################################
-- ORDEN: correr DESPUÉS de 2026-08-26-operadores-pedidos.sql.
-- El PASO 5 deriva sus queries de /listProductForSaleStoreOrderBoardV3 y
-- /getProductForSaleStoreOrderV4, que las crea esa migración. Sin ella los dos
-- INSERT del PASO 5 no insertan nada —el SELECT no encuentra origen— y el front
-- queda pidiendo endpoints que no existen.
-- Comprobar antes:
--   SELECT "path" FROM sql_queries
--    WHERE "path" IN ('/listProductForSaleStoreOrderBoardV3','/getProductForSaleStoreOrderV4');
-- Deben salir las dos filas.
-- ###########################################################################
--
-- Objetivo: un paso intermedio y OPCIONAL entre En curso(12) y Listo(13):
--
--     Pendiente(11) -> En curso(12) -> Preparado(64) -> Listo(13)
--          ^______________|                 |
--                         |_________________|   (En curso -> Listo directo)
--
-- Preparado NO mueve inventario y NO cambia el estado que ve la tienda: para la
-- tienda el pedido sigue Pendiente, igual que mientras está En curso. Es una
-- marca de bodega, nada más.
--
-- SOLO APLICA AL TABLERO. La vista de detalle sigue con su flujo, Pendiente ->
-- Listo con un botón, y no gana ninguna acción nueva. Lo único que cambia ahí
-- es que sabe DIBUJAR un pedido que está en Preparado, para que no se rompa el
-- diagrama de estados.
--
-- Además, "En camino"(1) deja de usarse. No se elimina nada: los pedidos que hoy
-- están en ese estado siguen siendo válidos y se pueden recibir o devolver como
-- siempre. Lo que se quita es la posibilidad de LLEVAR un pedido ahí desde el
-- tablero y desde la vista de detalle, y su columna del tablero. Eso es todo
-- front; esta migración no toca el estado 1.
--
-- ENFOQUE 100% ADITIVO:
--   * Status nuevo con id EXPLÍCITO, para que el front pueda referenciarlo.
--   * Columna prepared_date NULLABLE.
--   * manage_product_for_sale_order_state_v3 queda INTACTO; se agrega el v4, que
--     solo suma Preparado como origen válido hacia Listo.
--   * Las dos lecturas que necesitan la fecha nueva se clonan.
-- =============================================================================


-- #############################################################################
-- PASO 1 — Status "Preparado"
--
-- status.id es serial4, pero acá se inserta con id EXPLÍCITO: el front lo
-- referencia como pfsFactoryOrderStatusValues.preparado y necesita un número
-- estable. 64 es el siguiente libre (61 era el último ocupado antes de los dos
-- de customer, 62 y 63; ver src/database/customer.sql).
--
-- El bloque es idempotente y falla RUIDOSAMENTE si el 64 ya lo ocupa otra cosa,
-- en vez de seguir de largo y dejar al front apuntando a un estado ajeno.
--
-- El "type" y los colores se copian del estado En curso(12), que es de la misma
-- familia: así no hay que adivinar el valor exacto de la columna type, que no
-- está versionado en este repo.
-- #############################################################################

DO $$
DECLARE
    _existing_name text;
    _type          varchar(25);
BEGIN
    SELECT "name" INTO _existing_name FROM public.status WHERE id = 64;

    IF _existing_name IS NULL THEN

        SELECT s."type" INTO _type FROM public.status s WHERE s.id = 12;
        IF _type IS NULL THEN
            RAISE EXCEPTION 'No existe el status 12 (En curso); no se puede deducir el "type" de Preparado';
        END IF;

        INSERT INTO public.status (id, status, "name", "type", bg_color, color)
        VALUES (64, 1, 'Preparado', _type, '#9b59b6', '#fdfefe');

        -- La secuencia queda por encima del id insertado a mano: sin esto, el
        -- proximo INSERT sin id explicito chocaria contra el 64.
        PERFORM setval('status_id_seq', GREATEST((SELECT MAX(id) FROM public.status), 64));

    ELSIF _existing_name <> 'Preparado' THEN
        RAISE EXCEPTION 'El status id 64 ya lo ocupa "%". Elegir otro id para Preparado y actualizar pfsFactoryOrderStatusValues en el front.', _existing_name;
    END IF;
END $$;


-- #############################################################################
-- PASO 2 — Fecha de preparación
--
-- Se escribe al pasar a Preparado(64). Queda NULL para siempre en los pedidos
-- que van de En curso directo a Listo, que es el camino corto y válido: el
-- diagrama de la vista de detalle OMITE el paso cuando esta columna está vacía,
-- igual que ya hace con in_transit_date.
-- #############################################################################

ALTER TABLE public.product_for_sale_store_order
    ADD COLUMN IF NOT EXISTS prepared_date timestamp NULL;


-- #############################################################################
-- PASO 3 — En curso(12) -> Preparado(64)
--
-- UPDATE puro: no mueve inventario y no toca store_status_id, porque para la
-- tienda no cambió nada (sigue en Pendiente, 19).
--
-- El guard "and factory_status_id = 12" evita que un doble clic reescriba la
-- fecha, y el de encargado replica el del procedure: el pedido lo avanza quien
-- lo tomó, o un admin.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/prepareProductForSaleStoreOrder';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('prepareProductForSaleStoreOrder','/prepareProductForSaleStoreOrder','update product_for_sale_store_order
set factory_status_id = 64,
    prepared_date = timezone(''UTC''::text, CURRENT_TIMESTAMP),
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1::uuid
  and factory_status_id = 12
  and (assigned_user_id = $2::uuid
       or assigned_user_id is null
       or exists (select 1 from "user" u where u.id = $2::uuid and u.role_id = 1))','product_for_sale_store_order','PATCH');


-- #############################################################################
-- PASO 4 — manage_product_for_sale_order_state_v4
--
-- Clon EXACTO del v3 con dos cambios, los dos en la rama Listo(13):
--
--   a) Preparado(64) se suma a los orígenes válidos: in (11, 12) pasa a
--      in (11, 12, 64).
--   b) La validación del encargado, que hoy solo corre cuando el pedido viene de
--      En curso(12), corre también cuando viene de Preparado(64): el pedido
--      sigue teniendo dueño.
--
-- Lo demás no cambia una coma: el movimiento de inventario, las ramas
-- Entregado(16) y Devuelto(18), y el relleno de encargado/start_date cuando el
-- pedido viene de Pendiente(11) —el atajo de la vista de detalle— quedan igual.
-- #############################################################################

CREATE OR REPLACE PROCEDURE public.manage_product_for_sale_order_state_v4(IN _order_id uuid, IN _new_factory_status_id integer, IN _creator_user_id uuid)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    _current_factory_status_id INT;
    _current_establishment_id uuid;
    _current_assigned_user_id uuid;
    _actor_role_id INT;
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
    _ready_date timestamp := NULL;
    _received_date timestamp := NULL;
    _start_date timestamp := NULL;
    _assigned_user_id uuid := NULL;
    _curr_pfs_element RECORD;
    _curr_source_element_fk_id UUID;
    _curr_target_element_fk_id UUID;
BEGIN

    -- Bloqueo de fila para evitar conflictos concurrentes
    SELECT factory_status_id, establishment_id, assigned_user_id
      INTO _current_factory_status_id, _current_establishment_id, _current_assigned_user_id
    FROM product_for_sale_store_order
    WHERE id = _order_id
    FOR UPDATE;

    _factory_status_id := _new_factory_status_id;

    -- Validación del estado
    IF _new_factory_status_id = 13 THEN
        -- NUEVO v4: Preparado(64) es un origen válido hacia Listo.
        IF _current_factory_status_id in (11, 12, 64) THEN

            -- Si el pedido fue tomado por alguien, solo esa persona o un admin
            -- puede marcarlo como Listo. NUEVO v4: aplica también desde Preparado.
            IF _current_factory_status_id IN (12, 64) AND _current_assigned_user_id IS NOT NULL
               AND _current_assigned_user_id <> _creator_user_id THEN

                SELECT role_id INTO _actor_role_id FROM "user" WHERE id = _creator_user_id;

                IF COALESCE(_actor_role_id, 0) <> 1 THEN
                    RAISE EXCEPTION 'Solo el encargado que tomó el pedido puede marcarlo como Listo';
                END IF;
            END IF;

            -- Atajo Pendiente -> Listo (vista de detalle). El pedido no pasó por
            -- En curso, así que no tiene encargado ni hora de inicio: se le
            -- asignan a quien ejecuta la acción.
            IF _current_factory_status_id = 11 THEN
                _assigned_user_id := _creator_user_id;
                _start_date := timezone('UTC'::text, CURRENT_TIMESTAMP);
            END IF;

            _source_inventory_type := 'finished_product';
            _source_unit_name := 'bodega';
            _source_comment := 'Consumo de producto terminado';
            _source_action_type_id := 8;

            _target_comment := 'Registro de producto para venta';
            _target_unit_name := 'in_transit';
            _target_action_type_id := 9;

            _store_status_id := 21;

            _ready_date := timezone('UTC'::text, CURRENT_TIMESTAMP);

        else
            RAISE EXCEPTION 'El estado del pedido no se encuentra Pendiente, En curso o Preparado para pasar el estado a Listo';
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

            _received_date := timezone('UTC'::text, CURRENT_TIMESTAMP);

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
    set factory_status_id = _factory_status_id,
        store_status_id = _store_status_id,
        assigned_user_id = COALESCE(_assigned_user_id, assigned_user_id),
        start_date = COALESCE(_start_date, start_date),
        ready_date = COALESCE(_ready_date, ready_date),
        received_date = COALESCE(_received_date, received_date),
        updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
    where id = _order_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en manage_product_for_sale_order_state_v4: %', SQLERRM;

END;
$procedure$
;


DELETE FROM public.sql_queries WHERE "path" = '/manageProductForSaleStoreOrderV4';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('manageProductForSaleStoreOrderV4','/manageProductForSaleStoreOrderV4','call manage_product_for_sale_order_state_v4($1::uuid, $2, $3::uuid)','product_for_sale_store_order','PATCH');


-- #############################################################################
-- PASO 5 — Lecturas con prepared_date
--
-- Derivadas con replace() de la fila viva, igual que las migraciones anteriores.
-- El ancla es "'readyDate', pfsso.ready_date," y no la clave 'id': prepared_date
-- va junto a las otras fechas del ciclo de vida, no al principio del objeto.
-- Aparece una sola vez en las dos queries.
-- #############################################################################

-- 5.a Listado del tablero: la tarjeta muestra la hora de preparación.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'listProductForSaleStoreOrderBoardV4','/listProductForSaleStoreOrderBoardV4',
       replace(consulta_sql,
           '''readyDate'', pfsso.ready_date,',
           '''readyDate'', pfsso.ready_date,
        ''preparedDate'', pfsso.prepared_date,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/listProductForSaleStoreOrderBoardV3'
  AND consulta_sql LIKE '%''readyDate'', pfsso.ready_date,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/listProductForSaleStoreOrderBoardV4');

-- 5.b Detalle: el diagrama de estados necesita la fecha para pintar el paso.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getProductForSaleStoreOrderV5','/getProductForSaleStoreOrderV5',
       replace(consulta_sql,
           '''readyDate'', pfsso.ready_date,',
           '''readyDate'', pfsso.ready_date,
    ''preparedDate'', pfsso.prepared_date,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getProductForSaleStoreOrderV4'
  AND consulta_sql LIKE '%''readyDate'', pfsso.ready_date,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderV5');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- El status quedó con el id 64 y el mismo "type" que En curso
-- SELECT id, "name", "type", bg_color, color FROM status WHERE id IN (12, 64) ORDER BY id;
--
-- -- La secuencia quedó por encima del id insertado a mano
-- SELECT last_value FROM status_id_seq;
--
-- -- Columna nueva
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--  WHERE table_name = 'product_for_sale_store_order' AND column_name = 'prepared_date';
--
-- -- Procedure y endpoints (debe dar 4 filas, veces = 1)
-- SELECT proname FROM pg_proc WHERE proname = 'manage_product_for_sale_order_state_v4';
-- SELECT "path", COUNT(*) AS veces FROM sql_queries
--  WHERE "path" IN ('/prepareProductForSaleStoreOrder','/manageProductForSaleStoreOrderV4',
--                   '/listProductForSaleStoreOrderBoardV4','/getProductForSaleStoreOrderV5')
--  GROUP BY "path" ORDER BY "path";
--
-- -- Los clones traen la fecha nueva y los originales siguen sin ella
-- SELECT "path", consulta_sql LIKE '%preparedDate%' AS trae_fecha FROM sql_queries
--  WHERE "path" IN ('/listProductForSaleStoreOrderBoardV3','/listProductForSaleStoreOrderBoardV4',
--                   '/getProductForSaleStoreOrderV4','/getProductForSaleStoreOrderV5');
--
-- -- Tras pasar un pedido a Preparado en el tablero: store_status_id NO cambia (19)
-- SELECT order_number, factory_status_id, store_status_id, start_date, prepared_date, ready_date
--   FROM product_for_sale_store_order WHERE prepared_date IS NOT NULL
--  ORDER BY prepared_date DESC LIMIT 5;
-- #############################################################################
