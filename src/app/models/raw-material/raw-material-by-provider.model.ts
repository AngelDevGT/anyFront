import { Status } from "../auxiliary/status.model";
import { Provider } from "../system/provider.model";
import { User } from "../user.model";
import { RawMaterialBase } from "./raw-material-base.model";

export class RawMaterialByProvider {
    _id?: string;
    rawMaterialBase?: RawMaterialBase;
    price?: string;
    provider?: Provider;
    status?: Status;
    creatorUser?: User;
    creationDate?: string;
    updateDate?: string;
}