-- =============================================================================
-- Migración: verificación de pedidos de producto para venta
-- Fecha: 2026-08-29
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- ###########################################################################
-- ORDEN: correr DESPUÉS de 2026-08-26-estado-preparado.sql.
-- El PASO 6 deriva sus queries de /listProductForSaleStoreOrderBoardV4 y
-- /getProductForSaleStoreOrderV5, que las crea esa migración. Sin ella los dos
-- INSERT del PASO 6 no insertan nada —el SELECT no encuentra origen— y el front
-- queda pidiendo endpoints que no existen.
-- Comprobar antes:
--   SELECT "path" FROM sql_queries
--    WHERE "path" IN ('/listProductForSaleStoreOrderBoardV4','/getProductForSaleStoreOrderV5');
-- Deben salir las dos filas.
-- ###########################################################################
--
-- ###########################################################################
-- SUPERSEDIDA EN PARTE por 2026-09-02-verificacion-por-usuario-actual.sql, que
-- saca la elección del verificador: desde esa migración firma siempre el usuario
-- logueado que confirma. Esta sigue siendo la que crea las columnas, la FK y las
-- lecturas, así que hay que correrla igual y ANTES que aquella.
--
-- Lo que aquella reemplaza:
--   * /retrieveVerifierUsers          -> el front ya no lo llama (queda vivo)
--   * /verifyProductForSaleStoreOrder* -> /verifyProductForSaleStoreOrderV3
--   * manage_..._state_v5 (4 params)  -> v6 (3 params)
-- ###########################################################################
--
-- Objetivo: "Verificado" NO es un estado del pedido. Los estados del pedido son
-- la secuencia de siempre —Pendiente(11), En curso(12), Preparado(64),
-- Listo(13)— y no se toca ninguno. Verificado es una MARCA DE CONTROL paralela:
-- dos columnas nuevas que dicen QUIÉN revisó el pedido y CUÁNDO. Un pedido puede
-- estar Preparado y verificado, Preparado y sin verificar, o Listo y verificado;
-- lo que NO puede es llegar a Listo sin verificar.
--
-- Se marca por dos caminos:
--
--   a) OBLIGATORIO al pasar a Listo(13), venga de Pendiente(11), En curso(12) o
--      Preparado(64). El procedure lo exige: sin verificador la transición falla.
--      Este camino NO mira capacidades —el pedido lo cierra quien lo preparó y no
--      se le va a pedir un permiso extra para eso—; lo único que se le pide es
--      elegir de la lista quién verificó.
--
--   b) OPCIONAL desde Preparado(64), con el botón "Verificar". Ese botón sí está
--      restringido por la capacidad orders.verify (PASO 7). Adelantar la
--      verificación deja el pedido listo para que cualquiera lo cierre después
--      sin que se le vuelva a preguntar.
--
-- El verificador NO es el usuario logueado: es un usuario que se ELIGE de una
-- lista. Quien opera el tablero en bodega suele ser una máquina compartida, así
-- que la firma tiene que ser explícita. La lista son los usuarios ACTIVOS con rol
-- Sistema(1), Bodega(7) o Administrador(9).
--
-- Una vez marcado, el verificador NO se reemplaza: es un registro histórico. Por
-- eso el UPDATE del PASO 4 lleva "and verified_by_user_id is null", y el
-- procedure del PASO 5 ignora el parámetro cuando el pedido ya viene verificado
-- (es lo que hace que pasar un Preparado ya verificado a Listo no vuelva a pedir
-- usuario).
--
-- QUÉ NO CAMBIA:
--   * Ningún estado, ni de fábrica ni de tienda. No se inserta ningún status.
--   * El atajo de la tienda /confirmAndReceivePFSOrderV2 (Pendiente -> Entregado)
--     no pasa por Listo y NO pide verificación: lo ejecuta la tienda al recibir,
--     no bodega al despachar.
--   * manage_product_for_sale_order_state_v4 queda INTACTO; se agrega el v5.
--
-- ENFOQUE 100% ADITIVO:
--   * Dos columnas NULLABLES. Los pedidos anteriores quedan sin verificar y así
--     se quedan: no se rellena nada hacia atrás.
--   * Procedure nuevo (v5) y endpoints nuevos; los viejos siguen vivos.
--   * Las dos lecturas que necesitan los campos nuevos se clonan.
-- =============================================================================


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- 0.a Los ids de rol que van a poder verificar. Deben ser Sistema, Bodega y
--     Administrador; si en esta base tienen otros ids, corregirlos en los PASOS
--     3, 4 y 5 (aparecen como "in (1, 7, 9)" en los tres).
SELECT r.id, r."name" FROM "role" r WHERE r.id IN (1, 7, 9) ORDER BY r.id;

