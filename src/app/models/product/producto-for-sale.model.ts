import { Status } from "../auxiliary/status.model";
import { Establishment } from "../establishment.model";
import { User } from "../system/user.model";
import { FinishedProduct } from "./finished-product.model";

export class ProductForSale {
    id?: string;
    finishedProduct?: FinishedProduct;
    price?: string;
    /** Costo del producto. Solo lo reciben/editan los usuarios con rol Sistema. */
    cost?: string;
    establishment?: Establishment;
    status?: Status;
    creatorUser?: User; //sistema
    creationDate?: string;
    updatedDate?: string;
    sortOrder?: number;
}