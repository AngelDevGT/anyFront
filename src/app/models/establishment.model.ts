import { Status } from "./auxiliary/status.model";
import { User } from "./system/user.model";

export class Establishment {
    id?: string;
    name?: string;
    address?: string;
    description?: string;
    receivePendingOrdersEnabled?: boolean;
    /** Habilita "Vender pedido" y "Recibir y vender" en el detalle de pedido de la tienda. */
    sellOrdersEnabled?: boolean;
    establishmentTypeId?: number;
    /** Bancos con los que trabaja la tienda, separados por salto de linea. Ver @app/helpers/banks. */
    banks?: string;
    /** Etiquetas que se ofrecen al registrar un gasto, separadas por salto de linea. Ver @app/helpers/expense-tags. */
    expenseTags?: string;
    creationDate?: string; //sistema
    updatedDate?: string; //sistema
    creatorUser?: User; //sistema
    status?: Status;
}