-- =============================================================================
-- Migración: la verificación la firma el usuario que confirma
-- Fecha: 2026-09-02
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- ###########################################################################
-- ORDEN: correr DESPUÉS de 2026-08-29-verificacion-pedidos-bodega.sql y de
-- 2026-09-01-editar-pedido-listo.sql. El PASO 0 corta si falta alguna.
-- ###########################################################################
--
-- Contexto: hasta ahora verificar un pedido abría un modal que pedía ELEGIR de
-- una lista al usuario que había revisado. La idea era que el tablero corre en
-- una máquina compartida de bodega y la firma tenía que ser explícita.
--
-- En la práctica sobra: quien revisa el pedido es quien está usando la pantalla,
-- así que elegirse a sí mismo de una lista es un paso de más, y elegir a otro es
-- justamente lo que no se quiere. Se reemplaza por lo simple:
--
--     antes:  botón -> modal con lista de usuarios -> elegir -> confirmar
--     ahora:  botón -> aviso de confirmación -> firma el usuario logueado
--
-- QUÉ CAMBIA EN LA BASE, y por qué son endpoints nuevos y no un UPDATE a los que
-- ya existen: los viejos están corriendo en producción, así que se clonan.
--
--   /verifyProductForSaleStoreOrderV2 -> V3
--        Se le quita el exists(...) que exigía que el verificador fuera un
--        usuario ACTIVO con rol Sistema(1)/Bodega(7)/Administrador(9). Ese guard
--        existía porque el id venía elegido en pantalla y podía ser cualquiera;
--        ahora sale de la sesión, así que no hay nada que validar.
--
--        Dejarlo sería peor que quitarlo: quien tenga la capacidad orders.verify
--        pero un rol fuera de esa lista vería el botón, lo apretaría, y el UPDATE
--        no tocaría ninguna fila —sin error, porque un UPDATE que no matchea
--        devuelve OK—. Un botón que no hace nada y no explica por qué. El gate
--        queda uno solo: la capacidad, en el front. Es el mismo criterio de
--        orders.release y de los permisos de inventario: la capacidad habilita el
--        BOTÓN, no la operación.
--
--   manage_..._state_v5 (4 params) -> v6 (3 params)
--        El parámetro _verified_by_user_id desaparece: la firma sale de
--        _creator_user_id, que ya viajaba. Y la transición deja de PODER FALLAR
--        por falta de verificador: si el pedido llega a Listo sin firma, se firma
--        con quien lo está cerrando. Que un pedido Listo siempre tenga firma pasa
--        a ser una garantía de construcción en vez de una validación que rechaza.
--
--        Es un cambio de FIRMA, no solo de cuerpo, así que no alcanza con
--        CREATE OR REPLACE sobre el v5: quedarían las dos como sobrecargas. Por
--        eso el v6 es un nombre nuevo y el v5 queda intacto.
--
-- QUÉ NO CAMBIA:
--   * Las columnas verified_by_user_id / verified_date y su FK.
--   * Las lecturas: /listProductForSaleStoreOrderBoardV6 y
--     /getProductForSaleStoreOrderV6 ya traen la verificación.
--   * La capacidad orders.verify y a qué roles está asignada.
--   * Que la firma NO se reemplaza: los dos endpoints nuevos siguen exigiendo
--     verified_by_user_id is null.
--   * Que editar los productos de un pedido Preparado o Listo borra la firma
--     (update_product_for_sale_order_with_elements_v2), y que retroceder de
--     Preparado a En curso también (/unprepareProductForSaleStoreOrder).
--
-- /retrieveVerifierUsers queda vivo pero sin nadie que lo llame. No se borra: es
-- la vuelta atrás si esto se revierte.
--
-- CUÁNDO CORRERLA: ANTES de desplegar el front nuevo. Los endpoints viejos siguen
-- funcionando, así que el front actual no se rompe mientras tanto.
-- =============================================================================


