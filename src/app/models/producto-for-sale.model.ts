export class ProductForSale {
    _id?: string;
    name?: string;
    measure?: string; //Peso o unidad
    price?: number;
    pricePerDozen?: number;
    photo?: string;
    establishment?: string;
    status?: number;
    creationDate?: string; //sistema
    updateDate?: string; //sistema
    applyDate?: string;
    creatorUser?: string; //sistema
}