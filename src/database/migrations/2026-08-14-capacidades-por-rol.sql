-- =============================================================================
-- Migración: capacidades por rol ("perm:") dentro de role.paths
-- Fecha: 2026-08-14
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Objetivo: poder delegar a un rol distinto de Sistema las acciones que hoy
-- están fijas al role.id = 1 en el front (botones de inventario, costos,
-- edición de pedidos, mantenimiento de usuarios). Hasta hoy, habilitar una de
-- esas acciones a otro rol obligaba a tocar el código; a partir de acá es un
-- UPDATE en esta tabla.
--
-- CÓMO FUNCIONA
-- role.paths ya es un array JSON que viaja dentro del JWT y que el front
-- evalúa con regex, tanto en el guard de rutas (canActivateV2) como al armar
-- el menú lateral. Esta migración agrega al MISMO array entradas cuyo
-- matchPattern empieza con "perm:", por ejemplo:
--
--   {"name": "perm:cost.read",
--    "route": "perm:cost.read",
--    "matchPattern": "^perm:cost\\.read$"}
--
-- Como toda ruta de la app empieza con "/" y toda capacidad con "perm:", los
-- dos tipos de entrada nunca se cruzan:
--   - el guard testea contra la URL      -> las entradas "perm:" nunca matchean
--   - AccountService.can() testea contra "perm:<capacidad>" -> las rutas nunca matchean
--
-- Enfoque 100% aditivo: NO crea ni modifica tablas, queries ni procedures.
-- Solo agrega elementos al array de la columna paths de roles ya existentes.
-- No se agregan filas a "role" (eso sería crear un rol nuevo).
--
-- EL ROL SISTEMA NO SE TOCA: AccountService.can() devuelve true para role.id = 1
-- antes de mirar paths, así que conserva todo sin declarar nada.
--
-- IMPORTANTE: paths viaja en el JWT, que se arma al hacer login. Un cambio acá
-- NO aplica hasta que el usuario vuelva a iniciar sesión.
--
-- ORDEN DE EJECUCIÓN:
--   PASO 0 -> Revisar el estado actual de los roles (obligatorio)
--   PASO 1 -> Catálogo de capacidades (referencia, no ejecuta nada)
--   PASO 2 -> Asignar capacidades a un rol
--   PASO 3 -> Verificar el resultado
--   PASO 4 -> Rollback, si hace falta
-- =============================================================================


-- =============================================================================
-- PASO 0 -- REVISAR EL ESTADO ACTUAL  (ejecutar SIEMPRE antes del PASO 2)
-- =============================================================================

