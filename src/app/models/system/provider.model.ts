import { Status } from "../auxiliary/status.model";
import { User } from "./user.model";

export class Provider {
    id?: string;
    name?: string;
    phone?: string;
    company?: string;
    description?: string;
    email?: string;
    status?: Status;
    creatorUser?: User;
    creationDate?: string;
    updatedDate?: string;
}