-- =============================================================================
-- Migración: operadores en los pedidos de producto para venta
-- Fecha: 2026-08-26
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- Objetivo: al tomar un pedido en el tablero (Pendiente(11) -> En curso(12)) se
-- registra QUIÉNES lo van a preparar. La lista se arma de dos fuentes:
--
--   1. Clientes del sistema marcados con el atributo nuevo "Operador".
--   2. Nombres escritos a mano.
--
-- POR QUÉ SE GUARDA COMO TEXTO Y NO COMO FK
-- La columna operators es un texto con los nombres separados por pipe:
--
--     'Juan Pérez|María López|Carlos'
--
-- Es una decisión deliberada, no una simplificación: evita tener que resolver
-- los nombres reales de los clientes en cada lectura de pedido (tablero,
-- listado, detalle y PDF). El efecto colateral es que si un cliente cambia de
-- nombre, los pedidos viejos conservan el nombre que tenía al momento de
-- prepararse — que es justo lo que se quiere, porque el pedido es un registro
-- histórico. Por lo mismo, un operador escrito a mano y uno elegido del
-- catálogo son indistinguibles una vez guardados.
--
-- DÓNDE SE PIDEN
-- Solo en el tablero, al pasar a En curso. La vista de detalle hace Pendiente
-- -> Listo directo (ver 2026-08-26-capacidad-orders-release.sql) y NO los pide:
-- esos pedidos nacen con operators en NULL. Para cubrirlos, la vista de detalle
-- tiene una acción "Editar operadores" que usa un endpoint aparte y no toca
-- estados ni inventario.
--
-- ENFOQUE 100% ADITIVO:
--   * Columnas nuevas: operators es NULLABLE; is_operator tiene DEFAULT false.
--   * NINGÚN procedure se toca. En particular
--     manage_product_for_sale_order_state_v3 queda INTACTO: los operadores no
--     participan de ninguna transición de estado ni de ningún movimiento de
--     inventario.
--   * Las queries que cambian se clonan a una versión nueva; las originales
--     siguen vivas.
--
-- Versiones que nacen acá:
--   /retrieveCustomers                    -> V2
--   /getCustomer                          -> V2
--   /addCustomer                          -> V2
--   /updateCustomer                       -> V2
--   /retrieveOperatorCustomers            -> nuevo
--   /startProductForSaleStoreOrder        -> V2
--   /releaseProductForSaleStoreOrder      -> V2
--   /updateProductForSaleStoreOrderOperators -> nuevo
--   /listProductForSaleStoreOrderV2       -> V3
--   /listProductForSaleStoreOrderBoardV2  -> V3
--   /getProductForSaleStoreOrderV3        -> V4
--   /getProductForSaleStoreOrderForPdfV2  -> V3
-- =============================================================================


-- #############################################################################
-- PASO 1 — Columnas nuevas
-- #############################################################################

-- 1.a Atributo "Operador" del cliente.
--     NOT NULL con DEFAULT false: todos los clientes existentes quedan en false,
--     que es el estado correcto (nadie es operador hasta que se lo marque).
ALTER TABLE public.customer
    ADD COLUMN IF NOT EXISTS is_operator boolean NOT NULL DEFAULT false;

-- Índice parcial: la única consulta que lo usa pide is_operator = true, y los
-- operadores van a ser una fracción chica de la tabla.
CREATE INDEX IF NOT EXISTS idx_customer_is_operator
    ON public.customer (is_operator) WHERE is_operator;

-- 1.b Operadores del pedido. NULL = pedido sin operadores registrados (los
--     anteriores a esta migración y los que se procesan desde la vista de
--     detalle). No se rellena hacia atrás.
ALTER TABLE public.product_for_sale_store_order
    ADD COLUMN IF NOT EXISTS operators text NULL;


-- #############################################################################
-- PASO 2 — Endpoints de cliente
--
-- Las dos lecturas se derivan con replace() de la fila VIVA en producción, no
-- de un texto pegado acá: así el clon arrastra cualquier cambio que la V1 tenga
-- y este archivo no pueda conocer.
--
-- El ancla es "'id', c.id,", la primera clave del objeto del cliente. Aparece
-- una sola vez en cada query: los otros "'id'," del json llevan alias s (status)
-- y u (user).
--
-- El guard NOT EXISTS las hace idempotentes; sql_queries no tiene unique en
-- "path" y una fila duplicada haría que el router resuelva de forma no
-- determinista.
-- #############################################################################

-- 2.a Listado de clientes.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'retrieveCustomersV2','/retrieveCustomersV2',
       replace(consulta_sql,
           '''id'', c.id,',
           '''id'', c.id,
        ''isOperator'', c.is_operator,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/retrieveCustomers'
  AND consulta_sql LIKE '%''id'', c.id,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/retrieveCustomersV2');

