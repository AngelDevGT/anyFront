import { PaymentType } from "../auxiliary/payment-type.model";
import { User } from "../system/user.model";

export interface ShopSalePayment {
    id?: string;
    amount?: string;
    /**
     * Fecha de REGISTRO en el sistema. La pone la base y no se puede editar: es
     * la que decide a qué cierre de caja pertenece el pago. Antes de 2026-09-22
     * esta columna llevaba la fecha que tecleaba el usuario, y por eso un pago
     * retrofechado podía sacarse de un cierre y meterse en otro ya firmado.
     */
    date?: string;
    /**
     * Fecha del pago según el usuario. Es la que se muestra como fecha principal
     * del pago; no mueve plata de período. La base la devuelve ya resuelta con
     * COALESCE(payment_date, date), así que nunca viene vacía: en los pagos
     * anteriores a 2026-09-22 es la misma `date`, que era justamente la fecha
     * que el usuario había tecleado.
     */
    paymentDate?: string;
    comment?: string;
    /**
     * Banco del pago y numero de transferencia o de cheque. Solo los llevan los pagos con Depósito
     * y con Cheque; vienen vacios en los pagos en efectivo y en los anteriores a 2026-09-01.
     * El banco sale del listado de la tienda (establishment.banks) y se guarda como nombre.
     */
    bank?: string;
    referenceNo?: string;
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
