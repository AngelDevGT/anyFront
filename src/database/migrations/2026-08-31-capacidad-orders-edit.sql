-- =============================================================================
-- Migración: capacidad orders.edit
-- Fecha: 2026-08-31
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Contexto: hoy CUALQUIER rol que entre al detalle de un pedido ve el botón
-- "Editar" mientras el pedido sigue Pendiente. La tienda crea el pedido y lo
-- puede seguir cambiando hasta que bodega lo marca Listo, sin que quede quién
-- lo modificó. Eso pasa a ser un permiso.
--
--     puede editar = can('orders.edit')                       <- Sistema siempre
--                    AND ( pedido Pendiente
--                          OR can('orders.editAfterPending') )
--
-- orders.edit es la llave base: sin ella no se edita en NINGÚN estado, y
-- orders.editAfterPending por sí sola deja de habilitar nada. Crear un pedido
-- NO pide capacidad: la tienda sigue creando como hasta ahora.
--
-- La capacidad tapa las dos puertas: el botón "Editar" del detalle y la
-- pantalla /productsForSale/order/edit/:id, que rebota al detalle si se entra
-- escribiendo la URL. El endpoint updateProductForSaleStoreOrder NO cambia; acá
-- no se toca ninguna tabla, query ni procedure, solo role.paths.
--
-- Ver src/database/migrations/2026-08-14-capacidades-por-rol.sql para el
-- mecanismo completo de capacidades.
--
-- CUÁNDO CORRERLA: ANTES de desplegar el front nuevo. Todo rol que hoy edite
-- pedidos pendientes y deba seguir haciéndolo necesita la capacidad declarada;
-- si no, al desplegar pierde el botón.
--
-- IMPORTANTE: paths viaja en el JWT, que se arma al hacer login. Este cambio NO
-- aplica hasta que el usuario vuelva a iniciar sesión.
-- =============================================================================


-- =============================================================================
-- PASO 0 -- REVISAR EL ESTADO ACTUAL
-- =============================================================================

