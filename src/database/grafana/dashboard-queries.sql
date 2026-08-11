-- =============================================================================
-- GRAFANA — Queries del dashboard (PostgreSQL)
-- Fecha: 2026-08-10
--
-- Cuatro consultas pensadas para paneles de tipo TABLA:
--   Q1  Resumen general del periodo (ventas, envios, sobrante, gastos, devoluciones)
--   Q2  Productos pedidos a fabrica, agrupados por producto
--   Q3  Productos vendidos en tienda, agrupados por producto
--   Q4  Clientes con saldo pendiente
--
-- Este archivo es SOLO LECTURA sobre la base: no crea ni modifica nada, no
-- toca `sql_queries` ni ninguna procedure. Se puede pegar tal cual en el editor
-- de cada panel de Grafana.
-- =============================================================================


-- #############################################################################
-- CONVENCIONES DEL MODELO (leer antes de tocar las queries)
-- #############################################################################
--
-- FECHAS
--   Todas las columnas de fecha son `timestamp` SIN zona horaria y guardan
--   hora UTC (`timezone('UTC', CURRENT_TIMESTAMP)`).
--   Por eso el filtro de tiempo se escribe siempre asi:
--       $__timeFilter(tabla.creation_date AT TIME ZONE 'UTC')
--   El `AT TIME ZONE 'UTC'` convierte la columna a timestamptz y hace que la
--   comparacion sea correcta sin importar la zona horaria del dashboard.
--   (Si se prefiere aprovechar indices y se fija el dashboard en UTC, se puede
--    usar `$__timeFilter(tabla.creation_date)` a secas.)
--
-- PRECIOS
--   `product_for_sale.price` y `product_for_sale.cost` estan expresados POR
--   UNIDAD BASE (Unidad o Libra), NO por medida de venta.
--       precio por docena  = price * 12
--       precio por cajilla = price * 240
--   Es la misma formula que usa el front:
--       currentMeasurePrice = pfs.price * measure.unitBase.quantity
--   `cost` nace igual a `price` (trigger product_for_sale_default_cost) y a
--   partir de ahi son independientes.
--
-- CANTIDADES
--   En las tablas de detalle (`shop_sale_element`,
--   `product_for_sale_store_order_element`) `quantity` esta en la medida de la
--   propia fila (`measure_id`). Para normalizar a unidad base:
--       quantity * measure.unit_base_quantity
--   En cambio `inventory_element.quantity` e `inventory_element_action.quantity`
--   YA vienen en unidad base (las procedures las normalizan al guardar).
--
-- MEDIDAS (tabla `measure`, columna `unit_base_quantity`)
--   Unidad 1 | Docena 12 | Quincena 15 | Cajilla 240
--   Onza 0.0625 | Libra 1 | Arroba 25 | Quintal 100
--
-- ESTADOS USADOS AQUI (tabla `status`)
--   establishment  activo 28 · inactivo 27 · eliminado 29
--   shop_sale      activa 52 · cancelada 54
--   pago (shop_sale.payment_status_id / delivery_payment_status_id)
--                  pendiente 3 · abonado 4 · pagado 5
--   store_expense  activo 58 · eliminado 59
--   customer       activo 62 · eliminado 63
--   pedido tienda (product_for_sale_store_order.store_status_id)
--                  pendiente 19 · en camino 20 · listo 21 · recibido 22
--                  cancelado 23 · eliminado 24 · entregado 25 · devuelto 26
--
-- TIPOS DE PRODUCTO (`finished_product.finished_product_type_id`)
--   1 = Productos (fabrica general)   2 = Abarrotes (tienda abarrotes)
--
-- ACCIONES DE INVENTARIO (`action_type`) relevantes
--   14 remove_pfs_by_sale        venta en tienda
--   16 add_pfs_by_cancelation    reingreso por venta cancelada
--   17 remove_pfs_by_devolution  DEVOLUCION: sale del inventario de la tienda
--   18 add_fp_by_devolution_from_store  entra a bodega por esa misma devolucion
--   La devolucion se cuenta con la 17 (una fila por producto devuelto). La 18
--   es la contraparte en bodega: contarla tambien duplicaria el dato.
--
-- INVENTARIO <-> TIENDA
--   `inventory.unit_name` guarda el UUID del establecimiento COMO TEXTO cuando
--   `inventory_type = 'product_for_sale'`. Por eso el filtro de tienda sobre
--   inventario compara contra `i.unit_name` (varchar), sin cast a uuid.


