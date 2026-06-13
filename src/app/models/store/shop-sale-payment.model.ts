import { PaymentType } from "../auxiliary/payment-type.model";

export interface ShopSalePayment {
    id?: string;
    amount?: string;
    date?: string;
    paymentTarget?: string; // 'ORDER' | 'DELIVERY'
    paymentType?: PaymentType;
}
