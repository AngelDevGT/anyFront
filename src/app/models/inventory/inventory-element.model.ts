import { Measure } from "../auxiliary/measure.model";
import { Status } from "../auxiliary/status.model";
import { FinishedProduct } from "../product/finished-product.model";
import { RawMaterialBase } from "../raw-material/raw-material-base.model";
import { RawMaterialByProvider } from "../raw-material/raw-material-by-provider.model";
import { User } from "../user.model";

export class InventoryElement {
    _id?: string;
    rawMaterialByProvider?: RawMaterialByProvider;
    rawMaterialBase?: RawMaterialBase;
    finishedProduct?: FinishedProduct;
    measure?: Measure;
    quantity?: string;
    status?: Status;
    creatorUser?: User;
    creationDate?: string;
    updateDate?: string;
}