-- 0.b El id del status "Activo" de usuario: es el 2. Si acá sale otro número,
--     corregirlo en los PASOS 3, 4 y 5, donde aparece como "status_id = 2".
--
--     OJO con dos ids que NO son "activo" aunque lo parezcan: /registerUser da de
--     alta con status_id = 6 y /deleteUser marca con 8. El 6 es el estado con el
--     que queda un usuario auto-registrado, todavía sin habilitar.
SELECT s.id, s."name" FROM status s WHERE s.id IN (1, 2, 3, 6, 7, 8) ORDER BY s.id;

-- 0.c Cuántos usuarios va a traer el catálogo del PASO 3. Si da 0, el modal sale
--     vacío y no se puede verificar nada: revisar 0.a y 0.b antes de seguir.
SELECT COUNT(*) AS verificadores
FROM "user" u
WHERE u.role_id IN (1, 7, 9) AND u.status_id = 2;

-- 0.d Los usuarios con rol habilitado, repartidos por estado. Sirve para detectar
--     a alguien que debería poder verificar y quedó en otro estado (por ejemplo en
--     6, sin habilitar): esa persona NO va a aparecer en el catálogo.
SELECT u.status_id, s."name" AS estado, COUNT(*) AS usuarios
FROM "user" u
LEFT JOIN status s ON s.id = u.status_id
WHERE u.role_id IN (1, 7, 9)
GROUP BY u.status_id, s."name"
ORDER BY u.status_id;


-- #############################################################################
-- PASO 1 — Columnas de verificación
--
-- verified_by_user_id: quién verificó. Se guarda la FK y no el nombre —al revés
-- que operators— porque acá sí es un usuario del sistema, con id estable, y lo
-- que interesa es poder cruzarlo después con el resto de su actividad.
--
-- verified_date: cuándo. Queda NULL junto con la otra columna: las dos se
-- escriben en la misma sentencia y nunca por separado.
--
-- Los pedidos anteriores a esta migración quedan con las dos en NULL para
-- siempre. No se rellenan: nadie los verificó.
-- #############################################################################

ALTER TABLE public.product_for_sale_store_order
    ADD COLUMN IF NOT EXISTS verified_by_user_id uuid NULL,
    ADD COLUMN IF NOT EXISTS verified_date timestamp NULL;


-- #############################################################################
-- PASO 2 — FK del verificador
--
-- En bloque porque ADD CONSTRAINT no tiene IF NOT EXISTS.
-- #############################################################################

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'pfsso_fk_verified_by_user_id'
          AND conrelid = 'public.product_for_sale_store_order'::regclass
    ) THEN
        ALTER TABLE public.product_for_sale_store_order
            ADD CONSTRAINT pfsso_fk_verified_by_user_id
            FOREIGN KEY (verified_by_user_id) REFERENCES "user"(id);
    END IF;
END $$;


-- #############################################################################
-- PASO 3 — Catálogo de verificadores
--
-- Usuarios ACTIVOS con rol Sistema(1), Bodega(7) o Administrador(9). Devuelve
-- solo id, nombre y correo: lo consume el modal de verificación, que no necesita
-- nada más.
--
-- El wrapper del body va vacío a propósito ({u: {}}), igual que en
-- /retrieveOperatorCustomers: el filtro está dentro de la query y el backend solo
-- concatena su WHERE cuando el body trae llaves.
--
-- El correo va porque en bodega hay homónimos y el nombre suelto no siempre
-- alcanza para saber a quién se está firmando.
--
-- NOTA: desde 2026-09-02-verificacion-por-usuario-actual.sql el front ya no llama
-- a este endpoint. Se deja vivo por si hiciera falta volver atrás.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/retrieveVerifierUsers';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveVerifierUsers','/retrieveVerifierUsers','SELECT json_agg(
    json_build_object(
        ''id'', u.id,
        ''name'', u.username,
        ''email'', u.email
    ) ORDER BY u.username ASC
) as json_result
FROM "user" u
WHERE u.role_id in (1, 7, 9)
  AND u.status_id = 2','user','POST');


