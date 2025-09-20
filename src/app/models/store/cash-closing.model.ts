import { Status } from "../auxiliary/status.model";
import { Establishment } from "../establishment.model";
import { InventoryElementAction } from "../inventory/inventory-element-action.model";
import { InventoryElement } from "../inventory/inventory-element.model";
import { ProductForSaleStoreOrder } from "../product-for-sale/product-for-sale-store-order.model";
import { ActivityLog } from "../system/activity-log";
import { User } from "../system/user.model";
import { ShopResume } from "./shop-resume.model";

export interface CashClosing {
    id?: string;
    note?: string;
    storeID?: string;
    establishment?: Establishment;
    status?: Status;
    inventoryElementActions?: InventoryElementAction[];
    activityLogs?: ActivityLog[];
    saleStoreOrders?: ProductForSaleStoreOrder[];
    shopResumes?: ShopResume[];
    lastInventory?: InventoryElement[];
    lastInventoryCreationDate?: string;
    inventoryCapture?: InventoryElement[];
    userRequest?: User;
    userValidator?: User;
    creationDate?: string;
    initialDate?: string;
}