-- 2.b Detalle de cliente.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getCustomerV2','/getCustomerV2',
       replace(consulta_sql,
           '''id'', c.id,',
           '''id'', c.id,
        ''isOperator'', c.is_operator,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getCustomer'
  AND consulta_sql LIKE '%''id'', c.id,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/getCustomerV2');

-- 2.c Alta, edición y catálogo de operadores.
--
--     /retrieveOperatorCustomers devuelve SOLO id y nombre: lo consume el modal
--     del tablero, que no necesita nada más. El WHERE de primer nivel es seguro
--     porque el front lo llama con el wrapper vacío ({"c":{}}) y el backend solo
--     concatena su WHERE cuando el body trae llaves — mismo caso que
--     /retrieveFinishedProductInventoryV3, que ya funciona así en producción.
DELETE FROM public.sql_queries
 WHERE "path" IN ('/addCustomerV2','/updateCustomerV2','/retrieveOperatorCustomers');

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('addCustomerV2','/addCustomerV2','INSERT INTO customer ("name", phone, email, nit, is_operator, status_id, creator_user_id)
VALUES (
    $1::varchar(100),
    nullif($2, '''')::varchar(15),
    nullif($3, '''')::varchar(100),
    coalesce(nullif($4, ''''), ''C/F'')::varchar(15),
    coalesce($5::boolean, false),
    62,
    $6::uuid
)
RETURNING id','customer','PATCH'),
	 ('updateCustomerV2','/updateCustomerV2','UPDATE customer
SET "name" = $1::varchar(100),
    phone = nullif($2, '''')::varchar(15),
    email = nullif($3, '''')::varchar(100),
    nit = coalesce(nullif($4, ''''), ''C/F'')::varchar(15),
    is_operator = coalesce($5::boolean, false),
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
WHERE id = $6::uuid
RETURNING id','customer','PATCH'),
	 ('retrieveOperatorCustomers','/retrieveOperatorCustomers','SELECT json_agg(
    json_build_object(
        ''id'', c.id,
        ''name'', c."name"
    ) ORDER BY c."name" ASC
) as json_result
FROM customer c
WHERE c.is_operator = true
  AND c.status_id = 62','customer','POST');


-- #############################################################################
-- PASO 3 — Endpoints de escritura del pedido
-- #############################################################################

DELETE FROM public.sql_queries
 WHERE "path" IN ('/startProductForSaleStoreOrderV2',
                  '/releaseProductForSaleStoreOrderV2',
                  '/updateProductForSaleStoreOrderOperators');

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES

-- 3.a Pendiente(11) -> En curso(12) con operadores. Clon del original más $3.
--     Se conserva el guard "and factory_status_id = 11": evita que dos personas
--     tomen el mismo pedido a la vez, la segunda llamada afecta 0 filas.
--     nullif deja NULL cuando llega la cadena vacía. El tablero NO permite tomar
--     un pedido sin operadores —el botón Guardar queda deshabilitado—, pero la
--     restricción es de pantalla y no de la base: la columna sigue siendo
--     NULLABLE porque los pedidos que se marcan Listo desde la vista de detalle
--     nunca pasan por acá y nacen sin operadores.
	 ('startProductForSaleStoreOrderV2','/startProductForSaleStoreOrderV2','update product_for_sale_store_order
set factory_status_id = 12,
    assigned_user_id = $2::uuid,
    operators = nullif($3, ''''),
    start_date = timezone(''UTC''::text, CURRENT_TIMESTAMP),
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1::uuid
  and factory_status_id = 11','product_for_sale_store_order','PATCH'),

-- 3.b En curso(12) -> Pendiente(11). Clon del original más la limpieza de
--     operators: liberar ya borra encargado y hora de inicio, así que dejar los
--     operadores de la persona que soltó el pedido sería inconsistente. Se
--     vuelven a pedir cuando alguien lo tome de nuevo.
--     El guard de encargado/admin del original NO se toca: la capacidad
--     orders.release gobierna el botón, no la operación.
	 ('releaseProductForSaleStoreOrderV2','/releaseProductForSaleStoreOrderV2','update product_for_sale_store_order
set factory_status_id = 11,
    assigned_user_id = null,
    operators = null,
    start_date = null,
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1::uuid
  and factory_status_id = 12
  and (assigned_user_id = $2::uuid
       or assigned_user_id is null
       or exists (select 1 from "user" u where u.id = $2::uuid and u.role_id = 1))','product_for_sale_store_order','PATCH'),

-- 3.c Editar los operadores sin mover el pedido. Es lo que permite ponerle
--     operadores a un pedido procesado desde la vista de detalle, que nunca
--     pasó por En curso.
--     El guard excluye Eliminado(10) y Cancelado(15): un pedido muerto no se
--     edita. El resto de estados sí, incluido Entregado: corregir quién preparó
--     un pedido ya recibido es un caso real y no afecta inventario.
	 ('updateProductForSaleStoreOrderOperators','/updateProductForSaleStoreOrderOperators','update product_for_sale_store_order
set operators = nullif($2, ''''),
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1::uuid
  and factory_status_id not in (10, 15)','product_for_sale_store_order','PATCH');


-- #############################################################################
-- PASO 4 — Lecturas del pedido
--
-- Las cuatro se derivan con replace() de la fila viva, igual que en
-- 2026-08-18-add-pfs-store-order-number.sql. El ancla es "'id', pfsso.id,", la
-- primera clave de cada query; aparece una sola vez en las cuatro porque el
-- alias de los elementos del pedido es pfssoe, que no coincide.
--
-- La indentación del texto insertado sigue la de cada query para que la fila
-- quede legible al inspeccionarla en la base.
-- #############################################################################

-- 4.a Listado de pedidos (tablas de tienda y de fábrica).
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'listProductForSaleStoreOrderV3','/listProductForSaleStoreOrderV3',
       replace(consulta_sql,
           '''id'', pfsso.id,',
           '''id'', pfsso.id,
        ''operators'', pfsso.operators,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/listProductForSaleStoreOrderV2'
  AND consulta_sql LIKE '%''id'', pfsso.id,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/listProductForSaleStoreOrderV3');

-- 4.b Listado del tablero de bodega.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'listProductForSaleStoreOrderBoardV3','/listProductForSaleStoreOrderBoardV3',
       replace(consulta_sql,
           '''id'', pfsso.id,',
           '''id'', pfsso.id,
        ''operators'', pfsso.operators,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/listProductForSaleStoreOrderBoardV2'
  AND consulta_sql LIKE '%''id'', pfsso.id,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/listProductForSaleStoreOrderBoardV3');

-- 4.c Detalle del pedido (vista Ver pedido).
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getProductForSaleStoreOrderV4','/getProductForSaleStoreOrderV4',
       replace(consulta_sql,
           '''id'', pfsso.id,',
           '''id'', pfsso.id,
    ''operators'', pfsso.operators,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getProductForSaleStoreOrderV3'
  AND consulta_sql LIKE '%''id'', pfsso.id,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderV4');

-- 4.d Detalle reducido para el PDF.
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type")
SELECT 'getProductForSaleStoreOrderForPdfV3','/getProductForSaleStoreOrderForPdfV3',
       replace(consulta_sql,
           '''id'', pfsso.id,',
           '''id'', pfsso.id,
    ''operators'', pfsso.operators,'),
       principal_table, "type"
FROM public.sql_queries
WHERE "path" = '/getProductForSaleStoreOrderForPdfV2'
  AND consulta_sql LIKE '%''id'', pfsso.id,%'
  AND NOT EXISTS (SELECT 1 FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderForPdfV3');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- Columnas nuevas
-- SELECT table_name, column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE (table_name = 'customer' AND column_name = 'is_operator')
--     OR (table_name = 'product_for_sale_store_order' AND column_name = 'operators');
--
-- -- Los 12 endpoints existen y ninguno está duplicado (debe dar 12 filas, veces = 1)
-- SELECT "path", COUNT(*) AS veces FROM public.sql_queries
--  WHERE "path" IN ('/retrieveCustomersV2','/getCustomerV2','/addCustomerV2','/updateCustomerV2',
--                   '/retrieveOperatorCustomers','/startProductForSaleStoreOrderV2',
--                   '/releaseProductForSaleStoreOrderV2','/updateProductForSaleStoreOrderOperators',
--                   '/listProductForSaleStoreOrderV3','/listProductForSaleStoreOrderBoardV3',
--                   '/getProductForSaleStoreOrderV4','/getProductForSaleStoreOrderForPdfV3')
--  GROUP BY "path" ORDER BY "path";
--
-- -- Los clones traen el campo nuevo y los originales siguen sin él
-- SELECT "path", consulta_sql LIKE '%operators%' AS trae_operadores FROM public.sql_queries
--  WHERE "path" IN ('/getProductForSaleStoreOrderV3','/getProductForSaleStoreOrderV4',
--                   '/listProductForSaleStoreOrderBoardV2','/listProductForSaleStoreOrderBoardV3');
--
-- SELECT "path", consulta_sql LIKE '%isOperator%' AS trae_atributo FROM public.sql_queries
--  WHERE "path" IN ('/retrieveCustomers','/retrieveCustomersV2','/getCustomer','/getCustomerV2');
--
-- -- Marcar un cliente como operador y comprobar el catálogo
-- -- UPDATE customer SET is_operator = true WHERE "name" = '<nombre>';
-- SELECT id, "name", is_operator FROM customer WHERE is_operator ORDER BY "name";
--
-- -- Tras tomar un pedido en el tablero
-- SELECT order_number, factory_status_id, assigned_user_id, start_date, operators
--   FROM product_for_sale_store_order
--  WHERE operators IS NOT NULL ORDER BY start_date DESC LIMIT 5;
-- #############################################################################
