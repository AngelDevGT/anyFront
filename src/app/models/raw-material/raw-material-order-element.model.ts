import { RawMaterialByProvider } from "./raw-material-by-provider.model";

export class RawMaterialOrderElement {
    _id?: string;
    rawMaterialByProvider?: RawMaterialByProvider;
    quantity?: string;
    price?: string;
    discount?: string;
    date?: string;
}