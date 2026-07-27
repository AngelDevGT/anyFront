import { Measure } from "../auxiliary/measure.model";
import { Status } from "../auxiliary/status.model";
import { User } from "../system/user.model";

export class FinishedProduct {
    id?: string;
    name?: string;
    description?: string;
    measure?: Measure;
    photo?: string;
    thumb?: string;
    status?: Status;
    creatorUser?: User;
    creationDate?: string;
    updatedDate?: string;
    finishedProductTypeId?: number;
    sortOrder?: number;
}