import { ShopResume } from "./shop-resume.model";
import { ShopSalePayment } from "./shop-sale-payment.model";

/**
 * Abono de una venta al crédito visto desde el historial del cliente: el mismo
 * pago que devuelve /getShopSalePaymentsV5 más la venta a la que pertenece.
 *
 * `sale` viene siempre (el endpoint parte de shop_sale) y trae el estado ACTUAL
 * de la venta, no el que tenía al registrarse el abono.
 */
export interface CustomerCreditPayment extends ShopSalePayment {
    sale?: ShopResume;
}
