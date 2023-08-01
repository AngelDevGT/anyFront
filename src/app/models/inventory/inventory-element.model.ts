import { Status } from "../auxiliary/status.model";
import { RawMaterialBase } from "../raw-material/raw-material-base.model";
import { RawMaterialByProvider } from "../raw-material/raw-material-by-provider.model";
import { User } from "../user.model";

export class InventoryElement {
    _id?: string;
    rawMaterialByProvider?: RawMaterialByProvider;
    rawMaterialBase?: RawMaterialBase;
    quantity?: string;
    status?: Status;
    creatorUser?: User;
    creationDate?: string;
    updateDate?: string;
}