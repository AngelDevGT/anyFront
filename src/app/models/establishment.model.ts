import { Status } from "./auxiliary/status.model";
import { User } from "./system/user.model";

export class Establishment {
    _id?: string;
    name?: string;
    address?: string;
    description?: string;
    creationDate?: string; //sistema
    updateDate?: string; //sistema
    creatorUser?: User; //sistema
    status?: Status;
}