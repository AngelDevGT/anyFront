import { Status } from "../auxiliary/status.model";
import { User } from "../user.model";

export class Utensil {
    _id?: string;
    name?: string;
    description?: string;
    price?: string;
    status?: Status;
    creatorUser?: User;
    creationDate?: string;
    updateDate?: string;
}