-- #############################################################################
-- VARIABLES DE GRAFANA
--
-- Crear estas variables en Dashboard settings > Variables. Las de tipo Query
-- deben ir con Multi-value = ON e Include All = ON, y con
-- "Custom all value" VACIO, para que "All" se expanda a la lista real de
-- valores (es lo que hace funcionar el `IN (...)`).
-- #############################################################################

-- $tienda   (Query, multi, all)  — solo tiendas activas
--    Usada por Q2, Q3 y Q4. Q1 NO la usa: ese panel siempre desglosa todas
--    las tiendas activas, una fila por tienda.
--    SELECT e."name" AS __text, e.id::text AS __value
--    FROM establishment e
--    WHERE e.status_id = 28
--    ORDER BY e."name";

-- $cliente  (Query, multi, all)  — solo clientes activos
--    SELECT c."name" AS __text, c.id::text AS __value
--    FROM customer c
--    WHERE c.status_id = 62
--    ORDER BY c."name";

-- $estado   (Query, multi, all)  — estado de pago de la venta
--    SELECT s."name" AS __text, s.id::text AS __value
--    FROM status s
--    WHERE s.id IN (3, 4, 5)      -- Pendiente, Abonado, Pagado
--    ORDER BY s.id;

-- $inventario (Custom, seleccion simple)
--    Fabrica general (productos) : 1, Tienda abarrotes (abarrotes) : 2

-- $medida   (Custom, seleccion simple)  — el "boton" Unidad / Docena
--    Unidad : 1, Docena : 12
--    Se aplica solo a productos cuya unidad base es Unidad. Los que se miden
--    en Libra se reportan siempre en Libra (una docena de libras no existe).

-- $venta_min / $venta_max (Textbox, pueden quedar vacios)
--    Rango de `shop_sale.sale_number`. Vacio = sin limite por ese lado.


-- #############################################################################
-- PROBAR FUERA DE GRAFANA (psql / DBeaver)
--
-- Sustituir los macros por valores literales:
--    $__timeFilter(x AT TIME ZONE 'UTC')
--        ->  x >= '2026-08-01 00:00:00' AND x < '2026-09-01 00:00:00'
--    ${tienda:sqlstring}     ->  'uuid-tienda-1','uuid-tienda-2'
--    ${cliente:sqlstring}    ->  'uuid-cliente-1'
--    ${estado:sqlstring}     ->  '3','4'
--    ${inventario}           ->  1
--    ${medida}               ->  12
--    '$venta_min'            ->  ''      (o '100')
-- #############################################################################



