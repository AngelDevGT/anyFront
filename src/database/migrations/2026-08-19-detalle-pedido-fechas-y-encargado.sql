-- =============================================================================
-- Migración: fechas completas del ciclo de vida del pedido + detalle enriquecido
-- Fecha: 2026-08-19
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Contexto: la vista "Ver pedido" se rehace con un diagrama de estados que
-- muestra CUÁNDO se cumplió cada etapa. Hoy solo existen creation_date,
-- start_date y ready_date (estas dos últimas las escribe únicamente el tablero),
-- así que:
--
--   1. Faltan las fechas de En camino y Recibido.
--   2. Un pedido que va de Pendiente(11) directo a Listo(13) —atajo que la vista
--      permite a propósito y que el tablero no— queda sin encargado y sin hora
--      de inicio. Ese atajo es un requisito real, así que en vez de prohibirlo
--      se rellenan los tres campos con quien hizo la acción y el momento en que
--      la hizo.
--   3. Lo mismo con confirm_and_receive_pfs_order, el atajo de la tienda que va
--      de Pendiente(11) a Entregado(16) de un golpe sin pasar por Listo.
--
-- Las fechas NO se rellenan hacia atrás: un NULL sigue significando "nunca se
-- registró". Para los pedidos históricos, el front cae a updated_date en el
-- último paso alcanzado del diagrama, que es el único donde esa fecha es
-- realmente el momento de la transición.
--
-- ENFOQUE 100% ADITIVO:
--   * Columnas nuevas NULLABLE.
--   * manage_product_for_sale_order_state_v2 y confirm_and_receive_pfs_order
--     quedan INTACTOS. Se agregan _v3 y _v2 respectivamente.
--   * Las 3 queries que cambian se clonan; las originales siguen vivas.
--
-- Ojo con las versiones desfasadas: el endpoint /manageProductForSaleStoreOrder
-- va por V2 y su procedure también por v2, pero /updateProductForSaleStoreOrder-
-- EnCamino y /confirmAndReceivePFSOrder no tenían versión, así que nacen en V2.
-- =============================================================================


-- #############################################################################
-- PASO 1 — Columnas de fecha nuevas
--
-- in_transit_date: se escribe al pasar a En camino(1). Puede quedarse NULL para
--   siempre y es correcto: un pedido puede ir de Listo(13) directo a
--   Entregado(16) sin pasar por En camino. Por eso el diagrama OMITE el paso
--   "En camino" cuando esta columna es NULL, en vez de mostrarlo vacío.
--
-- received_date: se escribe al pasar a Entregado(16), venga de Listo(13), de
--   En camino(1) o del atajo confirm_and_receive.
-- #############################################################################

ALTER TABLE public.product_for_sale_store_order
    ADD COLUMN IF NOT EXISTS in_transit_date timestamp NULL,
    ADD COLUMN IF NOT EXISTS received_date   timestamp NULL;


-- #############################################################################
-- PASO 2 — manage_product_for_sale_order_state_v3
--
-- Clon del v2 con dos agregados, ambos en las asignaciones; la lógica de
-- inventario y las validaciones de estado no cambian una coma:
--
--   a) rama Listo(13): si el pedido viene de Pendiente(11) —nunca pasó por
--      En curso— se llenan assigned_user_id y start_date con quien ejecuta la
--      acción y el momento actual. Si viene de En curso(12) NO se pisan: ahí ya
--      los escribió /startProductForSaleStoreOrder.
--   b) rama Entregado(16): se registra received_date.
--
-- El UPDATE final usa COALESCE en todas las fechas para que ninguna rama borre
-- lo que otra ya había escrito.
-- #############################################################################

CREATE OR REPLACE PROCEDURE public.manage_product_for_sale_order_state_v3(IN _order_id uuid, IN _new_factory_status_id integer, IN _creator_user_id uuid)
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
        IF _current_factory_status_id in (11, 12) THEN

            -- Si el pedido fue tomado por alguien, solo esa persona o un admin
            -- puede marcarlo como Listo.
            IF _current_factory_status_id = 12 AND _current_assigned_user_id IS NOT NULL
               AND _current_assigned_user_id <> _creator_user_id THEN

                SELECT role_id INTO _actor_role_id FROM "user" WHERE id = _creator_user_id;

                IF COALESCE(_actor_role_id, 0) <> 1 THEN
                    RAISE EXCEPTION 'Solo el encargado que tomó el pedido puede marcarlo como Listo';
                END IF;
            END IF;

            -- NUEVO v3: atajo Pendiente -> Listo. El pedido no pasó por En curso,
            -- así que no tiene encargado ni hora de inicio. Se le asignan a quien
            -- ejecuta la acción, para que el detalle no quede con campos vacíos.
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
            RAISE EXCEPTION 'El estado del pedido no se encuentra Pendiente o En curso para pasar el estado a Listo';
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

            -- NUEVO v3: hora de recepción en tienda
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
        RAISE EXCEPTION 'Error en manage_product_for_sale_order_state_v3: %', SQLERRM;

