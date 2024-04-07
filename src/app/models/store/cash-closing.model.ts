import { Status } from "../auxiliary/status.model";
import { InventoryElement } from "../inventory/inventory-element.model";
import { ProductForSaleStoreOrder } from "../product-for-sale/product-for-sale-store-order.model";
import { ActivityLog } from "../system/activity-log";
import { User } from "../system/user.model";
import { ShopResume } from "./shop-resume.model";

export interface CashClosing {
    _id?: string;
    note?: string;
    storeID?: string;
    status?: Status;
    activityLogs?: ActivityLog[];
    saleStoreOrders?: ProductForSaleStoreOrder[];
    shopResumes?: ShopResume[];
    inventoryCapture?: InventoryElement[];
    userRequest?: User;
    userValidator?: User;
    creationDate?: string;
    initialDate?: string;
}