-- #############################################################################
-- PASO 4 — Verificar un pedido Preparado(64)
--
-- UPDATE puro: no toca estados ni inventario, solo firma el pedido. Es el camino
-- (b), el del botón "Verificar" del tablero.
--
-- Tres guards, y los tres importan:
--   * factory_status_id = 64  -> solo desde Preparado. Antes de Preparado no hay
--     nada que verificar, y de Listo en adelante ya se verificó por el camino (a).
--   * verified_by_user_id is null -> la firma no se reemplaza. Un doble clic o
--     dos personas a la vez no reescriben quién verificó.
--   * exists(...) -> el verificador elegido sigue siendo un usuario activo con un
--     rol habilitado. El front ya filtra la lista; esto evita que un id armado a
--     mano firme el pedido.
--
-- No se valida quién EJECUTA la acción: eso lo gobierna la capacidad
-- orders.verify en el front (PASO 7), igual que con los permisos de inventario.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/verifyProductForSaleStoreOrderPrepared';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('verifyProductForSaleStoreOrderPrepared','/verifyProductForSaleStoreOrderPrepared','update product_for_sale_store_order
set verified_by_user_id = $2::uuid,
    verified_date = timezone(''UTC''::text, CURRENT_TIMESTAMP),
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1::uuid
  and factory_status_id = 64
  and verified_by_user_id is null
  and exists (select 1 from "user" u
               where u.id = $2::uuid
                 and u.role_id in (1, 7, 9)
                 and u.status_id = 2)','product_for_sale_store_order','PATCH');


-- #############################################################################
-- PASO 5 — manage_product_for_sale_order_state_v5
--
-- Clon EXACTO del v4 con un parámetro nuevo, _verified_by_user_id, y un bloque
-- nuevo dentro de la rama Listo(13). Todo lo demás —el movimiento de inventario,
-- las ramas Entregado(16) y Devuelto(18), la validación del encargado y el
-- relleno de encargado/start_date cuando el pedido viene de Pendiente(11)— queda
-- igual, coma por coma.
--
-- El bloque nuevo es el camino (a), el obligatorio:
--
--   pedido YA verificado  -> el parámetro se IGNORA. Es lo que hace que un
--                            Preparado que ya se verificó con el botón pase a
--                            Listo sin volver a pedir usuario, y también lo que
--                            impide reescribir la firma por esta puerta.
--   pedido SIN verificar  -> el parámetro es OBLIGATORIO y se valida contra la
--                            misma condición que el catálogo del PASO 3.
--
-- Las ramas Entregado(16) y Devuelto(18) no miran el parámetro: llaman igual y
-- pasan NULL. La firma que tenga el pedido se conserva por el COALESCE del UPDATE
-- final.
-- #############################################################################

CREATE OR REPLACE PROCEDURE public.manage_product_for_sale_order_state_v5(IN _order_id uuid, IN _new_factory_status_id integer, IN _creator_user_id uuid, IN _verified_by_user_id uuid)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    _current_factory_status_id INT;
    _current_establishment_id uuid;
    _current_assigned_user_id uuid;
    _current_verified_by_user_id uuid;
    _actor_role_id INT;
    _verifier_role_id INT;
    _verifier_status_id INT;
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

            -- NUEVO v5: la verificación es obligatoria para llegar a Listo. Si el
            -- pedido ya viene verificado (botón "Verificar" desde Preparado) el
            -- parámetro se ignora y la firma original se conserva.
            IF _current_verified_by_user_id IS NULL THEN

                IF _verified_by_user_id IS NULL THEN
                    RAISE EXCEPTION 'Se requiere seleccionar el usuario que verificó el pedido para marcarlo como Listo';
                END IF;

                SELECT role_id, status_id INTO _verifier_role_id, _verifier_status_id
                FROM "user" WHERE id = _verified_by_user_id;

                IF _verifier_role_id IS NULL THEN
                    RAISE EXCEPTION 'El usuario que verificó el pedido no existe';
                END IF;

                IF _verifier_role_id NOT IN (1, 7, 9) OR COALESCE(_verifier_status_id, 0) <> 2 THEN
                    RAISE EXCEPTION 'El usuario que verificó el pedido debe estar activo y tener rol de bodega, sistema o administrador';
                END IF;

                _new_verified_by_user_id := _verified_by_user_id;
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
        RAISE EXCEPTION 'Error en manage_product_for_sale_order_state_v5: %', SQLERRM;

