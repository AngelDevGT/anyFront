import { PaymentStatus } from "../auxiliary/payment-status.model";
import { PaymentType } from "../auxiliary/payment-type.model";
import { Status } from "../auxiliary/status.model";
import { Provider } from "../system/provider.model";
import { User } from "../system/user.model";
import { RawMaterialOrderElement } from "./raw-material-order-element.model";
import { RawMaterialOrderPayment } from "./raw-material-order-payment.model";

export class RawMaterialOrder {
    _id?: string;
    rawMaterialOrderElements?: RawMaterialOrderElement[];
    rawMaterialOrderPayments?: RawMaterialOrderPayment[];
    name?: string;
    comment?: string;
    provider?: Provider;
    status?: Status;
    paymentStatus?: PaymentStatus;
    paymentType?: PaymentType;
    finalAmount?: string;
    paidAmount?: string;
    pendingAmount?: string;
    creatorUser?: User;
    creationDate?: string;
    updateDate?: string;
}