-- #############################################################################
-- PASO 0 — Dependencias
--
-- Falla RUIDOSAMENTE en vez de insertar endpoints que reventarían al usarse.
-- #############################################################################

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'product_for_sale_store_order'
                      AND column_name = 'verified_by_user_id') THEN
        RAISE EXCEPTION 'Falta 2026-08-29-verificacion-pedidos-bodega.sql: no existe product_for_sale_store_order.verified_by_user_id';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.sql_queries
                    WHERE "path" = '/verifyProductForSaleStoreOrderV2') THEN
        RAISE EXCEPTION 'Falta 2026-09-01-editar-pedido-listo.sql: no existe /verifyProductForSaleStoreOrderV2';
    END IF;
END $$;


-- #############################################################################
-- PASO 1 — /verifyProductForSaleStoreOrderV3
--
-- Clon de la V2 sin el exists(...) del verificador. $2 sigue siendo el usuario
-- que firma, pero ahora lo pone la sesión y no una lista en pantalla.
--
-- Los dos guards que quedan son los que importan:
--   * factory_status_id in (64, 13) -> Preparado, o Listo para volver a firmar un
--     pedido que perdió la verificación al editarse.
--   * verified_by_user_id is null   -> la firma no se reemplaza. Un doble clic o
--     dos personas a la vez no reescriben quién verificó.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/verifyProductForSaleStoreOrderV3';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('verifyProductForSaleStoreOrderV3','/verifyProductForSaleStoreOrderV3','update product_for_sale_store_order
set verified_by_user_id = $2::uuid,
    verified_date = timezone(''UTC''::text, CURRENT_TIMESTAMP),
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1::uuid
  and factory_status_id in (64, 13)
  and verified_by_user_id is null','product_for_sale_store_order','PATCH');


-- #############################################################################
-- PASO 2 — manage_product_for_sale_order_state_v6
--
-- Clon EXACTO del v5 con dos cambios, los dos en la rama Listo(13):
--
--   a) se cae el parámetro _verified_by_user_id (la firma sale de
--      _creator_user_id, que ya viajaba);
--   b) se cae la validación del verificador —existencia, rol y estado— junto con
--      el RAISE de "se requiere seleccionar el usuario que verificó".
--
-- El resto no cambia una coma: el movimiento de inventario, las ramas
-- Entregado(16) y Devuelto(18), la validación del encargado y el relleno de
-- encargado/start_date cuando el pedido viene de Pendiente(11).
--
-- La regla de firma queda en dos líneas:
--
--   pedido YA verificado  -> no se toca. La firma de quien REVISÓ el pedido en
--                            Preparado sobrevive al cierre; no la pisa la de
--                            quien lo cerró.
--   pedido SIN verificar  -> lo firma quien ejecuta la transición.
--
-- Entregado(16) y Devuelto(18) no firman nada; la firma que traiga el pedido se
-- conserva por el COALESCE del UPDATE final.
-- #############################################################################

CREATE OR REPLACE PROCEDURE public.manage_product_for_sale_order_state_v6(IN _order_id uuid, IN _new_factory_status_id integer, IN _creator_user_id uuid)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    _current_factory_status_id INT;
    _current_establishment_id uuid;
    _current_assigned_user_id uuid;
    _current_verified_by_user_id uuid;
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
    _new_verified_by_user_id uuid := NULL;
    _verified_date timestamp := NULL;
    _curr_pfs_element RECORD;
    _curr_source_element_fk_id UUID;
    _curr_target_element_fk_id UUID;
