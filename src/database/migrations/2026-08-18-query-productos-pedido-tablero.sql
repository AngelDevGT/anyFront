-- =============================================================================
-- Migración: query liviana para el modal "Ver productos" del tablero de bodega
-- Fecha: 2026-08-18
-- Ejecución: MANUAL. Correr en el Postgres de producción.
--
-- El modal del tablero pedía /getProductForSaleStoreOrderV2, que es el detalle
-- COMPLETO del pedido —el mismo que usa la pantalla "Ver pedido"— para pintar
-- tres columnas de texto. De todo ese payload solo se usaban el nombre del
-- producto, la cantidad y la medida.
--
-- Lo caro no es la cabecera del pedido sino `finished_product.photo`, una
-- columna text con la imagen completa en base64 (la misma que motivó agregar
-- `thumb` en 2026-07-06-add-thumb-column.sql para no arrastrarla en listados).
-- Un pedido de 15 productos con foto son varios MB, y el modal NO cachea a
-- propósito: los productos se pueden editar mientras el pedido está en
-- Pendiente(11) o En curso(12), así que se vuelve a bajar en cada apertura.
--
-- Esta query devuelve solo lo que el modal pinta, más el comentario del pedido,
-- que también se muestra ahora. El comentario viene de aquí y no de la tarjeta
-- del tablero justamente porque es editable: el dato de la tarjeta puede tener
-- hasta un intervalo de autorefresh de antigüedad.
--
-- ENFOQUE 100% ADITIVO: fila nueva en sql_queries. No se toca ninguna query
-- existente; /getProductForSaleStoreOrderV2 sigue sirviendo a "Ver pedido" y a
-- la pantalla de edición, que sí necesitan el detalle completo.
--
-- El sufijo V2 no es una versión de nada previo: el endpoint es nuevo y nace
-- alineado con la familia V2 de pedidos (list/get/board/forPdf).
-- =============================================================================


-- #############################################################################
-- PASO 1 — /getProductForSaleStoreOrderElementsV2
--
-- El DELETE previo la hace idempotente: sql_queries no tiene unique en "path",
-- así que re-ejecutar sin él duplicaría la fila y el router podría resolver la
-- equivocada.
--
-- Se mantiene la MISMA forma anidada que el resto de queries de pedidos
-- (productForSale -> finishedProduct -> name) para que el front siga usando el
-- modelo ProductForSaleStoreOrderElement sin un mapeo aparte.
--
-- Sin ORDER BY: se conserva el orden que ya mostraba el modal.
-- #############################################################################

DELETE FROM public.sql_queries WHERE "path" = '/getProductForSaleStoreOrderElementsV2';

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('getProductForSaleStoreOrderElementsV2','/getProductForSaleStoreOrderElementsV2','SELECT json_build_object(
    ''id'', pfsso.id,
    ''comment'', pfsso.comment,
    ''productForSaleStoreOrderElements'', (
        SELECT json_agg(
            json_build_object(
                ''quantity'', pfssoe.quantity,
                ''measure'', json_build_object(
                    ''identifier'', m.name
                ),
                ''productForSale'', json_build_object(
                    ''finishedProduct'', json_build_object(
                        ''name'', fp.name
                    )
                )
            )
        )
        FROM product_for_sale_store_order_element pfssoe
        LEFT JOIN product_for_sale pfs ON pfs.id = pfssoe.product_for_sale_id
        LEFT JOIN finished_product fp ON fp.id = pfs.finished_product_id
        LEFT JOIN measure m ON m.id = pfssoe.measure_id
        WHERE pfssoe.pfsso_id = pfsso.id
    )
) as json_result
from product_for_sale_store_order pfsso','product_for_sale_store_order','POST');


-- #############################################################################
-- VERIFICACIÓN
-- #############################################################################
--
-- SELECT "path" FROM sql_queries WHERE "path" = '/getProductForSaleStoreOrderElementsV2';
--
-- -- No debe traer photo, price ni la cabecera completa
-- SELECT consulta_sql LIKE '%photo%'       AS trae_foto,
--        consulta_sql LIKE '%comment%'     AS trae_comentario
--   FROM sql_queries
--  WHERE "path" = '/getProductForSaleStoreOrderElementsV2';
--
-- -- Prueba con un pedido real (el front manda {"pfsso": {"id": "..."}})
-- -- El resultado debe ser: id, comment y la lista con quantity/measure/name.
-- #############################################################################
