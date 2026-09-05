-- =============================================================================
-- Migración: capacidad orders.release
-- Fecha: 2026-08-26
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Contexto: la vista de detalle del pedido vuelve al flujo anterior, Pendiente
-- (11) -> Listo(13) con un solo botón. Se le quita "Tomar pedido": el paso por
-- En curso(12) queda como algo exclusivo del tablero.
--
-- Como la vista de detalle sigue recibiendo pedidos que el tablero puso En
-- curso (el tablero linkea a ella con "Ver detalle del pedido"), conserva el
-- botón "Liberar" para devolverlos a Pendiente. Esa acción pasa a estar
-- restringida por capacidad en vez de por encargado:
--
--     puede devolver a Pendiente = can('orders.release')     <- Sistema siempre
--                                || es el encargado del pedido
--
-- La misma regla se aplica en el tablero al arrastrar de En curso a Pendiente,
-- para que no haya una puerta trasera: si el botón se lo niega a alguien, el
-- arrastre también.
--
-- NO cambia nada en la base más que role.paths: no hay tablas, queries ni
-- procedures involucrados. El guard de /releaseProductForSaleStoreOrder queda
-- INTACTO (encargado, sin encargado, o role_id = 1). Igual que con los permisos
-- de inventario, la capacidad habilita el BOTÓN, no la operación.
--
-- Ver src/database/migrations/2026-08-14-capacidades-por-rol.sql para el
-- mecanismo completo de capacidades.
--
-- IMPORTANTE: paths viaja en el JWT, que se arma al hacer login. Este cambio NO
-- aplica hasta que el usuario vuelva a iniciar sesión.
-- =============================================================================


-- =============================================================================
-- PASO 0 -- REVISAR EL ESTADO ACTUAL
-- =============================================================================

-- 0.a Roles existentes, para identificar el id de Administrador.
SELECT r.id,
       r."name",
       jsonb_array_length(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS entradas
FROM "role" r
ORDER BY r.id;

-- 0.b Quién tiene hoy capacidades declaradas.
SELECT r.id,
       r."name",
       p->>'name' AS capacidad
FROM "role" r,
     jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
WHERE p->>'matchPattern' LIKE '^perm:%'
ORDER BY r.id, capacidad;

-- 0.c Respaldo de los paths actuales, por si hay que restaurar a mano.
SELECT r.id, r."name", r.paths
FROM "role" r
ORDER BY r.id;


-- =============================================================================
-- PASO 1 -- ASIGNAR orders.release
-- =============================================================================
--
-- El rol Sistema (id 1) NO necesita esto: AccountService.can() le devuelve true
-- antes de mirar paths.
--
-- Editar el id del rol al final. Idempotente: correrla dos veces deja una sola
-- entrada.

UPDATE "role" r
SET paths = (
    COALESCE(r.paths::jsonb, '[]'::jsonb) || (
        SELECT COALESCE(jsonb_agg(nueva.entrada), '[]'::jsonb)
        FROM (VALUES
            ('orders.release')
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
WHERE r.id = 0;  -- <<<<<< CAMBIAR por el id de Administrador. Con 0 no afecta ninguna fila.


-- =============================================================================
-- PASO 2 -- VERIFICAR
-- =============================================================================

-- 2.a La capacidad quedó declarada en el rol esperado.
SELECT r.id, r."name", p->>'name' AS capacidad
FROM "role" r,
     jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
WHERE p->>'matchPattern' = '^perm:orders\.release$'
ORDER BY r.id;

-- 2.b El regex quedó bien escrito. Debe dar: true, false.
SELECT 'perm:orders.release' ~ '^perm:orders\.release$'  AS capacidad_ok,
       'perm:orders.board.overrideOwner' ~ '^perm:orders\.release$' AS no_se_cruza;

-- 2.c Sin duplicados y sin rutas perdidas.
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

UPDATE "role" r
SET paths = (
    SELECT COALESCE(jsonb_agg(p), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(r.paths::jsonb, '[]'::jsonb)) AS p
    WHERE p->>'matchPattern' IS DISTINCT FROM '^perm:orders\.release$'
)::text
WHERE r.id = 0;  -- <<<<<< id del rol
