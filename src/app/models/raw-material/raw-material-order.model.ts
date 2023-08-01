import { PaymentStatus } from "../auxiliary/payment-status.model";
import { PaymentType } from "../auxiliary/payment-type.model";
import { Status } from "../auxiliary/status.model";
import { Provider } from "../provider.model";
import { User } from "../user.model";
import { RawMaterialOrderElement } from "./raw-material-order-element.model";

export class RawMaterialOrder {
    _id?: string;
    rawMaterialOrderElements?: RawMaterialOrderElement[];
    name?: string;
    comment?: string;
    provider?: Provider;
    status?: Status;
    paymentStatus?: PaymentStatus;
    paymentType?: PaymentType;
    finalAmount?: string;
    pendingAmount?: string;
    creatorUser?: User;
    creationDate?: string;
    updateDate?: string;
}