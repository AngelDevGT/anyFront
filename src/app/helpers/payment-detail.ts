/**
 * Detalle bancario de un pago: de que banco salio y con que numero de transferencia o de cheque.
 *
 * Vive en shop_sale_payment.bank y .reference_no, los dos varchar(50). Antes ese dato se escribia
 * suelto dentro del comentario, que es texto libre y opcional, asi que no se podia cuadrar contra
 * el estado de cuenta del banco.
 *
 * QUE TIPOS DE PAGO LO PIDEN
 * Deposito y Cheque. El catalogo payment_type tiene cuatro entradas —Efectivo, Credito, Deposito,
 * Cheque— y no existe "Transferencia": el deposito ES la transferencia bancaria en este sistema.
 *
 * La regla vive aca y no dentro de cada pantalla: la usan el registro de venta, el cobro de abono,
 * los dos timelines y las dos vistas del cierre de caja. Con una copia por pantalla, agregar un
 * tipo de pago bancario dejaria la mitad sin actualizar.
 */

import { parseBanks } from './banks';

/** Tipos de pago que exigen banco y numero de referencia. */
export const PAYMENT_DETAIL_TYPES = ['Depósito', 'Cheque'];

/** Tope de las dos columnas. */
export const BANK_NAME_MAX_LENGTH = 50;
export const REFERENCE_NO_MAX_LENGTH = 50;

/** Forma minima de un pago para formatear su detalle. */
export interface PaymentDetail {
    bank?: string;
    referenceNo?: string;
}

/**
 * El pago necesita banco y referencia. Recibe el identificador del tipo de pago
 * (paymentType.identifier), no el id: los ids del catalogo no son estables entre ambientes.
 */
export function requiresPaymentDetail(paymentTypeIdentifier?: string): boolean {
    return !!paymentTypeIdentifier && PAYMENT_DETAIL_TYPES.includes(paymentTypeIdentifier);
}

/** Lo mismo, partiendo del id contra el catalogo ya cargado en la pantalla. */
export function requiresPaymentDetailById(
    paymentTypeId: string | number | undefined | null,
    paymentTypes?: { id?: any, identifier?: string }[]
): boolean {
    if (paymentTypeId === undefined || paymentTypeId === null || paymentTypeId === '') return false;
    const type = (paymentTypes || []).find(pt => String(pt.id) === String(paymentTypeId));
    return requiresPaymentDetail(type?.identifier);
}

/**
 * El detalle en una linea, para los timelines y las tablas: "Banco Industrial · Ref. 998877".
 * Cadena vacia si el pago no trae ninguno de los dos, que es el caso de los pagos en efectivo y de
 * los anteriores a 2026-09-01.
 */
export function formatPaymentDetail(payment?: PaymentDetail | null): string {
    const bank = (payment?.bank ?? '').trim();
    const reference = (payment?.referenceNo ?? '').trim();

    const parts: string[] = [];
    if (bank) parts.push(bank);
    if (reference) parts.push('Ref. ' + reference);
    return parts.join(' · ');
}

/**
 * Bancos de la tienda listos para un select. Es parseBanks con el nombre que usa esta pantalla:
 * el listado de la tienda es la unica fuente de la que se puede elegir.
 */
export function bankOptions(banks?: string | null): string[] {
    return parseBanks(banks);
}