-- #############################################################################
-- Q1 — RESUMEN DEL PERIODO POR TIENDA
--
-- Una fila POR CADA TIENDA ACTIVA (status 28) con los 10 indicadores. No lleva
-- variable de tienda: el desglose es el punto del panel. El unico filtro es el
-- rango de tiempo del dashboard.
--
-- Las tiendas sin movimiento en el periodo igual aparecen, en cero: se parte de
-- `establishment` y todo lo demas entra por LEFT JOIN.
--
--   Tienda            nombre del establecimiento
--   Ventas            conteo de ventas activas del periodo
--   Envios            conteo de esas ventas que llevan costo de envio (> 0)
--   Sobrante          conteo de cierres de caja con sobrante capturado (> 0)
--   Gastos            conteo de gastos de tienda activos
--   Devoluciones      veces que se devolvio producto (accion 17)
--   Total ventas      venta bruta de producto, ANTES de descuento y SIN envio
--                     = sum(total - delivery + total_discount)
--                     equivale a sum(shop_sale_element.subtotal)
--   Total envios      sum(delivery)
--   Total sobrante    sum(cash_closing.sobrante)
--   Total gastos      sum(store_expense.total_amount)
--   Total devoluciones  sum(cantidad devuelta * precio actual del producto)
--                     ES EL DATO PENDIENTE DE VALIDAR: la cantidad de la accion
--                     queda congelada, pero el precio se lee de
--                     product_for_sale HOY, no el que tenia el dia de la
--                     devolucion (no se guarda historico de precio). Es el
--                     mismo criterio que ya usa el cierre de caja
--                     (view-cash-closing.component.ts).
--
-- Nota sobre "Total ventas": si se quiere el bruto INCLUYENDO el envio, quitar
-- el `- ss.delivery` de la suma.
--
-- Fila de totales generales: si se necesita, en Grafana se activa con
-- Panel > Table > Footer > Show / Calculation = Total. No hace falta tocar la
-- query (y evita que un GROUPING SETS sume mal los conteos).
-- #############################################################################

WITH tiendas AS (
    SELECT e.id, e."name"
    FROM establishment e
    WHERE e.status_id = 28                                    -- solo tiendas activas
),
ventas AS (
    SELECT
        ss.establishment_id                                   AS tienda_id,
        count(*)                                              AS ventas,
        count(*) FILTER (WHERE ss.delivery > 0)               AS envios,
        sum(ss.total - ss.delivery + ss.total_discount)       AS total_ventas,
        sum(ss.delivery)                                      AS total_envios
    FROM shop_sale ss
    WHERE ss.status_id = 52                                   -- solo ventas activas
      AND $__timeFilter(ss.creation_date AT TIME ZONE 'UTC')
    GROUP BY ss.establishment_id
),
sobrantes AS (
    SELECT
        cc.establishment_id                   AS tienda_id,
        count(*)                              AS sobrantes,
        sum(cc.sobrante)                      AS total_sobrante
    FROM cash_closing cc
    WHERE cc.sobrante > 0
      AND $__timeFilter(cc.creation_date AT TIME ZONE 'UTC')
    GROUP BY cc.establishment_id
),
gastos AS (
    SELECT
        se.establishment_id                   AS tienda_id,
        count(*)                              AS gastos,
        sum(se.total_amount)                  AS total_gastos
    FROM store_expense se
    WHERE se.status_id = 58                                   -- gasto activo
      AND $__timeFilter(se.creation_date AT TIME ZONE 'UTC')
    GROUP BY se.establishment_id
),
devoluciones AS (
    SELECT
        i.unit_name                                       AS tienda_id_text,
        count(*)                                          AS devoluciones,
        sum(iea.quantity * pfs.price)                     AS total_devoluciones
    FROM inventory_element_action iea
    JOIN inventory_element ie  ON ie.id  = iea.source_inventory_element_id
    JOIN inventory         i   ON i.id   = ie.inventory_id
    JOIN product_for_sale  pfs ON pfs.id = ie.element_fk
    WHERE iea.action_type_id = 17                             -- remove_pfs_by_devolution
      AND i.inventory_type = 'product_for_sale'
      AND $__timeFilter(iea.creation_date AT TIME ZONE 'UTC')
    GROUP BY i.unit_name                                      -- unit_name = uuid de la tienda
)
SELECT
    t."name"                                    AS "Tienda",
    COALESCE(v.ventas, 0)                       AS "Ventas",
    COALESCE(v.envios, 0)                       AS "Envios",
    COALESCE(s.sobrantes, 0)                    AS "Sobrante",
    COALESCE(g.gastos, 0)                       AS "Gastos",
    COALESCE(d.devoluciones, 0)                 AS "Devoluciones",
    round(COALESCE(v.total_ventas, 0), 2)       AS "Total ventas",
    round(COALESCE(v.total_envios, 0), 2)       AS "Total envios",
    round(COALESCE(s.total_sobrante, 0), 2)     AS "Total sobrante",
    round(COALESCE(g.total_gastos, 0), 2)       AS "Total gastos",
    round(COALESCE(d.total_devoluciones, 0), 2) AS "Total devoluciones"
