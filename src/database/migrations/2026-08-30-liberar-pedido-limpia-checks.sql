-- =============================================================================
-- Migración: liberar un pedido borra los productos marcados
-- Fecha: 2026-08-30
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- ###########################################################################
-- ORDEN: correr DESPUÉS de 2026-08-30-check-productos-pedido.sql, que es la
-- que crea la columna is_check. Sin ella el INSERT del PASO 1 entra igual pero
-- la query falla al ejecutarse.
-- ###########################################################################
--
-- Problema: /releaseProductForSaleStoreOrderV2 devuelve el pedido de En
-- curso(12) a Pendiente(11) y limpia todo lo que lo ataba a quien lo tenía
-- —encargado, operadores, hora de inicio—, pero no los productos marcados.
-- Un pedido liberado a medio alistar volvía al pool con los tildes puestos, y
-- quien lo tomara después se encontraba con media lista ya marcada por otro.
--
-- Liberar es soltar el pedido para que lo tome otra persona: el avance del
-- alistado es de quien lo estaba haciendo, no del pedido, así que se va con el
-- resto. Es la misma lógica por la que ya se borran los operadores.
--
-- QUÉ NO CAMBIA: /unprepareProductForSaleStoreOrder (Preparado -> En curso) NO
-- toca los checks, y es correcto. Ahí el pedido no cambia de manos —la misma
-- persona retrocede un paso para corregir algo— así que lo que ya alistó sigue
-- siendo suyo y sigue valiendo. Es la misma razón por la que ese endpoint
-- conserva encargado y operadores.
--
-- POR QUÉ UN CTE Y NO DOS SENTENCIAS
-- El Function App ejecuta UNA sentencia por fila de sql_queries. Con un CTE que
-- modifica datos, el UPDATE del pedido y el de sus elementos viajan juntos y son
-- atómicos, y —lo importante— el segundo depende del RETURNING del primero: si
-- los guards del release no se cumplen (el pedido no está En curso, o quien
-- llama no es el encargado), el CTE devuelve cero filas y los checks NO se
-- tocan. Sin ese acople se podrían borrar los tildes de un pedido que no se
-- llegó a liberar.
--
-- ENFOQUE 100% ADITIVO: fila NUEVA (V3). La V2 queda viva e intacta.
-- =============================================================================


-- #############################################################################
-- PASO 0 — REVISAR EL ESTADO ACTUAL
-- #############################################################################

-- 0.a La columna is_check tiene que existir. Si no sale la fila, correr antes
--     2026-08-30-check-productos-pedido.sql.
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'product_for_sale_store_order_element'
   AND column_name = 'is_check';

-- 0.b La V2 tiene que existir: la V3 es su clon. Si no sale, correr antes
--     2026-08-26-operadores-pedidos.sql.
SELECT "path", consulta_sql FROM public.sql_queries
 WHERE "path" = '/releaseProductForSaleStoreOrderV2';

-- 0.c Pedidos En curso con productos ya marcados. Son los que se verían
--     afectados si se liberaran después de esta migración. Informativo.
SELECT o.order_number,
       COUNT(*) FILTER (WHERE e.is_check) AS marcados,
       COUNT(*) AS total
  FROM product_for_sale_store_order o
  JOIN product_for_sale_store_order_element e ON e.pfsso_id = o.id
 WHERE o.factory_status_id = 12
 GROUP BY o.order_number
HAVING COUNT(*) FILTER (WHERE e.is_check) > 0
 ORDER BY o.order_number DESC;


-- #############################################################################
-- PASO 1 — /releaseProductForSaleStoreOrderV3
--
-- El CTE "liberado" es la V2 completa, coma por coma, más un RETURNING id. El
-- UPDATE externo limpia los checks de las filas que ese RETURNING devolvió.
--
-- El "and e.is_check" del final no es adorno: sin él la sentencia escribe en
-- todos los elementos del pedido aunque ninguno estuviera marcado, que es el
-- caso normal. Con él, un pedido sin tildes no genera escrituras.
--
-- El DELETE previo la hace idempotente: sql_queries no tiene unique en "path".
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/releaseProductForSaleStoreOrderV3';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('releaseProductForSaleStoreOrderV3','/releaseProductForSaleStoreOrderV3','with liberado as (
    update product_for_sale_store_order
    set factory_status_id = 11,
        assigned_user_id = null,
        operators = null,
        start_date = null,
        updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
    where id = $1::uuid
      and factory_status_id = 12
      and (assigned_user_id = $2::uuid
           or assigned_user_id is null
           or exists (select 1 from "user" u where u.id = $2::uuid and u.role_id = 1))
    returning id
)
update product_for_sale_store_order_element e
set is_check = false
from liberado l
where e.pfsso_id = l.id
  and e.is_check','product_for_sale_store_order','PATCH');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- -- La ruta nueva existe una sola vez
-- SELECT "path", COUNT(*) AS veces FROM sql_queries
--  WHERE "path" = '/releaseProductForSaleStoreOrderV3' GROUP BY "path";
--
-- -- La V3 limpia los checks y la V2 sigue sin hacerlo
-- SELECT "path", consulta_sql LIKE '%is_check%' AS limpia_checks FROM sql_queries
--  WHERE "path" IN ('/releaseProductForSaleStoreOrderV2','/releaseProductForSaleStoreOrderV3');
--
-- -- Prueba real:
-- --  1) Tomar un pedido en el tablero (Pendiente -> En curso).
-- --  2) Marcar dos o tres productos y guardar.
-- --  3) Comprobar que quedaron marcados:
-- --     SELECT e.id, e.is_check FROM product_for_sale_store_order_element e
-- --      WHERE e.pfsso_id = '<order_id>' ORDER BY e.id;
-- --  4) Devolver el pedido a PENDIENTE arrastrando la tarjeta.
-- --  5) Repetir la consulta: is_check debe ser false en TODOS, y el pedido debe
-- --     haber quedado sin encargado, sin operadores y sin start_date:
-- --     SELECT factory_status_id, assigned_user_id, operators, start_date
-- --       FROM product_for_sale_store_order WHERE id = '<order_id>';
--
-- -- El acople del CTE: llamar al endpoint con un $2 que NO sea el encargado ni
-- -- rol Sistema, sobre un pedido En curso con productos marcados. No debe
-- -- cambiar NADA: ni el estado del pedido ni los checks.
--
-- -- Retroceder de Preparado a En curso NO debe borrar nada: ese es otro
-- -- endpoint (/unprepareProductForSaleStoreOrder) y no se tocó.
-- #############################################################################


-- #############################################################################
-- ROLLBACK
-- #############################################################################
--
-- El front vuelve a la V2 con revertir el commit; la base se deja como estaba con:
--
-- DELETE FROM public.sql_queries WHERE "path" = '/releaseProductForSaleStoreOrderV3';
-- #############################################################################
