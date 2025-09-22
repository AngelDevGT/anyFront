import { InventoryType } from "../auxiliary/inventory-type.model";
import { Status } from "../auxiliary/status.model";
import { Unit } from "../auxiliary/unit.model";
import { Establishment } from "../establishment.model";
import { User } from "../system/user.model";
import { InventoryElement } from "./inventory-element.model";

export class Inventory {
    id?: string;
    establishment?: Establishment;
    inventoryElements?: InventoryElement[];
    name?: string;
    description?: string;
    personInCharge?: User;
    initialDate?: string;
    inventoryType?: string;
    unitName?: string;
    status?: Status;
    creatorUser?: User;
    creationDate?: string;
    updateDate?: string;
}