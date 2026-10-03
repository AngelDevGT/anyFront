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
     * Solo de ida: el pedido del que sale la venta ("Vender pedido"). La base valida que sea de la
     * misma tienda, que esté Recibido y que no tenga otra venta activa, y lo guarda en
     * shop_sale.pfs_store_order_id. Vacío en una venta normal.
     * Ver src/database/migrations/2026-10-02-venta-de-pedidos.sql
     */
    pfsStoreOrderId?: string;

    /**
     * Solo de ida, al registrar una venta pagada con Depósito o con Cheque. La base crea el
     * shop_sale_payment con estos datos si viene alguno de los tres (banco, referencia o
     * comentario); el banco y la referencia son obligatorios en el formulario, así que en la
     * práctica la fila siempre existe. La fecha ya debe venir en UTC
     * (getUTCTimeFromLocalDateTime).
     *
     * El banco sale del listado de la tienda; el comentario es opcional y queda para la nota libre.
     */
    depositBank?: string;
    depositReferenceNo?: string;
    depositComment?: string;
    depositDate?: string;
    deliveryDepositBank?: string;
    deliveryDepositReferenceNo?: string;
    deliveryDepositComment?: string;
    deliveryDepositDate?: string;
}