-- =============================================================================
-- Migración: Tablero (Kanban) de pedidos de producto terminado en bodega
-- Fecha: 2026-08-10
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Objetivo: nueva pantalla /finishedProduct/order/board con 4 listados y
-- arrastre de tarjetas entre ellos:
--
--     Pendiente(11) -> En curso(12) -> Listo(13) -> En camino(1)
--          ^______________|
--     (retroceso permitido: no mueve inventario)
--
-- El estado 12 (En curso) existía en el catálogo pero nunca se usaba. Ahora
-- registra QUIÉN tomó el pedido y CUÁNDO, y solo esa persona (o un admin)
-- puede marcarlo como Listo.
--
-- ENFOQUE 100% ADITIVO — no se modifica ninguna query ni procedure existente:
--   * manage_product_for_sale_order_state (v1) queda INTACTO. Lo siguen usando
--     la vista de tabla actual (11 -> 13 directo) y la tienda (16 Entregado /
--     18 Devuelto). Ambas vistas coexisten hasta que se elimine la vieja.
--   * Se agrega manage_product_for_sale_order_state_v2: clon del v1 más la
--     validación del encargado y el registro de ready_date.
--   * Las columnas nuevas son NULLABLE: la vista vieja las ignora y los pedidos
--     que hoy ya están en Listo/En camino se quedan en NULL. El tablero los
--     renderiza igual, sin encargado ni horas.
--
-- IMPORTANTE: el backend es routing SQL puro, sin validación de rol. Toda la
-- regla de negocio vive en el procedure y en los guards de los UPDATE; el
-- frontend solo deshabilita el arrastre por UX.
-- =============================================================================


-- #############################################################################
-- PASO 1 — Columnas nuevas en product_for_sale_store_order
-- #############################################################################

ALTER TABLE public.product_for_sale_store_order
    ADD COLUMN IF NOT EXISTS assigned_user_id uuid NULL,
    ADD COLUMN IF NOT EXISTS start_date timestamp NULL,
    ADD COLUMN IF NOT EXISTS ready_date timestamp NULL;

-- FK del encargado. Envuelto para que la migración sea re-ejecutable.
DO $$
BEGIN
    ALTER TABLE public.product_for_sale_store_order
        ADD CONSTRAINT product_for_sale_store_order_fk_assigned_user_id
        FOREIGN KEY (assigned_user_id) REFERENCES "user"(id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Índice para el filtro por estado del tablero.
CREATE INDEX IF NOT EXISTS idx_pfsso_factory_status
    ON public.product_for_sale_store_order (factory_status_id);


-- #############################################################################
-- PASO 2 — Colores y nombre del status 12 (En curso)
--
-- El status existe como FK válido pero nunca se usó, así que puede tener
-- bg_color/color en NULL. El tablero los usa para pintar la columna.
-- Verificar antes:  SELECT id, "name", "type", bg_color, color FROM status WHERE id = 12;
-- #############################################################################

UPDATE public.status
SET bg_color = COALESCE(NULLIF(bg_color, ''), '#8e44ad'),
    color    = COALESCE(NULLIF(color, ''),    '#fdfefe')
WHERE id = 12;


-- #############################################################################
-- PASO 3 — manage_product_for_sale_order_state_v2
--
-- Clon exacto del v1 con dos agregados:
--   a) si el pedido viene de En curso(12), solo el encargado asignado o un
--      admin (role_id = 1) puede pasarlo a Listo(13);
--   b) se registra ready_date al pasar a Listo.
--
-- Se mantienen las tres ramas del v1 (13 Listo / 16 Entregado / 18 Devuelto)
-- para que el v2 pueda reemplazar al v1 por completo cuando se elimine la
-- vista vieja.
-- #############################################################################

CREATE OR REPLACE PROCEDURE public.manage_product_for_sale_order_state_v2(IN _order_id uuid, IN _new_factory_status_id integer, IN _creator_user_id uuid)
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

            -- NUEVO: si el pedido fue tomado por alguien, solo esa persona o un
            -- admin puede marcarlo como Listo.
            IF _current_factory_status_id = 12 AND _current_assigned_user_id IS NOT NULL
               AND _current_assigned_user_id <> _creator_user_id THEN

                SELECT role_id INTO _actor_role_id FROM "user" WHERE id = _creator_user_id;

                IF COALESCE(_actor_role_id, 0) <> 1 THEN
                    RAISE EXCEPTION 'Solo el encargado que tomó el pedido puede marcarlo como Listo';
                END IF;
            END IF;

            _source_inventory_type := 'finished_product';
            _source_unit_name := 'bodega';
            _source_comment := 'Consumo de producto terminado';
            _source_action_type_id := 8;

            _target_comment := 'Registro de producto para venta';
            _target_unit_name := 'in_transit';
            _target_action_type_id := 9;

            _store_status_id := 21;

            -- NUEVO: hora de finalización
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
        ready_date = COALESCE(_ready_date, ready_date),
        updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
    where id = _order_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en manage_product_for_sale_order_state_v2: %', SQLERRM;

END;
$procedure$
;


-- #############################################################################
-- PASO 4 — Endpoints nuevos en sql_queries
--
-- Los 4 son filas nuevas. Ninguna query existente se toca.
--
-- sql_queries no tiene constraint único en "path", así que re-ejecutar esta
-- migración duplicaría las filas y el router podría resolver la equivocada.
-- El DELETE previo la hace idempotente: solo borra los 4 paths nuevos.
-- #############################################################################

