import { Status } from "../auxiliary/status.model";
import { Role } from "../auxiliary/role.model";

export class User {
    id?: string;
    ext_id?: string;
    uuid?: string;
    name?: string;
    role?: Role;
    email?: string;
    phone?: string;
    status?: Status;
    creationDate?: string;
    updatedDate?: string;
}