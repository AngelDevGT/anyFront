-- =============================================================================
-- Migración: bancos por tienda
-- Fecha: 2026-08-31
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Objetivo: cada tienda lleva un listado de los bancos con los que trabaja. Se
-- carga desde un modal propio en Sistema > Tiendas y se muestra en el detalle de
-- la tienda. No participa de ninguna otra pantalla ni de ningún cálculo.
--
-- POR QUÉ ES UNA COLUMNA DE TEXTO Y NO UNA TABLA
-- La columna banks es un texto con los nombres separados por SALTO DE LÍNEA:
--
--     'Banco Industrial
--      Banrural
--      G&T Continental'
--
-- Es una lista de etiquetas para leer, no un catálogo: nada la referencia, no se
-- filtra por ella y no hay un "banco" como entidad en el resto del sistema. Una
-- tabla aparte obligaría a un join en cada lectura de tienda para mostrar tres
-- palabras. El separador es \n —y no el pipe que usa
-- product_for_sale_store_order.operators— porque así el detalle de la tienda lo
-- imprime tal cual y ya se ve como listado.
--
-- El front recorta espacios al inicio y al final de cada nombre antes de guardar
-- (serializeBanks en src/app/helpers/banks.ts), así que el texto que llega acá no
-- trae líneas vacías ni sobrantes.
--
-- POR QUÉ UN ENDPOINT DE ESCRITURA APARTE
-- /updateEstablishment tiene un SET explícito que NO incluye banks, así que
-- editar una tienda por el formulario normal no puede borrarlos, y no hace falta
-- clonarlo. /updateEstablishmentBanks hace el camino inverso: toca banks y nada
-- más. Las dos escrituras conviven sin pisarse.
--
-- ENFOQUE 100% ADITIVO:
--   * Columna nueva: banks es NULLABLE, sin default. Las tiendas existentes
--     quedan en NULL, que es el estado correcto (ninguna tiene bancos hasta que
--     se los carguen).
--   * NINGÚN procedure se toca.
--   * La lectura que cambia se clona a una versión nueva; la original sigue viva.
--   * /retrieveEstablishments NO se toca: el listado no muestra los bancos. El
--     modal los pide con /getEstablishmentV2 al abrirse, que trae una sola fila.
--
-- Versiones que nacen acá:
--   /getEstablishment            -> V2
--   /updateEstablishmentBanks    -> nuevo
-- =============================================================================


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- 0.a La lectura original tiene que existir y traer el ancla del replace del
--     PASO 2. Si no sale la fila, no seguir: el clon no se crearía.
SELECT "path", consulta_sql LIKE '%''id'', e.id,%' AS tiene_ancla
  FROM public.sql_queries
 WHERE "path" = '/getEstablishment';

-- 0.b La columna no debería existir todavía (0 filas).
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'establishment' AND column_name = 'banks';


-- #############################################################################
-- PASO 1 — Columna nueva
-- #############################################################################

-- NULL = tienda sin bancos cargados. No se rellena hacia atrás: no hay un valor
-- por defecto razonable y el front trata NULL y cadena vacía igual.
ALTER TABLE public.establishment
    ADD COLUMN IF NOT EXISTS banks text NULL;


-- #############################################################################
-- PASO 2 — Lectura del detalle de tienda
--
-- Se deriva con replace() de la fila VIVA en producción, no de un texto pegado
-- acá: así el clon arrastra cualquier cambio que la V1 tenga y este archivo no
-- pueda conocer. Mismo patrón que 2026-08-26-operadores-pedidos.sql.
--
-- El ancla es "'id', e.id,", la primera clave del objeto de la tienda. Aparece
-- una sola vez: los otros "'id'," del json llevan alias s (status) y u (user).
--
-- El guard NOT EXISTS la hace idempotente; sql_queries no tiene unique en "path"
-- y una fila duplicada haría que el router resuelva de forma no determinista.
-- #############################################################################

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getEstablishmentV2','/getEstablishmentV2',
       replace(consulta_sql,
           '''id'', e.id,',
           '''id'', e.id,
    ''banks'', e.banks,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getEstablishment'
  AND consulta_sql LIKE '%''id'', e.id,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/getEstablishmentV2');


-- #############################################################################
-- PASO 3 — Escritura de los bancos
--
-- Toca banks y updated_date, nada más: el modal no edita ningún otro campo de la
-- tienda, así que no tiene por qué poder pisarlos.
--
-- nullif deja la columna en NULL cuando el usuario guarda sin ningún banco, que
-- es un caso permitido (quitarle todos los bancos a una tienda).
--
-- Sin guard de estado: a diferencia de un pedido, una tienda no tiene un momento
-- después del cual la lista sea un registro histórico. Una tienda eliminada no
-- aparece en el listado, así que el botón no existe para ella.
--
-- El DELETE previo la hace idempotente.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/updateEstablishmentBanks';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('updateEstablishmentBanks','/updateEstablishmentBanks','update establishment
set banks = nullif($1, ''''),
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $2::uuid','establishment','PATCH');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- Columna nueva
-- SELECT table_name, column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'establishment' AND column_name = 'banks';
--
-- -- Las dos rutas existen y ninguna está duplicada (debe dar 2 filas, veces = 1)
-- SELECT "path", COUNT(*) AS veces FROM public.sql_queries
--  WHERE "path" IN ('/getEstablishmentV2','/updateEstablishmentBanks')
--  GROUP BY "path" ORDER BY "path";
--
-- -- El clon trae el campo nuevo y el original sigue sin él
-- SELECT "path", consulta_sql LIKE '%banks%' AS trae_bancos FROM public.sql_queries
--  WHERE "path" IN ('/getEstablishment','/getEstablishmentV2');
--
-- -- El listado NO se tocó (debe dar false)
-- SELECT consulta_sql LIKE '%banks%' AS trae_bancos FROM public.sql_queries
--  WHERE "path" = '/retrieveEstablishments';
--
-- -- Prueba real. Tomar una tienda:
-- --   SELECT id, "name", banks FROM establishment ORDER BY creation_date LIMIT 5;
-- -- Llamar a /updateEstablishmentBanks con
-- --   {"$1": "Banco Industrial\nBanrural", "$2": "<id>"}
-- -- y leerla con /getEstablishmentV2 {"e": {"id": "<id>"}}: banks debe volver con
-- -- el salto de línea intacto.
-- --
-- -- Guardar la lista vacía deja la columna en NULL:
-- --   {"$1": "", "$2": "<id>"}
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve al /getEstablishment original con revertir el commit. La base
-- se deja como estaba con:
--
-- DELETE FROM public.sql_queries
--  WHERE "path" IN ('/getEstablishmentV2','/updateEstablishmentBanks');
--
-- La columna se puede dejar: es NULLABLE y nadie más la lee. Para sacarla —y
-- perder los bancos ya cargados—:
-- ALTER TABLE public.establishment DROP COLUMN IF EXISTS banks;
-- #############################################################################