END;
$procedure$
;


-- #############################################################################
-- PASO 3 — confirm_and_receive_pfs_order_v2
--
-- Clon del v1 con el mismo criterio del PASO 2: este atajo lleva el pedido de
-- Pendiente(11) a Entregado(16) sin pasar por En curso ni por Listo, así que
-- rellena las cuatro marcas de una sola vez con el momento de la acción.
--
-- in_transit_date se queda NULL a propósito: el pedido nunca estuvo en camino,
-- y el diagrama omite ese paso cuando la columna está vacía.
--
-- COALESCE en todas: si alguna ya tenía valor, no se pisa.
-- #############################################################################

CREATE OR REPLACE PROCEDURE public.confirm_and_receive_pfs_order_v2(IN _order_id uuid, IN _creator_user_id uuid)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    _current_factory_status_id INT;
    _current_establishment_id uuid;
    _curr_pfs_element RECORD;
    _now timestamp := timezone('UTC'::text, CURRENT_TIMESTAMP);
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
    SET factory_status_id = 16,
        store_status_id = 22,
        assigned_user_id = COALESCE(assigned_user_id, _creator_user_id),
        start_date       = COALESCE(start_date, _now),
        ready_date       = COALESCE(ready_date, _now),
        received_date    = COALESCE(received_date, _now),
        updated_date     = _now
    WHERE id = _order_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en confirm_and_receive_pfs_order_v2: %', SQLERRM;

END;
$procedure$
;


-- #############################################################################
-- PASO 4 — Endpoints nuevos
--
-- DELETE previo para que la migración sea re-ejecutable: sql_queries no tiene
-- unique en "path" y una fila duplicada haría que el router resuelva de forma
-- no determinista.
-- #############################################################################

DELETE FROM public.sql_queries
 WHERE "path" IN ('/manageProductForSaleStoreOrderV3',
                  '/confirmAndReceivePFSOrderV2',
                  '/updateProductForSaleStoreOrderEnCaminoV2');

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES

-- 4.1 Transiciones Listo(13) / Entregado(16) / Devuelto(18) con las fechas nuevas.
	 ('manageProductForSaleStoreOrderV3','/manageProductForSaleStoreOrderV3','call manage_product_for_sale_order_state_v3($1::uuid, $2, $3::uuid)','product_for_sale_store_order','PATCH'),

-- 4.2 Atajo Pendiente -> Recibido de la tienda.
	 ('confirmAndReceivePFSOrderV2','/confirmAndReceivePFSOrderV2','call confirm_and_receive_pfs_order_v2($1::uuid, $2::uuid)','product_for_sale_store_order','PATCH'),

