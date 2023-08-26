import { InventoryType } from "../auxiliary/inventory-type.model";
import { Status } from "../auxiliary/status.model";
import { Unit } from "../auxiliary/measure.model";
import { User } from "../user.model";
import { InventoryElement } from "./inventory-element.model";

export class Inventory {
    _id?: string;
    inventoryElements?: InventoryElement[];
    name?: string;
    description?: string;
    personInCharge?: User;
    initialDate?: string;
    inventoryType?: InventoryType;
    unit?: Unit;
    status?: Status;
    creatorUser?: User;
    creationDate?: string;
    updateDate?: string;
}