import { Measure } from "../auxiliary/measure.model";
import { FinishedProductCreationElement } from "./finished-product-creation-element.model";

export class FinishedProductCreation {
    destinyFinishedProductInventoryID?: string;
    originRawMaterialInventoryID?: string;
    finishedProductCreatedID?: string;
    measure?: Measure;
    quantity?: string;
    rawMaterialList?: FinishedProductCreationElement[];
}