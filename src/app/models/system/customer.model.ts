import { Status } from "../auxiliary/status.model";
import { User } from "./user.model";

export class Customer {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
    nit?: string;
    status?: Status;
    creatorUser?: User;
    creationDate?: string;
    updatedDate?: string;
}
