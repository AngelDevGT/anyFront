import { Status } from "./auxiliary/status.model";
import { User } from "./system/user.model";

export class Establishment {
    id?: string;
    name?: string;
    address?: string;
    description?: string;
    receivePendingOrdersEnabled?: boolean;
    establishmentTypeId?: number;
    /** Bancos con los que trabaja la tienda, separados por salto de linea. Ver @app/helpers/banks. */
    banks?: string;
    creationDate?: string; //sistema
    updatedDate?: string; //sistema
    creatorUser?: User; //sistema
    status?: Status;
}