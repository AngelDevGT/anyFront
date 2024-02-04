import { Status } from "../auxiliary/status.model";
import { Establishment } from "../establishment.model";
import { User } from "../user.model";
import { ProductForSaleStoreOrderElement } from "./product-for-sale-store-order-element.model";

export class ProductForSaleStoreOrder {
    _id?: string;
    productForSaleStoreOrderElements?: ProductForSaleStoreOrderElement[];
    name?: string;
    comment?: string;
    establishmentID?: string;
    inventoryID?: string;
    storeStatus?: Status; // Pendiente, En Camino, Recibido,  Cancelado, Eliminado
    factoryStatus?: Status; // Pendiente, Listo, Entregado, Cancelado, Devuelto, Eliminado
    finalAmount?: string;
    creatorUser?: User;
    creationDate?: string;
    updateDate?: string;
}