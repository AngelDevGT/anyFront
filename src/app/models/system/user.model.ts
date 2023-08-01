import { Status } from "../auxiliary/status.model";
import { Role } from "../auxiliary/role.model";

export class User {
    _id?: string;
    name?: string;
    role?: Role;
    email?: string;
    phone?: string;
    status?: Status;
    creationDate?: string;
    updateDate?: string;
}