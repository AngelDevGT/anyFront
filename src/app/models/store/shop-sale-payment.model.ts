import { PaymentType } from "../auxiliary/payment-type.model";

export interface ShopSalePayment {
    id?: string;
    amount?: string;
    date?: string;
    comment?: string;
    paymentTarget?: string; // 'ORDER' | 'DELIVERY'
    /** true cuando es el depósito registrado con la venta, no un abono de crédito. */
    isSalePayment?: boolean;
    paymentType?: PaymentType;
}
