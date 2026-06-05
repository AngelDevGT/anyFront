import { Status } from '../auxiliary/status.model';
import { Establishment } from '../establishment.model';
import { User } from '../system/user.model';

export interface StoreExpense {
    id?: string;
    title?: string;
    comment?: string;
    totalAmount?: number | string;
    nit?: string;
    supplier?: string;
    establishment?: Establishment;
    establishmentId?: string | number;
    status?: Status;
    creatorUser?: User;
    creationDate?: string;
    updatedDate?: string;
}