DELETE FROM public.sql_queries
 WHERE "path" IN ('/listProductForSaleStoreOrderBoard',
                  '/startProductForSaleStoreOrder',
                  '/releaseProductForSaleStoreOrder',
                  '/manageProductForSaleStoreOrderV2');

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES

-- 4.1 Listado del tablero: clon de listProductForSaleStoreOrder + assignedUser,
--     startDate y readyDate. SIN los elementos del pedido: el detalle se pide
--     aparte con /getProductForSaleStoreOrder al abrir el modal "Ver productos".
--     Mantener liviana esta query es lo que hace viable el autorefresh.
	 ('listProductForSaleStoreOrderBoard','/listProductForSaleStoreOrderBoard','SELECT json_agg(
    json_build_object(
        ''id'', pfsso.id,
        ''name'', pfsso.name,
        ''comment'', pfsso.comment,
        ''finalAmount'', pfsso.final_amount,
        ''updatedDate'', coalesce(pfsso.updated_date, pfsso.creation_date),
        ''creationDate'', pfsso.creation_date,
        ''startDate'', pfsso.start_date,
        ''readyDate'', pfsso.ready_date,
        ''establishment'', json_build_object(
        	''name'', e."name",
            ''identifier'', e."name",
            ''id'', e.id,
            ''address'', e.address
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
        ) end
    )
    ORDER BY pfsso.creation_date DESC
) AS json_result
from product_for_sale_store_order pfsso
left join establishment e on e.id = pfsso.establishment_id
left join status s on s.id = pfsso.store_status_id
left join status s2 on s2.id = pfsso.factory_status_id
left join "user" u on u.id = pfsso.creator_user_id
left join "user" u2 on u2.id = pfsso.assigned_user_id','product_for_sale_store_order','POST'),

-- 4.2 Pendiente(11) -> En curso(12). UPDATE puro, NO mueve inventario.
--     El guard "and factory_status_id = 11" evita que dos personas tomen el
--     mismo pedido a la vez: la segunda llamada afecta 0 filas.
--     store_status_id se deja en 19 a propósito: para la tienda no cambió nada.
	 ('startProductForSaleStoreOrder','/startProductForSaleStoreOrder','update product_for_sale_store_order
set factory_status_id = 12,
    assigned_user_id = $2::uuid,
    start_date = timezone(''UTC''::text, CURRENT_TIMESTAMP),
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1::uuid
  and factory_status_id = 11','product_for_sale_store_order','PATCH'),

-- 4.3 En curso(12) -> Pendiente(11). Libera el pedido y limpia encargado/hora.
--     Solo el encargado o un admin pueden liberarlo; si no, cualquiera podría
--     "robar" un pedido devolviéndolo a Pendiente y volviéndolo a tomar.
	 ('releaseProductForSaleStoreOrder','/releaseProductForSaleStoreOrder','update product_for_sale_store_order
set factory_status_id = 11,
    assigned_user_id = null,
    start_date = null,
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1::uuid
  and factory_status_id = 12
  and (assigned_user_id = $2::uuid
       or assigned_user_id is null
       or exists (select 1 from "user" u where u.id = $2::uuid and u.role_id = 1))','product_for_sale_store_order','PATCH'),

-- 4.4 Transición de estado v2 (la usa el tablero para En curso -> Listo).
	 ('manageProductForSaleStoreOrderV2','/manageProductForSaleStoreOrderV2','call manage_product_for_sale_order_state_v2($1::uuid, $2, $3::uuid)','product_for_sale_store_order','PATCH');


-- #############################################################################
-- PASO 5 — Permisos de ruta para la vista nueva: /finishedProduct/order/board
--
-- El guard canActivateV2 valida la ruta contra role.paths, que es un JSON con
-- objetos { "matchPattern": "<regex>" }.
--
-- Si el rol ya tiene un patrón amplio del módulo (ej. "^\/finishedProduct(\/.*)?$")
-- la ruta nueva YA queda cubierta y no hay nada que hacer.
-- Verificar primero el contenido actual:
--     SELECT id, "name", paths FROM "role";
--
-- Si el patrón fuera exacto por ruta, agregarlo a los roles que deban ver el
-- tablero (1 = Sistema; ajustar los ids según corresponda):
--
-- UPDATE "role"
-- SET paths = (
--     paths::jsonb || '[{"matchPattern": "^\\/finishedProduct\\/order\\/board$"}]'::jsonb
-- )::text
-- WHERE id IN (1);
--
-- Ojo: el guard solo valida la RUTA, no el rol. Sin esto la pantalla redirige
-- a /home y el ítem del menú no se renderiza.
-- #############################################################################


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'product_for_sale_store_order'
--    AND column_name IN ('assigned_user_id','start_date','ready_date');
--
-- SELECT id, "name", bg_color, color FROM status WHERE id = 12;
--
-- SELECT "path" FROM sql_queries
--  WHERE "path" IN ('/listProductForSaleStoreOrderBoard',
--                   '/startProductForSaleStoreOrder',
--                   '/releaseProductForSaleStoreOrder',
--                   '/manageProductForSaleStoreOrderV2');
--
-- SELECT proname FROM pg_proc WHERE proname = 'manage_product_for_sale_order_state_v2';
-- #############################################################################
