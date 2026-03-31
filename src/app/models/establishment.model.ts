import { Status } from "./auxiliary/status.model";
import { User } from "./system/user.model";

export class Establishment {
    id?: string;
    name?: string;
    address?: string;
    description?: string;
    receivePendingOrdersEnabled?: boolean;
    creationDate?: string; //sistema
    updatedDate?: string; //sistema
    creatorUser?: User; //sistema
    status?: Status;
}