BEGIN

    -- Bloqueo de fila para evitar conflictos concurrentes
    SELECT factory_status_id, establishment_id, assigned_user_id, verified_by_user_id
      INTO _current_factory_status_id, _current_establishment_id, _current_assigned_user_id, _current_verified_by_user_id
    FROM product_for_sale_store_order
    WHERE id = _order_id
    FOR UPDATE;

    _factory_status_id := _new_factory_status_id;

    -- Validación del estado
    IF _new_factory_status_id = 13 THEN
        IF _current_factory_status_id in (11, 12, 64) THEN

            -- Si el pedido fue tomado por alguien, solo esa persona o un admin
            -- puede marcarlo como Listo.
            IF _current_factory_status_id IN (12, 64) AND _current_assigned_user_id IS NOT NULL
               AND _current_assigned_user_id <> _creator_user_id THEN

                SELECT role_id INTO _actor_role_id FROM "user" WHERE id = _creator_user_id;

                IF COALESCE(_actor_role_id, 0) <> 1 THEN
                    RAISE EXCEPTION 'Solo el encargado que tomó el pedido puede marcarlo como Listo';
                END IF;
            END IF;

            -- NUEVO v6: un pedido no llega a Listo sin firma. Si nadie lo verificó
            -- antes, lo firma quien lo está cerrando; si ya venía verificado desde
            -- Preparado, se respeta esa firma.
            IF _current_verified_by_user_id IS NULL THEN
                _new_verified_by_user_id := _creator_user_id;
                _verified_date := timezone('UTC'::text, CURRENT_TIMESTAMP);
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
        verified_by_user_id = COALESCE(_new_verified_by_user_id, verified_by_user_id),
        verified_date = COALESCE(_verified_date, verified_date),
        updated_date = timezone('UTC'::text, CURRENT_TIMESTAMP)
    where id = _order_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error en manage_product_for_sale_order_state_v6: %', SQLERRM;

END;
$procedure$
;


-- Misma llamada que el v4: tres parámetros, sin el verificador.
DELETE FROM public.sql_queries WHERE "path" = '/manageProductForSaleStoreOrderV6';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('manageProductForSaleStoreOrderV6','/manageProductForSaleStoreOrderV6','call manage_product_for_sale_order_state_v6($1::uuid, $2, $3::uuid)','product_for_sale_store_order','PATCH');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- Los dos endpoints nuevos, una sola vez cada uno
-- SELECT "path", COUNT(*) AS veces FROM sql_queries
--  WHERE "path" IN ('/verifyProductForSaleStoreOrderV3','/manageProductForSaleStoreOrderV6')
--  GROUP BY "path" ORDER BY "path";
--
-- -- La V3 no valida rol y la V2 sí (debe dar false, true)
-- SELECT "path", consulta_sql LIKE '%role_id in (1, 7, 9)%' AS valida_rol
--   FROM sql_queries
--  WHERE "path" IN ('/verifyProductForSaleStoreOrderV3','/verifyProductForSaleStoreOrderV2')
--  ORDER BY "path";
--
-- -- Los dos procedures conviven, cada uno con su firma (v5 con 4, v6 con 3)
-- SELECT p.oid::regprocedure AS firma FROM pg_proc p
--  WHERE p.proname IN ('manage_product_for_sale_order_state_v5',
--                      'manage_product_for_sale_order_state_v6')
--  ORDER BY p.proname;
--
-- -- Tras cerrar un pedido sin verificar: queda firmado por quien lo cerró, con
-- -- verified_date igual a ready_date al segundo.
-- SELECT order_number, factory_status_id, verified_date, ready_date,
--        (SELECT username FROM "user" u WHERE u.id = pfsso.verified_by_user_id) AS verifico,
--        (SELECT username FROM "user" u WHERE u.id = pfsso.assigned_user_id) AS encargado
--   FROM product_for_sale_store_order pfsso
--  WHERE verified_date IS NOT NULL
--  ORDER BY verified_date DESC LIMIT 10;
--
-- -- Tras verificar uno Preparado con el botón: verified_date ANTERIOR a ready_date,
-- -- y el verificador NO se pisa al cerrarlo después.
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve al modal con revertir el commit; la base se deja como estaba:
--
-- DELETE FROM public.sql_queries WHERE "path" IN
--   ('/verifyProductForSaleStoreOrderV3','/manageProductForSaleStoreOrderV6');
-- DROP PROCEDURE IF EXISTS public.manage_product_for_sale_order_state_v6(uuid, integer, uuid);
--
-- /verifyProductForSaleStoreOrderV2, /manageProductForSaleStoreOrderV5 y
-- /retrieveVerifierUsers nunca se tocaron, así que el front viejo vuelve a andar
-- sin nada más que hacer.
-- #############################################################################
