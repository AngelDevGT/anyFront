import { Status } from "../auxiliary/status.model";
import { RawMaterialBase } from "../raw-material/raw-material-base.model";
import { User } from "../user.model";
import { FinishedProduct } from "./finished-product.model";
import { ProductCreationElement } from "./product-creation-element.model";

export class ProductCreation {
    _id?: string;
    finishedProduct?: FinishedProduct; 
    productCreationElements?: ProductCreationElement[];
    creatorUser?: User;
    status?: Status;
    quantity?: string;
    date?: string;
}