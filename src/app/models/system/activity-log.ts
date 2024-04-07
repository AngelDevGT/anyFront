import { User } from "./user.model";

export class ActivityLog {
    _id?: string;
    action?: string;
    section?: string;
    status?: string;
    request?: any;
    response?: any;
    extra?: any;
    description?: string;
    creationDate?: string;
    user?: User;
}