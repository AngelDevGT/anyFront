import { Status } from "../auxiliary/status.model";
import { User } from "../user.model";

export class FinishedProduct {
    _id?: string;
    name?: string;
    description?: string;
    measure?: string;
    photo?: string;
    status?: Status;
    creatorUser?: User;
    creationDate?: string;
    updateDate?: string;
}