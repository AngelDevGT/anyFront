import { Measure } from "../auxiliary/measure.model";
import { ProductForSale } from "../product/producto-for-sale.model";

export class ProductForSaleStoreOrderElement {
    _id?: string;
    /**
     * PK del elemento (int4, no uuid). Solo la devuelve
     * /getProductForSaleStoreOrderElementsV3, la lectura del tablero: el resto de
     * las queries de pedido no la traen, porque hasta ahora nadie necesitaba
     * dirigirse a un elemento en particular.
     */
    id?: number;
    productForSale?: ProductForSale;
    measure?: Measure;
    quantity?: string;
    price?: string;
    totalPrice?: string;
    date?: string;
    /**
     * ¿Bodega ya alistó este producto? Es una ayuda de control del tablero, NO un
     * estado: no condiciona ninguna transición del pedido ni mueve inventario.
     *
     * Se pierde si el pedido se edita: update_product_for_sale_order_with_elements
     * borra y reinserta todos los elementos, y las filas nuevas nacen sin marcar.
     * Es a propósito —si la lista cambió, hay que volver a recorrerla—.
     * Ver src/database/migrations/2026-08-30-check-productos-pedido.sql
     */
    isCheck?: boolean;
    /**
     * La segunda pasada de control, la de quien REVISA el pedido en la vista
     * "Pedidos preparados" con el pedido en Preparado(64). Es independiente de
     * [[isCheck]] a propósito: son dos preguntas distintas, hechas por dos
     * personas en dos momentos, y heredar la primera vaciaría de sentido a la
     * segunda.
     *
     * Se borra al retroceder de Preparado a En curso, junto con la verificación y
     * la fecha de preparado: el pedido vuelve para corregirse, así que la
     * revisión quedó vieja. isCheck, en cambio, sobrevive a ese retroceso.
     * Ver src/database/migrations/2026-09-03-check-preparado-productos.sql
     */
    preparedCheck?: boolean;
}