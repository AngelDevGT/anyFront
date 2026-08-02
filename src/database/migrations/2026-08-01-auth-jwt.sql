-- =====================================================================================
-- Autenticacion JWT real + retiro de los endpoints de usuario que no manejan credenciales
--
-- Contexto: hasta ahora el login vivia en el backend Mongo (anyFunction) y el backend V3
-- aceptaba cualquier peticion anonima. Con este cambio Postgres pasa a ser la unica fuente
-- de credenciales y V3 exige un JWT valido.
--
-- ORDEN DE APLICACION EN PRODUCCION (importante):
--   1. Correr scripts/migrate-passwords (any_func_sql) para copiar los hashes desde Mongo.
--      Sin esto, 25 de los 27 usuarios quedan sin poder iniciar sesion.
--   2. Aplicar este script.
--   3. Desplegar any_func_sql y anyFront.
--
-- Es idempotente: se puede correr mas de una vez.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. Refresh tokens
-- -------------------------------------------------------------------------------------
-- Se guarda el hash del token, nunca el token en claro: si alguien lee la tabla no puede
-- suplantar sesiones. revoked_at permite cerrar sesion de verdad y rotar en cada uso.

CREATE TABLE IF NOT EXISTS public.refresh_token (
    id          uuid        DEFAULT gen_random_uuid() NOT NULL,
    user_id     uuid        NOT NULL,
    token_hash  varchar(255) NOT NULL,
    expires_at  timestamp   NOT NULL,
    revoked_at  timestamp   NULL,
    created_at  timestamp   DEFAULT timezone('UTC'::text, CURRENT_TIMESTAMP) NOT NULL,
    CONSTRAINT refresh_token_pkey PRIMARY KEY (id),
    CONSTRAINT refresh_token_fk_user_id FOREIGN KEY (user_id) REFERENCES "user"(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS refresh_token_token_hash_idx ON public.refresh_token (token_hash);
CREATE INDEX IF NOT EXISTS refresh_token_user_id_idx ON public.refresh_token (user_id);

-- -------------------------------------------------------------------------------------
-- 2. /getUser deja de exponer el hash de la contrasena
-- -------------------------------------------------------------------------------------
-- Ese campo se filtraba a cualquiera que llamara el endpoint (que hasta ahora era anonimo)
-- y el frontend nunca lo uso.

UPDATE public.sql_queries
SET consulta_sql = 'select jsonb_build_object(
    ''id'', u.id,
    ''ext_id'', u.external_id,
    ''name'', u.username,
    ''email'', u.email,
    ''phone'', u.phone,
    ''creationDate'', u.creation_date,
    ''updatedDate'', coalesce(u.updated_date, u.creation_date),
    ''role'', jsonb_build_object(
        ''id'', r.id,
        ''identifier'', r.name,
        ''status'', r.status,
        ''paths'', paths::jsonb
    ),
    ''status'', jsonb_build_object(
        ''id'', s.id,
        ''identifier'', s.name,
        ''type'', s."type"
    )
) as json_result
from "user" u
left join "role" r on u.role_id = r.id
left join "status" s on u.status_id = s.id'
WHERE path = '/getUser' AND type = 'POST';

-- -------------------------------------------------------------------------------------
-- 3. Retirar los endpoints de alta/edicion de usuario
-- -------------------------------------------------------------------------------------
-- El gateway generico V3 no puede calcular el hash (necesita PASS_KEY, secreto del backend),
-- asi que estos endpoints solo sabian crear usuarios SIN contrasena: cuentas con las que es
-- imposible iniciar sesion. Los reemplazan las funciones TypeScript CreateUser, RegisterUser
-- y UpdateUser de any_func_sql. Se eliminan para que no queden como via alterna.
--
-- /deleteUser y /retrieveUsers se conservan: no tocan credenciales.

DELETE FROM public.sql_queries
WHERE path IN ('/createUser', '/registerUser', '/updateUser');

COMMIT;

-- =====================================================================================
-- ROLLBACK (ejecutar solo si hay que volver atras)
-- =====================================================================================
-- BEGIN;
--
-- DROP TABLE IF EXISTS public.refresh_token;
--
-- UPDATE public.sql_queries
-- SET consulta_sql = replace(consulta_sql, '''name'', u.username,', '''name'', u.username,
--     ''password'', u.password,')
-- WHERE path = '/getUser' AND type = 'POST';
--
-- INSERT INTO public.sql_queries (descripcion, "path", consulta_sql, principal_table, "type") VALUES
--  ('registerUser','/registerUser','INSERT INTO "user"
-- (external_id, username, status_id, email, role_id)
-- VALUES($1, $2, 6, $3, $4)','user','PATCH'),
--  ('createUser','/createUser','INSERT INTO "user"
-- (username, status_id, email, phone, role_id, external_id)
-- VALUES($1, $2, $3, $4, $5, $6)','user','PATCH'),
--  ('updateUser','/updateUser','update "user"
-- set username = $1, phone = $2, status_id = $3, role_id = $4
-- where id = $5::uuid','user','PATCH');
--
-- COMMIT;
