import { Measure } from "../auxiliary/measure.model";
import { Status } from "../auxiliary/status.model";
import { Establishment } from "../establishment.model";
import { User } from "../user.model";
import { ItemsList } from "./item-list.model";

export interface ShopResume {
    _id?: string;
    nameClient?: string;
    nota?: string;
    nitClient?: string;
    establecimiento?: Establishment;
    status?: Status;
    total?: string;
    totalDiscount?: string;
    creationDate?: Date;
    updateDate?: Date;
    itemsList?: ItemsList[];
}  