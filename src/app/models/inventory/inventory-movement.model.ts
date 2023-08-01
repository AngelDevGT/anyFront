import { Status } from "../auxiliary/status.model";
import { RawMaterialByProvider } from "../raw-material/raw-material-by-provider.model";
import { User } from "../user.model";
import { Inventory } from "./inventory.model";

export class InventoryMovement {
    _id?: string;
    comment?: string;
    rawMaterialByProvider?: RawMaterialByProvider;
    quantity?: string;
    status?: Status;
    receivingUser?: User;
    deliveringUser?: User;
    inventoryInput?: Inventory;
    inventoryOutput?: Inventory;
    date?: string;
}