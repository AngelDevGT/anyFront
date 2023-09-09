import { Measure } from "../auxiliary/measure.model";
import { RawMaterialByProvider } from "./raw-material-by-provider.model";

export class RawMaterialOrderElement {
    _id?: string;
    rawMaterialByProvider?: RawMaterialByProvider;
    measure?: Measure;
    quantity?: string;
    price?: string;
    discount?: string;
    subtotalPrice?: string;
    totalDiscount?: string;
    totalPrice?: string;
    date?: string;
}