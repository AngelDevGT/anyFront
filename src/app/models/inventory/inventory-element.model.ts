import { Measure } from "../auxiliary/measure.model";
import { Status } from "../auxiliary/status.model";
import { Establishment } from "../establishment.model";
import { FinishedProduct } from "../product/finished-product.model";
import { ProductForSale } from "../product/producto-for-sale.model";
import { RawMaterialBase } from "../raw-material/raw-material-base.model";
import { RawMaterialByProvider } from "../raw-material/raw-material-by-provider.model";
import { User } from "../system/user.model";

export class InventoryElement {
    _id?: string;
    rawMaterialByProvider?: RawMaterialByProvider;
    rawMaterialBase?: RawMaterialBase;
    finishedProduct?: FinishedProduct;
    productForSale?: ProductForSale;
    establishment?: Establishment;
    measure?: Measure;
    quantity?: string;
    status?: Status;
    creatorUser?: User;
    creationDate?: string;
    updateDate?: string;
}