END;
$procedure$
;


-- El $4 llega como texto: el front manda cadena vacía cuando el pedido ya está
-- verificado (y siempre, en las transiciones a Entregado y Devuelto, que no lo
-- usan). nullif() lo convierte en el NULL que espera el procedure.
DELETE FROM public.sql_queries WHERE "path" = '/manageProductForSaleStoreOrderV5';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('manageProductForSaleStoreOrderV5','/manageProductForSaleStoreOrderV5','call manage_product_for_sale_order_state_v5($1::uuid, $2, $3::uuid, nullif($4, '''')::uuid)','product_for_sale_store_order','PATCH');


-- #############################################################################
-- PASO 6 — Lecturas con la verificación
--
-- Derivadas con replace() de la fila viva, igual que las migraciones anteriores.
-- El ancla vuelve a ser "'readyDate', pfsso.ready_date," —aparece una sola vez en
-- las dos queries— porque la verificación se lee junto al resto del ciclo de vida
-- del pedido.
--
-- El verificador entra como SUBCONSULTA y no como LEFT JOIN a propósito: así el
-- replace() es uno solo y no hay que tocar además el FROM de cada query, que es
-- distinto en cada una y no está versionado en este repo. Con la FK y un solo
-- pedido por fila, el costo es el mismo.
-- #############################################################################

-- 6.a Listado del tablero: la tarjeta muestra si el pedido ya está verificado.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'listProductForSaleStoreOrderBoardV5','/listProductForSaleStoreOrderBoardV5',
       replace(consulta_sql,
           '''readyDate'', pfsso.ready_date,',
           '''readyDate'', pfsso.ready_date,
        ''verifiedDate'', pfsso.verified_date,
        ''verifiedUser'', (select json_build_object(''name'', uv.username, ''email'', uv.email, ''id'', uv.id)
                             from "user" uv where uv.id = pfsso.verified_by_user_id),'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/listProductForSaleStoreOrderBoardV4'
  AND consulta_sql LIKE '%''readyDate'', pfsso.ready_date,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/listProductForSaleStoreOrderBoardV5');

-- 6.b Detalle: el panel lateral muestra quién verificó y cuándo.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getProductForSaleStoreOrderV6','/getProductForSaleStoreOrderV6',
       replace(consulta_sql,
           '''readyDate'', pfsso.ready_date,',
           '''readyDate'', pfsso.ready_date,
    ''verifiedDate'', pfsso.verified_date,
    ''verifiedUser'', (select json_build_object(''name'', uv.username, ''email'', uv.email, ''id'', uv.id)
                         from "user" uv where uv.id = pfsso.verified_by_user_id),'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getProductForSaleStoreOrderV5'
  AND consulta_sql LIKE '%''readyDate'', pfsso.ready_date,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderV6');


-- #############################################################################
-- PASO 7 — Capacidad orders.verify
--
-- Gobierna SOLO el botón "Verificar" de un pedido Preparado (camino b). El camino
-- obligatorio —elegir verificador al pasar a Listo— no mira esta capacidad: ahí
-- cualquiera que pueda cerrar el pedido puede firmarlo, que es justamente lo que
-- se pidió para no trabar el flujo de bodega.
--
-- El rol Sistema (id 1) NO necesita esto: AccountService.can() le devuelve true
-- antes de mirar paths.
--
-- Editar el id del rol al final. Idempotente: correrla dos veces deja una sola
-- entrada.
--
-- IMPORTANTE: paths viaja en el JWT, que se arma al hacer login. Este cambio NO
-- aplica hasta que el usuario vuelva a iniciar sesión.
--
-- Ver src/database/migrations/2026-08-14-capacidades-por-rol.sql para el
-- mecanismo completo de capacidades.
-- #############################################################################

UPDATE "role" r
SET paths = (
    COALESCE(r.paths::jsonb, '[]'::jsonb) || (
        SELECT COALESCE(jsonb_agg(nueva.entrada), '[]'::jsonb)
        FROM (VALUES
            ('orders.verify')
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
WHERE r.id = 0;  -- <<<<<< CAMBIAR por los ids de rol que verifican (ej. IN (7, 9)). Con 0 no afecta ninguna fila.


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- Columnas nuevas
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--  WHERE table_name = 'product_for_sale_store_order'
--    AND column_name IN ('verified_by_user_id','verified_date');
--
-- -- FK
-- SELECT conname FROM pg_constraint WHERE conname = 'pfsso_fk_verified_by_user_id';
--
-- -- Procedure y endpoints (debe dar 5 filas, veces = 1)
-- SELECT proname FROM pg_proc WHERE proname = 'manage_product_for_sale_order_state_v5';
-- SELECT "path", COUNT(*) AS veces FROM sql_queries
--  WHERE "path" IN ('/retrieveVerifierUsers','/verifyProductForSaleStoreOrderPrepared',
--                   '/manageProductForSaleStoreOrderV5','/listProductForSaleStoreOrderBoardV5',
--                   '/getProductForSaleStoreOrderV6')
--  GROUP BY "path" ORDER BY "path";
--
-- -- Los clones traen los campos nuevos y los originales siguen sin ellos
-- SELECT "path", consulta_sql LIKE '%verifiedUser%' AS trae_verificacion FROM sql_queries
--  WHERE "path" IN ('/listProductForSaleStoreOrderBoardV4','/listProductForSaleStoreOrderBoardV5',
--                   '/getProductForSaleStoreOrderV5','/getProductForSaleStoreOrderV6');
--
-- -- El catálogo devuelve algo
-- SELECT json_array_length((SELECT json_agg(json_build_object('id', u.id))
--   FROM "user" u WHERE u.role_id in (1,7,9) AND u.status_id = 2)) AS verificadores;
--
-- -- La capacidad quedó declarada en los roles esperados
-- SELECT r.id, r."name", p->>'name' AS capacidad
-- FROM "role" r, jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
-- WHERE p->>'matchPattern' = '^perm:orders\.verify$' ORDER BY r.id;
--
-- -- Tras verificar y cerrar pedidos: los dos caminos dejan la firma
-- SELECT order_number, factory_status_id, prepared_date, verified_date, ready_date,
--        (SELECT username FROM "user" u WHERE u.id = pfsso.verified_by_user_id) AS verifico
--   FROM product_for_sale_store_order pfsso
--  WHERE verified_date IS NOT NULL
--  ORDER BY verified_date DESC LIMIT 10;
--
-- -- Un pedido verificado en Preparado tiene verified_date ANTERIOR a ready_date;
-- -- uno verificado al cerrarlo los tiene iguales al segundo.
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve a los endpoints anteriores con revertir el commit; la base se
-- deja como estaba con:
--
-- DELETE FROM public.sql_queries WHERE "path" IN
--   ('/retrieveVerifierUsers','/verifyProductForSaleStoreOrderPrepared',
--    '/manageProductForSaleStoreOrderV5','/listProductForSaleStoreOrderBoardV5',
--    '/getProductForSaleStoreOrderV6');
-- DROP PROCEDURE IF EXISTS public.manage_product_for_sale_order_state_v5(uuid, integer, uuid, uuid);
--
-- UPDATE "role" r SET paths = (
--     SELECT COALESCE(jsonb_agg(p), '[]'::jsonb)
--     FROM jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
--     WHERE p->>'matchPattern' IS DISTINCT FROM '^perm:orders\.verify$'
-- )::text WHERE r.id = 0;  -- <<<<<< los mismos ids del PASO 7
--
-- Las columnas se pueden dejar: son NULLABLES y nada más las lee. Si igual se
-- quieren quitar, primero la FK:
-- ALTER TABLE public.product_for_sale_store_order
--     DROP CONSTRAINT IF EXISTS pfsso_fk_verified_by_user_id,
--     DROP COLUMN IF EXISTS verified_by_user_id,
--     DROP COLUMN IF EXISTS verified_date;
-- #############################################################################