-- 4.3 Listo(13) -> En camino(1). Clon del original más in_transit_date.
--     El guard "and factory_status_id = 13" no estaba en el original; se agrega
--     para que un doble clic no reescriba la fecha de un pedido ya en camino.
	 ('updateProductForSaleStoreOrderEnCaminoV2','/updateProductForSaleStoreOrderEnCaminoV2','update product_for_sale_store_order
set factory_status_id = 1,
    store_status_id = 20,
    in_transit_date = timezone(''UTC''::text, CURRENT_TIMESTAMP),
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1::uuid
  and factory_status_id = 13','product_for_sale_store_order','PATCH');


-- #############################################################################
-- PASO 5 — /getProductForSaleStoreOrderV3
--
-- Clon de la V2 con lo que necesita la vista nueva:
--   * assignedUser, startDate, readyDate, inTransitDate, receivedDate
--   * bg_color y color en storeStatus y factoryStatus (la V2 solo devolvía
--     identifier e id, y los pills de estado los necesitan)
--
-- Y con una cosa MENOS: finishedProduct.photo. La V2 lo devolvía por cada línea
-- del pedido —imagen completa en base64— y no lo consume nadie: ni la vista de
-- detalle ni la de edición, que son sus dos únicos clientes. La única pantalla
-- de pedidos que muestra foto es el modal de edición, y la saca del inventario
-- (selectedIE), no del pedido.
--
-- Va escrita literal y no derivada con replace() como las V2: el assignedUser
-- necesita un join nuevo, y encadenar replace() para meter un JOIN es frágil.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderV3';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('getProductForSaleStoreOrderV3','/getProductForSaleStoreOrderV3','SELECT json_build_object(
    ''id'', pfsso.id,
    ''orderNumber'', pfsso.order_number,
    ''name'', pfsso.name,
    ''comment'', pfsso.comment,
    ''finalAmount'', pfsso.final_amount,
    ''updatedDate'', coalesce(pfsso.updated_date, pfsso.creation_date),
    ''creationDate'', pfsso.creation_date,
    ''startDate'', pfsso.start_date,
    ''readyDate'', pfsso.ready_date,
    ''inTransitDate'', pfsso.in_transit_date,
    ''receivedDate'', pfsso.received_date,
    ''establishment'', json_build_object(
        ''identifier'', e."name",
		''name'', e."name",
        ''id'', e.id,
        ''address'', e.address,
		''receivePendingOrdersEnabled'', e.receive_pending_orders_enabled
    ),
    ''storeStatus'', json_build_object(
        ''identifier'', s.name,
        ''id'', s.id,
        ''bg_color'', s.bg_color,
        ''color'', s.color
    ),
    ''factoryStatus'', json_build_object(
        ''identifier'', s2.name,
        ''id'', s2.id,
        ''bg_color'', s2.bg_color,
        ''color'', s2.color
    ),
    ''creatorUser'', json_build_object(
        ''name'', u.username,
        ''email'', u.email,
        ''id'', u.id
    ),
    ''assignedUser'', case when u2.id is null then null else json_build_object(
        ''name'', u2.username,
        ''email'', u2.email,
        ''id'', u2.id
    ) end,
    ''productForSaleStoreOrderElements'', (
	    SELECT json_agg(
		    json_build_object(
		    	''id'', pfssoe.id,
		    	''price'', pfssoe.price,
		    	''quantity'', pfssoe.quantity,
		    	''totalPrice'', pfssoe.total_price,
		    	''date'', pfssoe."date",
		    	''measure'', json_build_object(
		    		''id'', m5.id,
	                ''identifier'', m5.name
	            ),
		        ''productForSale'', json_build_object(
		        	''id'', pfs.id,
			        ''creationDate'', pfs.creation_date,
				    ''updatedDate'', pfs.updated_date,
			        ''price'', pfs.price,
			        ''finishedProduct'', json_build_object(
			            ''id'', fp.id,
			            ''name'', fp.name,
			            ''description'', fp.description,
			            ''measure'', json_build_object(
			                ''identifier'', ub.name,
			                ''type'', ub."type"
			            )
			        ),
			        ''status'', json_build_object(
			            ''name'', s3.name,
			            ''type'', s3."type"
			        ),
			        ''establishment'', json_build_object(
			            ''id'', e3.id,
			            ''name'', e3.name
			        )
		        )
		    )
		)
		from product_for_sale_store_order_element pfssoe
		left join product_for_sale pfs on pfs.id = pfssoe.product_for_sale_id
		LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
		LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
		LEFT JOIN establishment e3 ON e3.id = pfs.establishment_id
		LEFT JOIN status s3 ON s3.id = pfs.status_id
		left join measure m5 on m5.id = pfssoe.measure_id
		WHERE pfssoe.pfsso_id = pfsso.id
	)
) as json_result
from product_for_sale_store_order pfsso
left join establishment e on e.id = pfsso.establishment_id
left join status s on s.id = pfsso.store_status_id
left join status s2 on s2.id = pfsso.factory_status_id
left join "user" u on u.id = pfsso.creator_user_id
left join "user" u2 on u2.id = pfsso.assigned_user_id','product_for_sale_store_order','POST');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- SELECT column_name, is_nullable FROM information_schema.columns
--  WHERE table_name = 'product_for_sale_store_order'
--    AND column_name IN ('in_transit_date','received_date');
--
-- SELECT proname FROM pg_proc
--  WHERE proname IN ('manage_product_for_sale_order_state_v3','confirm_and_receive_pfs_order_v2');
--
-- SELECT "path" FROM sql_queries
--  WHERE "path" IN ('/manageProductForSaleStoreOrderV3','/confirmAndReceivePFSOrderV2',
--                   '/updateProductForSaleStoreOrderEnCaminoV2','/getProductForSaleStoreOrderV3');
--
-- -- La V3 del detalle trae los campos nuevos y la V2 sigue sin ellos
-- SELECT "path", consulta_sql LIKE '%receivedDate%' AS trae_fechas
--   FROM sql_queries
--  WHERE "path" IN ('/getProductForSaleStoreOrderV2','/getProductForSaleStoreOrderV3');
--
-- -- Tras marcar un pedido Pendiente como Listo, los tres campos deben quedar llenos
-- SELECT order_number, factory_status_id, assigned_user_id, start_date, ready_date,
--        in_transit_date, received_date
--   FROM product_for_sale_store_order ORDER BY creation_date DESC LIMIT 5;
-- #############################################################################
