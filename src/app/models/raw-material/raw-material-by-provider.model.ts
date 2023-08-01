import { Status } from "../auxiliary/status.model";
import { Provider } from "../provider.model";
import { User } from "../user.model";
import { RawMaterialBase } from "./raw-material-base.model";

export class RawMaterialByProvider {
    _id?: string;
    rawMaterialBase?: RawMaterialBase;
    price?: string;
    providerId?: Provider;
    status?: Status;
    creatorUser?: User;
    creationDate?: string;
    updateDate?: string;
}