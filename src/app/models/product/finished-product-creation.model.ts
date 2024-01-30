import { Measure } from "../auxiliary/measure.model";
import { FinishedProductCreationConsumedElement } from "./fp-creation-consumed-element.model";
import { FinishedProductCreationProducedElement } from "./fp-creation-produced-element.model";

export class FinishedProductCreation {
    destinyFinishedProductInventoryID?: string;
    originRawMaterialInventoryID?: string;
    rawMaterialList?: FinishedProductCreationConsumedElement[];
    finishedProductList?: FinishedProductCreationProducedElement[];
}