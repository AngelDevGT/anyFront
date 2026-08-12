import { PaymentType } from "../auxiliary/payment-type.model";
import { User } from "../system/user.model";

export interface ShopSalePayment {
    id?: string;
    amount?: string;
    date?: string;
    comment?: string;
    paymentTarget?: string; // 'ORDER' | 'DELIVERY'
    /** true cuando es el depósito registrado con la venta, no un abono de crédito. */
    isSalePayment?: boolean;
    paymentType?: PaymentType;
    /**
     * Usuario que registró el abono. Viene vacío en los abonos anteriores a
     * 2026-08-11 y en el depósito registrado con la venta; en ambos casos el
     * usuario correcto es el creador de la venta.
     */
    creatorUser?: User;
}
