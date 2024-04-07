import { Measure } from "../auxiliary/measure.model";
import { ProductForSale } from "../product/producto-for-sale.model";

export interface ItemsList {
  price?: string;
  subtotal?: string;
  total?: string;
  totalDiscount?: string;
  productForSale?: ProductForSale;
  quantity?: string;
  measure?: Measure;
  discount?: string;
}