FROM tiendas t
LEFT JOIN ventas       v ON v.tienda_id      = t.id
LEFT JOIN sobrantes    s ON s.tienda_id      = t.id
LEFT JOIN gastos       g ON g.tienda_id      = t.id
LEFT JOIN devoluciones d ON d.tienda_id_text = t.id::text
ORDER BY t."name";



-- #############################################################################
-- Q2 — PRODUCTOS PEDIDOS A FABRICA, AGRUPADOS POR PRODUCTO
--
-- Fuente: product_for_sale_store_order (pedido) + su detalle.
--
--   Producto      nombre del producto terminado
--   Medida        Unidad / Docena / Libra, segun $medida y la unidad base
--   Cantidad      suma normalizada a unidad base, dividida entre $medida
--   Pedidos       nombres (codigos) de los pedidos que contienen el producto
--   Precio venta  precio por la medida mostrada
--   Precio costo  costo por la medida mostrada
--   Venta total   Cantidad * Precio venta
--   Costo total   Cantidad * Precio costo
--
-- Filtros: $inventario (tipo de producto), $tienda, rango de fechas.
--
-- Sobre "Precio venta" / "Precio costo": se calculan como Venta total /
-- Cantidad, es decir un promedio ponderado. Con UNA tienda seleccionada da
-- exactamente pfs.price * factor; con VARIAS tiendas cuyos precios difieren, el
-- promedio es lo unico que mantiene la identidad Cantidad * Precio = Total.
--
-- Se excluyen los pedidos cancelados (23) y eliminados (24). Si se quisieran
-- ver solo los ya entregados/recibidos, cambiar por
--   AND pfsso.store_status_id IN (22, 25)
-- #############################################################################

WITH base AS (
    SELECT
        fp.id                                              AS producto_id,
        fp."name"                                          AS producto,
        ub."name"                                          AS unidad_base,
        pfsso."name"                                       AS pedido,
        pfssoe.quantity * m.unit_base_quantity              AS cantidad_base,
        pfssoe.quantity * m.unit_base_quantity * pfs.price  AS venta,
        pfssoe.quantity * m.unit_base_quantity * COALESCE(pfs.cost, pfs.price) AS costo
    FROM product_for_sale_store_order_element pfssoe
    JOIN product_for_sale_store_order pfsso ON pfsso.id = pfssoe.pfsso_id
    JOIN product_for_sale             pfs   ON pfs.id   = pfssoe.product_for_sale_id
    JOIN finished_product             fp    ON fp.id    = pfs.finished_product_id
    JOIN unit_base                    ub    ON ub.id    = fp.unit_base_id
    JOIN measure                      m     ON m.id     = pfssoe.measure_id
    WHERE fp.finished_product_type_id = ${inventario}
      AND pfsso.establishment_id::text IN (${tienda:sqlstring})
      AND pfsso.store_status_id NOT IN (23, 24)               -- fuera cancelados y eliminados
      AND $__timeFilter(pfsso.creation_date AT TIME ZONE 'UTC')
),
agrupado AS (
    SELECT
        producto,
        unidad_base,
        -- factor: solo los productos por Unidad se convierten a docena
        sum(cantidad_base) / (CASE WHEN unidad_base = 'Unidad' THEN ${medida} ELSE 1 END) AS cantidad,
        string_agg(DISTINCT pedido, ', ' ORDER BY pedido)  AS pedidos,
        sum(venta)  AS venta_total,
        sum(costo)  AS costo_total
    FROM base
    GROUP BY producto, unidad_base
)
SELECT
    producto AS "Producto",
    CASE WHEN unidad_base = 'Unidad' AND ${medida} = 12 THEN 'Docena'
         ELSE unidad_base
    END                                                AS "Medida",
    round(cantidad, 2)                                 AS "Cantidad",
    pedidos                                            AS "Pedidos",
    round(venta_total / NULLIF(cantidad, 0), 2)        AS "Precio venta",
    round(costo_total / NULLIF(cantidad, 0), 2)        AS "Precio costo",
    round(venta_total, 2)                              AS "Venta total",
    round(costo_total, 2)                              AS "Costo total"
