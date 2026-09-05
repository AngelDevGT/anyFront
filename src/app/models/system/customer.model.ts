import { Status } from "../auxiliary/status.model";
import { User } from "./user.model";

export class Customer {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
    nit?: string;
    /**
     * Marca al cliente como operador: lo hace aparecer en el catálogo del modal
     * de operadores del tablero de pedidos. No afecta nada más del cliente.
     */
    isOperator?: boolean;
    status?: Status;
    creatorUser?: User;
    creationDate?: string;
    updatedDate?: string;
}
