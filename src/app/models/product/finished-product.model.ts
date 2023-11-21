import { Measure } from "../auxiliary/measure.model";
import { Status } from "../auxiliary/status.model";
import { User } from "../user.model";

export class FinishedProduct {
    _id?: string;
    name?: string;
    description?: string;
    measure?: Measure;
    photo?: string;
    status?: Status;
    creatorUser?: User;
    creationDate?: string;
    updateDate?: string;
}