FROM agrupado
ORDER BY producto;



-- #############################################################################
-- Q3 — PRODUCTOS VENDIDOS EN TIENDA, AGRUPADOS POR PRODUCTO
--
--   Producto      nombre del producto terminado
--   Medida        unidad base del producto (Unidad / Libra)
--   Cantidad      suma vendida normalizada a unidad base
--   Venta total   Cantidad * precio de venta
--   Costo total   Cantidad * precio de costo
--   Total         Venta total + Costo total  (la suma pedida como "Totales")
--
-- Filtros: $tienda, rango de fechas, y rango de numero de venta
-- ($venta_min / $venta_max, ambos opcionales).
--
-- La ultima fila es el TOTAL general (GROUPING SETS). En esa fila Cantidad va
-- vacia a proposito: mezclar unidades y libras en un mismo numero no significa
-- nada.
--
-- OJO con el rango de No. de venta: `shop_sale.sale_number` es un correlativo
-- POR TIENDA (trigger shop_sale_assign_number). Filtrar 100-200 con varias
-- tiendas seleccionadas trae la venta 150 de cada tienda, que no son la misma.
-- Usar ese filtro con UNA sola tienda.
--
-- Precio de venta: se usa el precio VIGENTE del producto (pfs.price), como pide
-- la especificacion. Si se quisiera el precio real cobrado en cada venta (queda
-- congelado en shop_sale_element), cambiar en el CTE `base`:
--     sse.quantity * m.unit_base_quantity * pfs.price   ->   sse.total
-- El costo no tiene historico: siempre sale de product_for_sale.cost.
-- #############################################################################

WITH base AS (
    SELECT
        fp."name"                                        AS producto,
        ub."name"                                        AS unidad_base,
        sse.quantity * m.unit_base_quantity              AS cantidad_base,
        sse.quantity * m.unit_base_quantity * pfs.price  AS venta,
        sse.quantity * m.unit_base_quantity * COALESCE(pfs.cost, pfs.price) AS costo
    FROM shop_sale_element sse
    JOIN shop_sale        ss  ON ss.id  = sse.shop_sale_id
    JOIN product_for_sale pfs ON pfs.id = sse.product_for_sale_id
    JOIN finished_product fp  ON fp.id  = pfs.finished_product_id
    JOIN unit_base        ub  ON ub.id  = fp.unit_base_id
    JOIN measure          m   ON m.id   = sse.measure_id
    WHERE ss.status_id = 52                                   -- solo ventas activas
      AND ss.establishment_id::text IN (${tienda:sqlstring})
      AND $__timeFilter(ss.creation_date AT TIME ZONE 'UTC')
      -- rango de No. de venta; textbox vacio = sin limite
      AND ss.sale_number >= COALESCE(NULLIF('$venta_min', '')::bigint, ss.sale_number)
      AND ss.sale_number <= COALESCE(NULLIF('$venta_max', '')::bigint, ss.sale_number)
)
SELECT
    COALESCE(producto, 'TOTAL')                     AS "Producto",
    unidad_base                                     AS "Medida",
    round(sum(cantidad_base), 2)                    AS "Cantidad",
    round(sum(venta), 2)                            AS "Venta total",
    round(sum(costo), 2)                            AS "Costo total",
    round(sum(venta) + sum(costo), 2)               AS "Total"
