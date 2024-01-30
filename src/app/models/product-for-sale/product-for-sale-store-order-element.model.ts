import { Measure } from "../auxiliary/measure.model";
import { ProductForSale } from "../product/producto-for-sale.model";

export class ProductForSaleStoreOrderElement {
    _id?: string;
    productForSale?: ProductForSale;
    measure?: Measure;
    quantity?: string;
    price?: string;
    totalPrice?: string;
    date?: string;
}