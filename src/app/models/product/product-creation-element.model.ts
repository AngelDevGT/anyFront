import { Status } from "../auxiliary/status.model";
import { RawMaterialBase } from "../raw-material/raw-material-base.model";
import { User } from "../user.model";

export class ProductCreationElement {
    _id?: string;
    rawMaterialBase?: RawMaterialBase; //elements
    quantity?: string;
    date?: string;
}