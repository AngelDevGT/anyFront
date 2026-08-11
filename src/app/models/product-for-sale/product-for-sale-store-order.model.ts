import { Status } from "../auxiliary/status.model";
import { Establishment } from "../establishment.model";
import { User } from "../system/user.model";
import { ProductForSaleStoreOrderElement } from "./product-for-sale-store-order-element.model";

export class ProductForSaleStoreOrder {
    id?: string;
    productForSaleStoreOrderElements?: ProductForSaleStoreOrderElement[];
    name?: string;
    comment?: string;
    establishmentID?: string;
    establishment?: Establishment;
    inventoryID?: string;
    storeStatus?: Status; // Pendiente, En Camino, Recibido,  Cancelado, Eliminado
    factoryStatus?: Status; // Pendiente, Listo, Entregado, Cancelado, Devuelto, Eliminado
    finalAmount?: string;
    creatorUser?: User;
    creationDate?: string;
    updatedDate?: string;
    // Tablero de bodega: se llenan al pasar el pedido a En curso / Listo.
    // Quedan en null para los pedidos anteriores al tablero y para los que
    // pasan a Listo desde la vista de tabla vieja.
    assignedUser?: User;
    startDate?: string;
    readyDate?: string;
}