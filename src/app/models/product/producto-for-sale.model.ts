import { Status } from "../auxiliary/status.model";
import { Establishment } from "../establishment.model";
import { User } from "../system/user.model";
import { FinishedProduct } from "./finished-product.model";

export class ProductForSale {
    _id?: string;
    finishedProduct?: FinishedProduct;
    price?: string;
    establishment?: Establishment;
    status?: Status;
    creatorUser?: User; //sistema
    creationDate?: string;
    updateDate?: string;
}