import { Measure } from "../auxiliary/measure.model";
import { Status } from "../auxiliary/status.model";
import { ProductForSale } from "../product/producto-for-sale.model";

export class ManageProductForSaleStoreOrderElement {
    ProductForSaleStoreOrderID?: string;
    DestinyInventoryID?: string;
    storeStatus?: Status;
    factoryStatus?: Status;
}