FROM base
GROUP BY GROUPING SETS ((producto, unidad_base), ())
ORDER BY (producto IS NULL), producto;   -- la fila TOTAL siempre al final

-- Variante: si en vez de "ventas + costos" se busca la ganancia del producto,
-- reemplazar la columna "Total" por
--     round(sum(venta) - sum(costo), 2) AS "Margen"



-- #############################################################################
-- Q4 — CLIENTES CON SALDO PENDIENTE
--
--   Nombre            nombre del cliente registrado
--   Nit               nit del cliente
--   Saldo pendiente   suma de lo que debe en TODAS las tiendas
--                     = pending_amount (pedido) + delivery_pending_amount (envio)
--   Ventas pendientes conteo de ventas con saldo > 0
--   Tiendas           tiendas donde tiene al menos una venta pendiente
--
-- Filtros: rango de fechas (fecha de la venta), $cliente, $estado.
--
-- Las columnas pending_amount / delivery_pending_amount ya vienen NETAS de los
-- abonos registrados en shop_sale_payment, asi que una venta saldada aporta 0
-- (mismo criterio que /retrieveEstablishmentCustomers).
--
-- Solo aparecen ventas de CLIENTE REGISTRADO: una venta al credito no se puede
-- guardar sin customer_id (lo valida register_shop_sale_with_elements_v4/v5).
-- Las ventas de cliente escrito a mano nunca quedan con saldo.
--
-- $estado filtra por el ESTADO DE PAGO de la venta (3 Pendiente, 4 Abonado,
-- 5 Pagado); la venta entra si su estado de pedido O el de envio esta en la
-- seleccion. Seleccionar solo "Pagado" devuelve vacio, y es correcto: no hay
-- saldo que mostrar. La seleccion util por defecto es Pendiente + Abonado.
-- #############################################################################

WITH pendientes AS (
    SELECT
        cu.id                                                AS cliente_id,
        cu."name"                                            AS cliente,
        cu.nit                                               AS nit,
        e."name"                                             AS tienda,
        ss.id                                                AS venta_id,
        ss.pending_amount + ss.delivery_pending_amount       AS saldo
    FROM shop_sale ss
    JOIN customer      cu ON cu.id = ss.customer_id
    JOIN establishment e  ON e.id  = ss.establishment_id
    WHERE ss.status_id = 52                                   -- venta activa (54 = cancelada)
      AND (ss.pending_amount + ss.delivery_pending_amount) > 0
      AND cu.id::text IN (${cliente:sqlstring})
      AND (   ss.payment_status_id::text          IN (${estado:sqlstring})
           OR ss.delivery_payment_status_id::text IN (${estado:sqlstring}) )
      AND $__timeFilter(ss.creation_date AT TIME ZONE 'UTC')
)
SELECT
    cliente                                          AS "Nombre",
    nit                                              AS "Nit",
    round(sum(saldo), 2)                             AS "Saldo pendiente",
    count(DISTINCT venta_id)                         AS "Ventas pendientes",
    string_agg(DISTINCT tienda, ', ' ORDER BY tienda) AS "Tiendas"
FROM pendientes
GROUP BY cliente_id, cliente, nit
ORDER BY sum(saldo) DESC;

-- Variante: si "$estado" debia ser el ESTADO DEL CLIENTE (Activo 62 /
-- Eliminado 63) en lugar del estado de pago de la venta, cambiar la variable a
--     SELECT s."name" AS __text, s.id::text AS __value
--     FROM status s WHERE s."type" = 'customer' ORDER BY s.id;
-- y sustituir el bloque OR de arriba por
--     AND cu.status_id::text IN (${estado:sqlstring})
