import { Customer } from "./customer.model";
import { User } from "./user.model";

/**
 * Cliente asignado a una tienda. `id` es el id del cliente; `assignmentId`
 * es el id de la fila en establishment_customer (el que se usa para quitar
 * la asignación).
 */
export class EstablishmentCustomer extends Customer {
    assignmentId?: string;
    assignmentDate?: string;
    assignedBy?: User;
    /** Saldo pendiente del cliente en esta tienda (pedido + envío). */
    pendingBalance?: number | string;
    /** Cantidad de ventas activas con saldo pendiente en esta tienda. */
    pendingSalesCount?: number | string;
}
