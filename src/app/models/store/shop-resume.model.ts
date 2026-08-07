import { PaymentType } from "../auxiliary/payment-type.model";
import { Status } from "../auxiliary/status.model";
import { Establishment } from "../establishment.model";
import { Customer } from "../system/customer.model";
import { User } from "../user-bk1.model";
import { ItemsList } from "./item-list.model";
import { ShopSalePayment } from "./shop-sale-payment.model";

export interface ShopResume {
    id?: string;
    saleNumber?: number;
    /** Nombre a mostrar: lo resuelve la base (cliente registrado o el manual). */
    nameClient?: string;
    nota?: string;
    delivery?: string;
    nitClient?: string;
    /** Presente solo cuando la venta es de un cliente registrado. */
    customer?: Customer;
    establecimiento?: Establishment;
    establishment?: Establishment;
    status?: Status;
    total?: string;
    totalDiscount?: string;
    paidAmount?: string;
    pendingAmount?: string;
    paymentStatus?: Status;
    deliveryPaidAmount?: string;
    deliveryPendingAmount?: string;
    deliveryPaymentStatus?: Status;
    creationDate?: string;
    updatedDate?: string;
    itemsList?: ItemsList[];
    creatorUser?: User;
    paymentType?: PaymentType;
    deliveryPaymentType?: PaymentType;
    payments?: ShopSalePayment[];

    /**
     * Solo de ida, al registrar una venta pagada con Depósito. Si el comentario
     * va vacío no se registra ningún pago y la venta se guarda como siempre;
     * con comentario, la base crea el shop_sale_payment del depósito. La fecha
     * ya debe venir en UTC (getUTCTimeFromLocalDateTime).
     */
    depositComment?: string;
    depositDate?: string;
    deliveryDepositComment?: string;
    deliveryDepositDate?: string;
}