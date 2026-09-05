import { ShopResume } from "./shop-resume.model";

/**
 * Una venta del cliente en una tienda, vista desde su historial de ventas.
 * Es la venta completa (crédito o no) más el acumulado de sus abonos, para no
 * tener que pedir el detalle de pagos de cada una solo para pintar la tabla.
 *
 * Los tres campos de crédito cuentan únicamente ABONOS: el depósito que se
 * registra junto con la venta queda fuera desde la query.
 */
export interface CustomerSaleHistory extends ShopResume {
    /** Suma de los abonos de la venta. 0 en las ventas que no son al crédito. */
    creditPaidAmount?: string;
    creditPaymentsCount?: number;
    /** Fecha del último abono; null si la venta todavía no tiene ninguno. */
    lastCreditPaymentDate?: string;
}