-- 0.a Roles existentes y cuántas entradas tiene cada uno.
SELECT r.id,
       r."name",
       jsonb_array_length(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS entradas
FROM "role" r
ORDER BY r.id;

-- 0.b CRÍTICO: confirmar que ningún matchPattern es demasiado abierto.
--     Todo patrón debe empezar con "^/". Si esta consulta devuelve filas,
--     DETENERSE: un patrón comodín le daría TODAS las capacidades a ese rol.
SELECT r.id,
       r."name",
       p->>'matchPattern' AS patron_sospechoso
FROM "role" r,
     jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
WHERE p->>'matchPattern' IS NULL
   OR p->>'matchPattern' NOT LIKE '^/%';

-- 0.c Respaldo de los paths actuales, por si hay que restaurar a mano.
--     Guardar la salida de esta consulta antes de continuar.
SELECT r.id, r."name", r.paths
FROM "role" r
ORDER BY r.id;


-- =============================================================================
-- PASO 1 -- CATÁLOGO DE CAPACIDADES  (referencia; no ejecuta nada)
-- =============================================================================
--
-- Cada capacidad corresponde a un gate que hoy está fijo a role.id = 1.
-- El nombre debe coincidir EXACTAMENTE con la constante en el front
-- (CAPABILITIES, en src/app/services/account.service.ts).
--
-- INVENTARIOS -- habilitan los botones de agregar / quitar de cada pantalla.
--   inventory.store.write
--       Inventario de producto para venta de tienda (/store/inventory/:id).
--       Habilita Agregar, Eliminar y Devolver a bodega.
--   inventory.factory.finishedProduct.write
--       Inventario de productos de fábrica (/inventory/factory/finishedProduct).
--   inventory.factory.abarrote.write
--       Inventario de abarrotes (/inventory/factory/abarrote).
--       Es la MISMA pantalla que la anterior con productType = 2; por eso son
--       dos capacidades separadas y no una sola.
--   inventory.factory.rawMaterial.write
--       Inventario de materia prima de fábrica (/inventory/factory/rawMaterial).
--   inventory.factory.packagingMaterial.write
--       Inventario de material de empaque (/inventory/warehouse/packagingMaterial).
--       Misma pantalla que la anterior con materialType = 2.
--   inventory.bodega.write
--       Inventario de materia prima por proveedor en bodega
--       (/inventory/warehouse/rawMaterialByProvider). Habilita Agregar y
--       Eliminar. OJO: el botón "Mover" NO depende de esta capacidad, hoy lo
--       tienen todos los roles y se deja igual.
--
-- COSTOS -- el costo es información sensible; hoy solo lo ve el rol Sistema.
--   cost.read
--       Muestra la columna/campo Costo en el listado y el detalle de productos
--       para venta y en el inventario de tienda. Además define QUÉ ENDPOINT se
--       pide: con la capacidad se llama la versión que trae el costo
--       (retrieveProductForSaleInventoryV3, getAllProductForSaleByFilterV4);
--       sin ella, la versión que no lo trae. El costo no viaja al navegador
--       de quien no tiene el permiso.
--   cost.write
--       Botón "Editar costo", pantalla /productsForSale/cost/edit/:id y el
--       diálogo de carga masiva de costos.
--       Requiere cost.read para ser útil: la pantalla muestra el valor actual.
--
-- PEDIDOS
--   orders.editAfterPending
--       Editar un pedido que ya salió del estado Pendiente. Sin esto, un pedido
--       solo se puede editar mientras está Pendiente.
--       El rol Ventas (id 3) ya tiene este permiso hoy por código; hay que
--       declarárselo acá para no perderlo (ver PASO 2, ejemplo B).
--   orders.viewProperties
--       Campos extra del formulario de alta/edición de pedido.
--       Mismo caso que el anterior: hoy lo tiene el rol Ventas por código.
--   orders.board.overrideOwner
--       En el tablero de pedidos de bodega, mover tarjetas que tienen a otra
--       persona como encargada. Sin esto, solo el encargado puede liberar su
--       pedido o marcarlo como Listo.
--
-- USUARIOS
--   users.manage
--       Botones Editar y Eliminar en la ficha de usuario (/users/view/:id).
--       NO alcanza para asignar el rol Sistema: eso sigue siendo exclusivo del
--       rol Sistema y no es delegable por diseño (si lo fuera, un rol con
--       users.manage podría auto-promoverse).
--
-- TIENDAS
--   establishments.viewAll
--       Ver todas las tiendas sin necesidad de estar asignado por correo en
--       establishment.description. Es lo que hoy hace el rol Sistema.
--
-- =============================================================================


-- =============================================================================
-- PASO 2 -- ASIGNAR CAPACIDADES A UN ROL
-- =============================================================================
--
-- Editar DOS cosas antes de ejecutar:
--   1. el id del rol, al final (WHERE r.id = ...)
--   2. la lista de capacidades del bloque VALUES: dejar solo las que
--      correspondan, comentando o borrando el resto.
--
-- La sentencia es IDEMPOTENTE: se puede correr varias veces y cada capacidad
-- queda una sola vez. También se puede correr de nuevo más adelante para
-- sumar capacidades sin tocar las que ya tiene.
--
-- El matchPattern se construye solo: escapa los puntos y agrega las anclas.

UPDATE "role" r
SET paths = (
    COALESCE(r.paths::jsonb, '[]'::jsonb) || (
        SELECT COALESCE(jsonb_agg(nueva.entrada), '[]'::jsonb)
        FROM (VALUES
            -- ---- Inventarios -------------------------------------------------
              ('inventory.store.write')
            , ('inventory.factory.finishedProduct.write')
            , ('inventory.factory.abarrote.write')
            , ('inventory.factory.rawMaterial.write')
            , ('inventory.factory.packagingMaterial.write')
            , ('inventory.bodega.write')
            -- ---- Costos ------------------------------------------------------
            , ('cost.read')
            , ('cost.write')
            -- ---- Pedidos -----------------------------------------------------
            , ('orders.editAfterPending')
            , ('orders.viewProperties')
            , ('orders.board.overrideOwner')
            -- ---- Usuarios ----------------------------------------------------
            , ('users.manage')
            -- ---- Tiendas -----------------------------------------------------
            , ('establishments.viewAll')
        ) AS caps(cap)
        CROSS JOIN LATERAL (
            SELECT jsonb_build_object(
                'name',         'perm:' || caps.cap,
                'route',        'perm:' || caps.cap,
                'matchPattern', '^perm:' || replace(caps.cap, '.', '\.') || '$'
            ) AS entrada
        ) AS nueva
        -- Se compara solo por matchPattern: si alguien retocó "name" a mano,
        -- igual se detecta que la capacidad ya existe y no se duplica.
        WHERE NOT COALESCE(r.paths::jsonb, '[]'::jsonb) @> jsonb_build_array(
            jsonb_build_object('matchPattern', nueva.entrada->>'matchPattern')
        )
    )
)::text
WHERE r.id = 0;  -- <<<<<< CAMBIAR por el id del rol. Con 0 no afecta ninguna fila.


-- -----------------------------------------------------------------------------
-- EJEMPLOS DE USO
-- -----------------------------------------------------------------------------
--
-- EJEMPLO A -- Encargado de bodega: mueve inventario de fábrica y bodega,
--              opera el tablero de pedidos, no ve costos.
--   Capacidades: inventory.factory.finishedProduct.write,
--                inventory.factory.abarrote.write,
--                inventory.factory.rawMaterial.write,
--                inventory.factory.packagingMaterial.write,
--                inventory.bodega.write,
--                orders.board.overrideOwner
--
-- EJEMPLO B -- Rol Ventas (id 3): DECLARAR LO QUE YA TIENE POR CÓDIGO.
--   El front hoy pregunta isSalesUser() en dos lugares. Al reemplazar esos
--   gates por capacidades, el rol Ventas PIERDE esas acciones si no se le
--   declaran acá. Correr este UPDATE ANTES de desplegar el front nuevo:
--
--       Capacidades: orders.editAfterPending, orders.viewProperties
--       WHERE r.id = 3
--
-- EJEMPLO C -- Encargado de tienda: mueve el inventario de su tienda y ve
--              costos, pero no los edita.
--   Capacidades: inventory.store.write, cost.read
--
-- RECORDATORIO: la capacidad habilita los BOTONES, no el acceso a la pantalla.
-- Si el rol todavía no puede entrar a la página, necesita además la entrada de
-- RUTA correspondiente en paths. Son dos perillas independientes:
--   {"name": "/store/inventory", "route": "/store/inventory",
--    "matchPattern": "^/store/inventory/[^/]*$"}     <- para ENTRAR
--   {"name": "perm:inventory.store.write", ...}       <- para OPERAR
-- Un rol con la ruta pero sin la capacidad ve la pantalla en solo lectura, que
-- es el comportamiento actual de todos los roles que no son Sistema.


-- =============================================================================
-- PASO 3 -- VERIFICAR
-- =============================================================================

-- 3.a Capacidades declaradas por rol.
SELECT r.id,
       r."name",
       p->>'name' AS capacidad
FROM "role" r,
     jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
WHERE p->>'matchPattern' LIKE '^perm:%'
ORDER BY r.id, capacidad;

-- 3.b Los regex quedaron bien escritos. Debe dar: true, true, false, false.
--     (los dos últimos confirman que capacidades y rutas no se cruzan)
SELECT 'perm:cost.read'      ~ '^perm:cost\.read$'          AS capacidad_ok,
       '/store/inventory/abc' ~ '^/store/inventory/[^/]*$'   AS ruta_ok,
       '/store/inventory/abc' ~ '^perm:cost\.read$'          AS ruta_no_da_permiso,
       'perm:cost.read'       ~ '^/store/inventory/[^/]*$'   AS permiso_no_da_ruta;

-- 3.c Ninguna capacidad duplicada.
SELECT r.id, p->>'matchPattern' AS patron, COUNT(*) AS veces
FROM "role" r,
     jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
WHERE p->>'matchPattern' LIKE '^perm:%'
GROUP BY r.id, p->>'matchPattern'
HAVING COUNT(*) > 1;

-- 3.d El JSON sigue siendo válido y no se perdieron rutas.
--     Comparar "rutas" contra el conteo del PASO 0.a.
SELECT r.id,
       r."name",
       COUNT(*) FILTER (WHERE p->>'matchPattern' LIKE '^/%')     AS rutas,
       COUNT(*) FILTER (WHERE p->>'matchPattern' LIKE '^perm:%') AS capacidades
FROM "role" r,
     jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
GROUP BY r.id, r."name"
ORDER BY r.id;


-- =============================================================================
-- PASO 4 -- ROLLBACK
-- =============================================================================

-- 4.a Quitar UNA capacidad a un rol.
UPDATE "role" r
SET paths = (
    SELECT COALESCE(jsonb_agg(p), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
    WHERE p->>'matchPattern' IS DISTINCT FROM '^perm:cost\.read$'
)::text
WHERE r.id = 0;  -- <<<<<< id del rol

-- 4.b Quitar TODAS las capacidades a un rol, dejando intactas las rutas.
UPDATE "role" r
SET paths = (
    SELECT COALESCE(jsonb_agg(p), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
    WHERE p->>'matchPattern' NOT LIKE '^perm:%'
)::text
WHERE r.id = 0;  -- <<<<<< id del rol

-- 4.c Revertir por completo: dejar el front anterior desplegado y correr 4.b
--     en todos los roles. Las entradas "perm:" son inertes para el guard, así
--     que aunque queden no rompen nada; solo dejan de tener efecto.
