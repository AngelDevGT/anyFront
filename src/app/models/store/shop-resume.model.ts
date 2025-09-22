import { PaymentType } from "../auxiliary/payment-type.model";
import { Status } from "../auxiliary/status.model";
import { Establishment } from "../establishment.model";
import { User } from "../user-bk1.model";
import { ItemsList } from "./item-list.model";

export interface ShopResume {
    id?: string;
    nameClient?: string;
    nota?: string;
    delivery?: string;
    nitClient?: string;
    establecimiento?: Establishment;
    establishment?: Establishment;
    status?: Status;
    total?: string;
    totalDiscount?: string;
    creationDate?: string;
    updatedDate?: string;
    itemsList?: ItemsList[];
    creatorUser?: User;
    paymentType?: PaymentType;
}  