-- 0.a Roles existentes, para identificar a quién darle la capacidad.
SELECT r.id,
       r."name",
       jsonb_array_length(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS entradas
FROM "role" r
ORDER BY r.id;

-- 0.b CRÍTICO: quién tiene hoy orders.editAfterPending. Esos roles editan
--     pedidos en cualquier estado; con el front nuevo dejan de editar si no se
--     les declara TAMBIÉN orders.edit. Son los candidatos obligados del PASO 1.
SELECT r.id,
       r."name",
       p->>'name' AS capacidad
FROM "role" r,
     jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
WHERE p->>'matchPattern' = '^perm:orders\.editAfterPending$'
ORDER BY r.id;

-- 0.c Capacidades declaradas por rol, para ver el panorama completo.
SELECT r.id,
       r."name",
       p->>'name' AS capacidad
FROM "role" r,
     jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
WHERE p->>'matchPattern' LIKE '^perm:%'
ORDER BY r.id, capacidad;

-- 0.d Respaldo de los paths actuales, por si hay que restaurar a mano.
SELECT r.id, r."name", r.paths
FROM "role" r
ORDER BY r.id;


-- =============================================================================
-- PASO 1 -- ASIGNAR orders.edit
-- =============================================================================
--
-- El rol Sistema (id 1) NO necesita esto: AccountService.can() le devuelve true
-- antes de mirar paths.
--
-- Editar el id del rol al final. Repetir la sentencia por cada rol que deba
-- conservar la edición (según el PASO 0.b) más los que se quieran habilitar.
-- Idempotente: correrla dos veces deja una sola entrada.

UPDATE "role" r
SET paths = (
    COALESCE(r.paths::jsonb, '[]'::jsonb) || (
        SELECT COALESCE(jsonb_agg(nueva.entrada), '[]'::jsonb)
        FROM (VALUES
            ('orders.edit')
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


-- -----------------------------------------------------------------------------
-- ATAJO -- dársela a todos los que ya tienen orders.editAfterPending
-- -----------------------------------------------------------------------------
-- Es el UPDATE de arriba, pero eligiendo los roles solos: los que hoy editan
-- pedidos fuera de Pendiente. Deja intactos a los demás, que son justamente los
-- que pierden la edición a propósito con este cambio.
--
-- Correrlo NO reemplaza al PASO 1: un rol que solo edita pedidos Pendientes (la
-- tienda, por ejemplo) no aparece acá y hay que declararlo a mano si debe
-- conservar el botón.

-- UPDATE "role" r
-- SET paths = (
--     COALESCE(r.paths::jsonb, '[]'::jsonb) || jsonb_build_array(
--         jsonb_build_object(
--             'name',         'perm:orders.edit',
--             'route',        'perm:orders.edit',
--             'matchPattern', '^perm:orders\.edit$'
--         )
--     )
-- )::text
-- WHERE COALESCE(r.paths::jsonb, '[]'::jsonb) @> jsonb_build_array(
--           jsonb_build_object('matchPattern', '^perm:orders\.editAfterPending$'))
--   AND NOT COALESCE(r.paths::jsonb, '[]'::jsonb) @> jsonb_build_array(
--           jsonb_build_object('matchPattern', '^perm:orders\.edit$'));


-- =============================================================================
-- PASO 2 -- VERIFICAR
-- =============================================================================

-- 2.a La capacidad quedó declarada en los roles esperados.
SELECT r.id, r."name", p->>'name' AS capacidad
FROM "role" r,
     jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
WHERE p->>'matchPattern' = '^perm:orders\.edit$'
ORDER BY r.id;

-- 2.b Ningún rol quedó con editAfterPending pero sin edit: esa combinación no
--     edita nada. Si devuelve filas, volver al PASO 1 con esos ids.
SELECT r.id, r."name"
FROM "role" r
WHERE COALESCE(r.paths::jsonb, '[]'::jsonb) @> jsonb_build_array(
          jsonb_build_object('matchPattern', '^perm:orders\.editAfterPending$'))
  AND NOT COALESCE(r.paths::jsonb, '[]'::jsonb) @> jsonb_build_array(
          jsonb_build_object('matchPattern', '^perm:orders\.edit$'));

-- 2.c Los regex quedaron bien escritos y no se pisan entre sí.
--     Debe dar: true, true, false, false.
SELECT 'perm:orders.edit' ~ '^perm:orders\.edit$'                          AS edit_ok,
       'perm:orders.editAfterPending' ~ '^perm:orders\.editAfterPending$'   AS after_ok,
       'perm:orders.editAfterPending' ~ '^perm:orders\.edit$'               AS after_no_da_edit,
       'perm:orders.edit' ~ '^perm:orders\.editAfterPending$'               AS edit_no_da_after;

-- 2.d Sin duplicados y sin rutas perdidas.
SELECT r.id,
       r."name",
       COUNT(*) FILTER (WHERE p->>'matchPattern' LIKE '^/%')     AS rutas,
       COUNT(*) FILTER (WHERE p->>'matchPattern' LIKE '^perm:%') AS capacidades
FROM "role" r,
     jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
GROUP BY r.id, r."name"
ORDER BY r.id;


-- =============================================================================
-- PASO 3 -- ROLLBACK
-- =============================================================================

-- 3.a Quitarle la capacidad a un rol.
UPDATE "role" r
SET paths = (
    SELECT COALESCE(jsonb_agg(p), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
    WHERE p->>'matchPattern' IS DISTINCT FROM '^perm:orders\.edit$'
)::text
WHERE r.id = 0;  -- <<<<<< id del rol

-- 3.b Revertir por completo: volver al front anterior. Las entradas
--     "perm:orders.edit" que queden son inertes para el front viejo, no hace
--     falta borrarlas.
