import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '@environments/enviroment';
import { Measure, Role } from '@app/models';
import { Establishment } from '@app/models/establishment.model';
import { ProductForSale } from '@app/models/product/producto-for-sale.model';
import { Provider } from '@app/models/system/provider.model';
import { RawMaterialBase } from '@app/models/raw-material/raw-material-base.model';
import { RawMaterialByProvider } from '@app/models/raw-material/raw-material-by-provider.model';
import { FinishedProduct } from '@app/models/product/finished-product.model';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import { MovementWarehouseToFactory } from '@app/models/inventory/movement-store-to-factory.model';
import { FinishedProductCreation } from '@app/models/product/finished-product-creation.model';
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { AccountService } from '../account.service';
import { AddRawMaterialOrderPaymentHistory } from '@app/models/raw-material/add-raw-material-order-payment-history.model';
import { ActivityLog } from '@app/models/system/activity-log';
import { CashClosing } from '@app/models/store/cash-closing.model';
import { ShopResume } from '@app/models/store/shop-resume.model';


export const statusValues = {
    inactivo: {
        status: {
            "id": 1,
            "status": 1,
            "text": "1",
            "identifier": "Inactivo"
        }
    },
    activo: {
        status: {
            "id": 2,
            "status": 1,
            "text": "2",
            "identifier": "Activo"
        }
    },
    eliminado: {
        status: {
            "id": 3,
            "status": 1,
            "text": "3",
            "identifier": "Eliminado"
        }
    },
    pendiente: {
        status: {
            "id": 4,
            "status": 1,
            "text": "4",
            "identifier": "Pendiente"
        }
    },
    en_curso: {
        status: {
            "id": 5,
            "status": 1,
            "text": "5",
            "identifier": "En curso"
        }
    },
    listo: {
        status: {
            "id": 6,
            "status": 1,
            "text": "6",
            "identifier": "Listo"
        }
    },
    recibido: {
        status: {
            "id": 7,
            "status": 1,
            "text": "7",
            "identifier": "Recibido"
        }
    },
    cancelado: {
        status: {
            "id": 8,
            "status": 1,
            "text": "8",
            "identifier": "Cancelado"
        }
    },
    entregado: {
        status: {
            "id": 9,
            "status": 1,
            "text": "9",
            "identifier": "Entregado"
        }
    },
    verificado: {
        status: {
            "id": 10,
            "status": 1,
            "text": "10",
            "identifier": "Verificado"
        }
    },
    devuelto: {
        status: {
            "id": 11,
            "status": 1,
            "text": "11",
            "identifier": "Devuelto"
        }
    }
}

export const paymentStatusValues = {
    pendiente: {
        paymentStatus: {
            "id": 1,
            "status": 1,
            "text": "1",
            "identifier": "Pendiente"
        }
    },
    abonado: {
        paymentStatus: {
            "id": 2,
            "status": 1,
            "text": "2",
            "identifier": "Abonado"
        }
    },
    pagado: {
        paymentStatus: {
            "id": 3,
            "status": 1,
            "text": "3",
            "identifier": "Pagado"
        }
    },
}

export const storeOrderStatus = {
    pendiente: {
        "text": "1",
        "identifier": "Pendiente",
        "id": 1,
        "status": 1,
        "bg_color": "#5d6d7e",
        "color": "#fdfefe"
      },
    en_camino:{
        "id": 2,
        "status": 1,
        "text": "2",
        "identifier": "En camino",
        "bg_color": "#f1c40f",
        "color": "#17202a"
      },
    recibido: {
        "id": 3,
        "status": 1,
        "text": "3",
        "identifier": "Recibido",
        "bg_color": "#229954",
        "color": "#fdfefe"
      },
    cancelado: {
        "id": 4,
        "status": 1,
        "text": "4",
        "identifier": "Cancelado",
        "bg_color": "#c0392b",
        "color": "#fdfefe"
      },
    eliminado: {
        "id": 5,
        "status": 1,
        "text": "5",
        "identifier": "Eliminado",
        "bg_color": "#c0392b",
        "color": "#fdfefe"
      },
    devuelto: {
        "id": 6,
        "status": 1,
        "text": "6",
        "identifier": "Devuelto",
        "bg_color": "#d35400",
        "color": "#fdfefe"
      },
    listo: {
        "id": 7,
        "status": 1,
        "text": "7",
        "identifier": "Listo",
        "bg_color": "#3498db",
        "color": "#fdfefe"
      },
    entregado: {
        "id": 8,
        "status": 1,
        "text": "8",
        "identifier": "Entregado",
        "bg_color": "#229954",
        "color": "#fdfefe"
      }
}

export const activeStatus = {
    status: {
        "id": 2,
        "status": 1,
        "text": "2",
        "identifier": "Activo"
    }
};

export const deleteStatus = {
    status: {
        "id": 3,
        "status": 1,
        "text": "3",
        "identifier": "Eliminado"
    }
}

export const verifyStatus = {
    status: {
        "id": 10,
        "status": 1,
        "text": "10",
        "identifier": "Verificado"
    }
}

export const pendingPaymentStatus = {
    paymentStatus: {
        "id": 1,
        "status": 1,
        "text": "1",
        "identifier": "Pendiente"
    }
}

export const abonadoPaymentStatus = {
    paymentStatus: {
        "id": 2,
        "status": 1,
        "text": "2",
        "identifier": "Abonado"
    }
}

export const paidPaymentStatus = {
    paymentStatus: {
        "id": 3,
        "status": 1,
        "text": "3",
        "identifier": "Pagado"
    }
}

export const pendingStoreStatus = {
    "storeStatus": {
        "text": "1",
        "identifier": "Pendiente",
        "id": 1,
        "status": 1
    }
}

export const pendingFactoryStatus = {
    "factoryStatus": {
        "text": "1",
        "identifier": "Pendiente",
        "id": 1,
        "status": 1
    }
}

export const measureUnits = 
    [
        {
          "text": "1",
          "identifier": "Unidad",
          "id": 1,
          "status": 1,
          "unitBase": {
            "quantity": 1,
            "name": "Unidad",
            "parent": "1"
          }
        },
        {
          "id": 2,
          "status": 1,
          "text": "2",
          "identifier": "Docena",
          "unitBase": {
            "quantity": 12,
            "name": "Unidad",
            "parent": "1"
          }
        },
        {
          "id": 3,
          "status": 1,
          "text": "3",
          "identifier": "Quincena",
          "unitBase": {
            "quantity": 15,
            "name": "Unidad",
            "parent": "1"
          }
        },
        {
          "id": 4,
          "status": 1,
          "text": "4",
          "identifier": "Cajilla",
          "unitBase": {
            "quantity": 240,
            "name": "Unidad",
            "parent": "1"
          }
        },
        {
          "id": 5,
          "status": 1,
          "text": "5",
          "identifier": "Onza",
          "unitBase": {
            "quantity": 0.0625,
            "name": "Libra",
            "parent": "6"
          }
        },
        {
          "id": 6,
          "status": 1,
          "text": "6",
          "identifier": "Libra",
          "unitBase": {
            "quantity": 1,
            "name": "Libra",
            "parent": "6"
          }
        },
        {
          "id": 7,
          "status": 1,
          "text": "7",
          "identifier": "Arroba",
          "unitBase": {
            "quantity": 25,
            "name": "Libra",
            "parent": "6"
          }
        },
        {
          "id": 8,
          "status": 1,
          "text": "8",
          "identifier": "Quintal",
          "unitBase": {
            "quantity": 100,
            "name": "Libra",
            "parent": "6"
          }
        }
    ]


@Injectable({ providedIn: 'root' })
export class DataService {

    constructor( private router: Router, private http: HttpClient, private accountService: AccountService ) {
    }

    /** PRODUCTS **/

    getAllProducts() {
        let params = JSON.stringify({findProduct: {}});
        return this.http.post(`${environment.apiUrl}/retrieveProducts`, params);
    }


    getAllProductsByFilter(params: any) {
        let parameters = JSON.stringify({
            findProduct: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/retrieveProducts`, parameters);
    }

    getProductById(id: string) {
        let params = JSON.stringify({getProduct: { "_id": id}});
        return this.http.post(`${environment.apiUrl}/getProduct`, params);
    }

    // addProduct(product: ProductForSale, productImg: string){
    //     product.photo = productImg;
    //     if (productImg === ""){
    //         delete product.photo;
    //     }
    //     product.creatorUser = " ";
    //     let params = JSON.stringify({
    //         addProduct: {
    //             ...product,
    //         }});
    //     return this.http.post(`${environment.apiUrl}/addProduct`, params);
    // }

    // updateProduct(id: string, product: ProductForSale, productImg: string){
    //     if (productImg !== ""){
    //         product.photo = productImg;
    //     }
    //     product._id = id;
    //     let params = JSON.stringify({
    //         updateProduct: {
    //             ...product,
    //         }});
    //     return this.http.post(`${environment.apiUrl}/updateProduct`, params);
    // }

    deleteProduct(params: any) {
        let deleteUser = JSON.stringify({
            updateProduct: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/updateProduct`, deleteUser);
    }

    /** ESTABLISHMENT */

    getAllEstablishments() {
        let params = JSON.stringify({findEstablishment: {}});
        return this.http.post(`${environment.apiUrl}/retrieveEstablishments`, params);
    }


    getAllEstablishmentsByFilter(params: any) {
        let parameters = JSON.stringify({
            findProduct: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/retrieveEstablishments`, parameters);
    }

    getEstablishmentById(id: string) {
        let params = JSON.stringify({getEstablishment: { "_id": id}});
        return this.http.post(`${environment.apiUrl}/getEstablishment`, params);
    }

    getShortEstablishmentInfo(establishment: Establishment){
        return establishment.name + " (" + establishment.address + ")";
    }

    addEstablishment(establishment: Establishment){
        let params = JSON.stringify({
            addEstablishment: {
                ...establishment,
                ...statusValues.activo,
                creatorUser: this.accountService.userValueFixed,
            }});
        return this.http.post(`${environment.apiUrl}/addEstablishment`, params);
    }

    updateEstablishment(id: string, establishment: Establishment){
        let params = JSON.stringify({
            updateStablishment: {
                "_id": id,
                ...establishment
            }});
        return this.http.post(`${environment.apiUrl}/updateStablishment`, params);
    }

    deleteEstablishment(params: any) {
        let deleteUser = JSON.stringify({
            updateStablishment: {
                ...params,
                ...statusValues.eliminado
            }});
        return this.http.post(`${environment.apiUrl}/updateStablishment`, deleteUser);
    }

    /** PROVIDERS */

    getAllProviders() {
        let params = JSON.stringify({retrieveProvider: {}});
        return this.http.post(`${environment.apiUrl}/retriveProviders`, params);
    }


    getAllProvidersByFilter(params: any) {
        let parameters = JSON.stringify({
            retrieveProvider: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/retriveProviders`, parameters);
    }

    getProviderById(id: string) {
        let params = JSON.stringify({getProvider: { "_id": id}});
        return this.http.post(`${environment.apiUrl}/getProvider`, params);
    }

    addProvider(provider: Provider){
        let params = JSON.stringify({
            addProvider: {
                ...provider,
                ...activeStatus,
                creatorUser: this.accountService.userValueFixed,
            }});
        return this.http.post(`${environment.apiUrl}/addProvider`, params);
    }

    updateProvider(id: string, provider: Provider){
        let params = JSON.stringify({
            updateProvider: {
                "_id": id,
                ...provider
            }});
        return this.http.post(`${environment.apiUrl}/updateProvider`, params);
    }

    deleteProvider(params: any) {
        let deleteUser = JSON.stringify({
            updateProvider: {
                ...params,
                ...deleteStatus
            }});
        return this.http.post(`${environment.apiUrl}/updateProvider`, deleteUser);
    }

    /** PRICE */

    getFormatedPrice(price: number){
        return "Q. " + price.toFixed(2);
    }

    getDecimalFromText(num?: string){
        return (Number(num) || 0).toFixed(2);
    }


    /** IMAGE */

    uploadImage(imageFile: File) {
        const formData = new FormData();
        formData.append('image', imageFile, imageFile.name);
        formData.append('imageName', imageFile.name);
    
        const headers = new HttpHeaders({
          'enctype': 'multipart/form-data'
        });
    
        return this.http.post(`${environment.apiUrl}/ImageUpload`, formData, { headers });
    }

    getImageById(id: string) {
        let params = JSON.stringify({getImage: { "_id": id}});
        return this.http.post(`${environment.apiUrl}/getImage`, params);
    }

    getImageWithURL(imgName: string) {
        if(imgName !== ""){
            return "https://storageembutidosany.blob.core.windows.net/image-container/" + imgName;
        }
        return undefined;
    }

    /** STATUS */

    getStatusByNumber(id: number){
        return id == 0 ? "Inactivo" : id == 1 ? "Activo" : id == 2 ? "Eliminado" : "Sin definir";
    }

    /** DATE */
    
    getLocalDateTimeFromUTCTime(utcTime: string){
        let date = new Date(utcTime.replaceAll("\"",""));
        return date.toLocaleString().replace(",", " ");
    }

    getLocalDateFromUTCTime(utcTime: string){
        let date = new Date(utcTime.replaceAll("\"",""));
        return date.toLocaleString().split(",")[0];
        // return date.toJSON().slice(0, 10);
    }

    /** MEASURE */

    getMeasureByName(measure: string){
        if(measure == "unit")
            return "Unidades"
        if(measure == "onz")
            return "Onzas"
        return "Sin Definir"
    }

    getConvertedMeasureById(quantity: number, measureId?: number){
        let foundMeasure = measureUnits.find(x => x.id == measureId);
        return foundMeasure ? (quantity / foundMeasure.unitBase.quantity).toFixed(2)  : quantity;

    }

    getConvertedMeasure(quantity: number, unitMeasure?: Measure, weightMeasure?: Measure, prevMeasure?: Measure){
        if(prevMeasure?.unitBase?.name == unitMeasure?.unitBase?.name){
            return (quantity / (Number(unitMeasure?.unitBase!.quantity) || 1)).toFixed(2);
        }
        if(prevMeasure?.unitBase?.name == weightMeasure?.unitBase?.name){
            return (quantity / (Number(weightMeasure?.unitBase!.quantity) || 1)).toFixed(2);
        }
        return quantity;
    }

    getConvertedMeasureName(unitMeasure?: Measure, weightMeasure?: Measure, prevMeasure?: Measure){
        if(prevMeasure?.unitBase?.name == unitMeasure?.unitBase?.name)
            return unitMeasure?.identifier;
        if(prevMeasure?.unitBase?.name == weightMeasure?.unitBase?.name)
            return weightMeasure?.identifier;
        return prevMeasure?.identifier;
    }

    /** VALIDATION */

    isAdmin(role: Role){
        role.id === "1";
    }

    /** CONSTANTES */

    getAllConstants() {
        let params = JSON.stringify({retrieveCatalogGeneric: {}});
        return this.http.post(`${environment.apiUrl}/retrieveGenericCatalog`, params);
    }


    getAllConstantsByFilter(params: any) {
        let parameters = JSON.stringify({
            retrieveCatalogGeneric: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/retrieveGenericCatalog`, parameters);
    }

    /** RAW MATERIAL BASE */

    getAllRawMaterials() {
        let params = JSON.stringify({retrieveRawMaterial: {}});
        return this.http.post(`${environment.apiUrl}/retrieveRawMaterial`, params);
    }


    getAllRawMaterialsByFilter(params: any) {
        let parameters = JSON.stringify({
            retrieveRawMaterial: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/retrieveRawMaterial`, parameters);
    }

    getRawMaterialById(id: string) {
        let params = JSON.stringify({getRawMaterial: { "_id": id}});
        return this.http.post(`${environment.apiUrl}/getRawMaterial`, params);
    }

    addRawMaterial(rawMaterial: RawMaterialBase, img?: string){
        rawMaterial.photo = img;
        if (!img){
            delete rawMaterial.photo;
        }
        let params = JSON.stringify({
            addRawMaterial: {
                ...rawMaterial,
                ...activeStatus,
                creatorUser: this.accountService.userValueFixed,
            }});
        return this.http.post(`${environment.apiUrl}/addRawMaterial`, params);
    }

    updateRawMaterial(id: string, rawMaterial: RawMaterialBase, img?: string){
        rawMaterial.photo = img;
        if (!img){
            rawMaterial.photo = "";
        }
        let params = JSON.stringify({
            updateRawMaterial: {
                "_id": id,
                ...rawMaterial
            }});
        return this.http.post(`${environment.apiUrl}/UpdateRawMaterial`, params);
    }

    deleteRawMaterial(params: any) {
        let deleteUser = JSON.stringify({
            updateRawMaterial: {
                ...params,
                ...deleteStatus
            }});
        return this.http.post(`${environment.apiUrl}/UpdateRawMaterial`, deleteUser);
    }

    /** RAW MATERIAL BY PROVIDER */

    getAllRawMaterialsByProvider() {
        let params = JSON.stringify({retrieveRawMaterialByProvider: {}});
        return this.http.post(`${environment.apiUrl}/retrieveRawMaterialByProvider`, params);
    }


    getAllRawMaterialsByProviderByFilter(params: any) {
        let parameters = JSON.stringify({
            retrieveRawMaterialByProvider: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/retrieveRawMaterialByProvider`, parameters);
    }

    getRawMaterialByProviderById(id: string) {
        let params = JSON.stringify({getRawMaterialByProvider: { "_id": id}});
        return this.http.post(`${environment.apiUrl}/getRawMaterialByProvider`, params);
    }

    addRawMaterialByProvider(rawMaterial: RawMaterialByProvider){
        let params = JSON.stringify({
            addRawMaterialByProvider: {
                ...rawMaterial,
                ...activeStatus,
                creatorUser: this.accountService.userValueFixed,
            }});
        return this.http.post(`${environment.apiUrl}/AddRawMaterialByProvider`, params);
    }

    updateRawMaterialByProvider(id: string, rawMaterial: RawMaterialByProvider){
        let params = JSON.stringify({
            updateRawMaterialByProvider: {
                "_id": id,
                ...rawMaterial
            }});
        return this.http.post(`${environment.apiUrl}/updateRawMaterialByProvider`, params);
    }

    deleteRawMaterialByProvider(params: any) {
        let deleteUser = JSON.stringify({
            updateRawMaterialByProvider: {
                ...params,
                ...deleteStatus
            }});
        return this.http.post(`${environment.apiUrl}/updateRawMaterialByProvider`, deleteUser);
    }

    /** FINISHED PRODUCT */

    getAllFinishedProduct() {
        let params = JSON.stringify({retrieveFinishedProduct: {}});
        return this.http.post(`${environment.apiUrl}/retrieveFinishedProduct`, params);
    }


    getAllFinishedProductByFilter(params: any) {
        let parameters = JSON.stringify({
            retrieveFinishedProduct: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/retrieveFinishedProduct`, parameters);
    }

    getFinishedProductById(id: string) {
        let params = JSON.stringify({getFinishedProduct: { "_id": id}});
        return this.http.post(`${environment.apiUrl}/getFinishedProduct`, params);
    }

    addFinishedProduct(product: FinishedProduct, img?: string){
        product.photo = img;
        if (img === ""){
            delete product.photo;
        }
        let params = JSON.stringify({
            addFinishedProduct: {
                ...product,
                ...activeStatus,
                creatorUser: this.accountService.userValueFixed,
            }});
        return this.http.post(`${environment.apiUrl}/addFinishedProduct`, params);
    }

    updateFinishedProduct(id: string, product: FinishedProduct, img?: string){
        product.photo = img;
        if(!img){
            product.photo = "";
        }
        let params = JSON.stringify({
            updateFinishedProduct: {
                "_id": id,
                ...product
            }});
        return this.http.post(`${environment.apiUrl}/updateFinishedProduct`, params);
    }

    deleteFinishedProduct(params: any) {
        let deleteUser = JSON.stringify({
            updateFinishedProduct: {
                ...params,
                ...deleteStatus
            }});
        return this.http.post(`${environment.apiUrl}/updateFinishedProduct`, deleteUser);
    }

    /** RAW MATERIAL ORDER */

    getAllRawMaterialOrder() {
        let params = JSON.stringify({retrieveRawMaterialOrder: {}});
        return this.http.post(`${environment.apiUrl}/retrieveRawMaterialOrder`, params);
    }


    getAllRawMaterialOrderByFilter(params: any) {
        let parameters = JSON.stringify({
            retrieveRawMaterialOrder: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/retrieveRawMaterialOrder`, parameters);
    }

    getRawMaterialOrderById(id: string) {
        let params = JSON.stringify({getRawMaterialOrder: { "_id": id}});
        return this.http.post(`${environment.apiUrl}/getRawMaterialOrder`, params);
    }

    addRawMaterialOrder(rmOrder: RawMaterialOrder){
        let params = JSON.stringify({
            addRawMaterialOrder: {
                ...rmOrder,
                ...pendingPaymentStatus,
                ...activeStatus,
                creatorUser: this.accountService.userValueFixed,
            }});
        return this.http.post(`${environment.apiUrl}/addRawMaterialOrder`, params);
    }

    updateRawMaterialOrder(rmOrder: RawMaterialOrder){
        let params = JSON.stringify({
            updateRawMaterialOrder: {
                ...rmOrder
            }});
        return this.http.post(`${environment.apiUrl}/updateRawMaterialOrder`, params);
    }

    addRawMaterialOrderPaymentHistory(rmOrderHistory: AddRawMaterialOrderPaymentHistory){
        let params = JSON.stringify({
            addRawMaterialOrderPaymentHistory: {
                ...rmOrderHistory
            }});
        return this.http.post(`${environment.apiUrl}/addRawMaterialOrderPaymentHistory`, params);
    }

    verifyRawMaterialOrder(orderId: string){
        let params = JSON.stringify({
            verifyRawMaterialOrder: {
                rawMaterialOrderID: orderId,
            }});
        return this.http.post(`${environment.apiUrl}/verifyRawMaterialOrder`, params);
    }

    deleteRawMaterialOrder(params: any) {
        let deleteOrder = JSON.stringify({
            updateRawMaterialOrder: {
                ...params,
                ...deleteStatus
            }});
        return this.http.post(`${environment.apiUrl}/updateRawMaterialOrder`, deleteOrder);
    }

    /** MOVEMENT */
    
    moveStoreToFactory(movement: MovementWarehouseToFactory){
        let params = JSON.stringify({
            moveStoreToFactory: {
                ...movement
            }});
        return this.http.post(`${environment.apiUrl}/MoveStoreToFactory`, params);
    }

    /** INVENTORY */

    getAllInventoryByFilter(params: any) {
        let parameters = JSON.stringify({
            retrieveInventory: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/retrieveInventory`, parameters);
    }

    getInventory(params: any) {
        let parameters = JSON.stringify({
            getInventory: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/getInventory`, parameters);
    }

    updateInventoryElement(params: any) {
        let parameters = JSON.stringify({
            updateInventoryElement: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/UpdateInventoryElement`, parameters);
    }

    /** PRODUCT CREATION */
    
    registerFinishedProductCreation(fpCreation: FinishedProductCreation){
        let params = JSON.stringify({
            registerFinishedProductCreation: {
                ...fpCreation
            }});
        return this.http.post(`${environment.apiUrl}/registerFinishedProductCreation`, params);
    }

    /** PRODUCT FOR SALE */
    getAllProductForSale() {
        let params = JSON.stringify({getProductForSale: {}});
        return this.http.post(`${environment.apiUrl}/retrieveProductsForSale`, params);
    }


    getAllProductForSaleByFilter(params: any) {
        let parameters = JSON.stringify({
            retrieveProductForSale: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/retrieveProductsForSale`, parameters);
    }

    getProductForSaleById(id: string) {
        let params = JSON.stringify({getProductForSale: { "_id": id}});
        return this.http.post(`${environment.apiUrl}/getProductForSale`, params);
    }

    addProductForSale(product: ProductForSale){
        let params = JSON.stringify({
            addProductForSale: {
                ...product,
                ...activeStatus,
                creatorUser: this.accountService.userValueFixed,
            }});
        return this.http.post(`${environment.apiUrl}/AddProductForSale`, params);
    }

    addMultiProductForSale(products: ProductForSale[]){
        for (let i = 0; i < products.length; i++) {
            products[i].status = activeStatus.status;
            products[i].creatorUser = this.accountService.userValueFixed;
        }
        let params = JSON.stringify({
            addManyProductForSale:
                products
            });
        return this.http.post(`${environment.apiUrl}/addManyProductForSale`, params);
    }

    updateProductForSale(id: string, product: ProductForSale){
        let params = JSON.stringify({
            updateProductForSale: {
                "_id": id,
                ...product
            }});
        return this.http.post(`${environment.apiUrl}/updateProductForSale`, params);
    }

    deleteProductForSale(params: any) {
        let deleteUser = JSON.stringify({
            updateProductForSale: {
                ...params,
                ...deleteStatus
            }});
        return this.http.post(`${environment.apiUrl}/updateProductForSale`, deleteUser);
    }

    /** PRODUCT FOR SALE ORDER */

    getAllProducForSaleOrder() {
        let params = JSON.stringify({retrieveProductForSaleStoreOrder: {}});
        return this.http.post(`${environment.apiUrl}/retrieveProductForSaleStoreOrder`, params);
    }


    getAllProductForSaleOrderByFilter(params: any) {
        let parameters = JSON.stringify({
            retrieveProductForSaleStoreOrder: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/retrieveProductForSaleStoreOrder`, parameters);
    }

    getProductForSaleOrderById(id: string) {
        let params = JSON.stringify({getProductForSaleStoreOrder: { "_id": id}});
        return this.http.post(`${environment.apiUrl}/getProductForSaleStoreOrder`, params);
    }

    addProductForSaleOrder(pfsOrder: ProductForSaleStoreOrder){
        let params = JSON.stringify({
            addProductForSaleStoreOrder: {
                ...pfsOrder,
                ...pendingStoreStatus,
                ...pendingFactoryStatus,
                creatorUser: this.accountService.userValueFixed,
            }});
        return this.http.post(`${environment.apiUrl}/addProductForSaleStoreOrder`, params);
    }

    updateProductForSaleOrder(pfsOrder: ProductForSaleStoreOrder){
        let params = JSON.stringify({
            updateProductForSaleStoreOrder: {
                ...pfsOrder
            }});
        return this.http.post(`${environment.apiUrl}/updateProductForSaleStoreOrder`, params);
    }

    manageProductForSaleOrderStateReady(pfsOrder: ProductForSaleStoreOrder){
        let params = JSON.stringify({
            manageProductForSaleStoreOrder: {
                ...pfsOrder,
                storeStatus: storeOrderStatus.listo,
                factoryStatus: storeOrderStatus.listo
            }});
        return this.http.post(`${environment.apiUrl}/manageProductForSaleStoreOrder`, params);
    }

    manageProductForSaleOrderStateReceived(pfsOrder: ProductForSaleStoreOrder){
        let params = JSON.stringify({
            manageProductForSaleStoreOrder: {
                ...pfsOrder,
                storeStatus: storeOrderStatus.recibido,
                factoryStatus: storeOrderStatus.entregado
            }});
        return this.http.post(`${environment.apiUrl}/manageProductForSaleStoreOrder`, params);
    }

    manageProductForSaleOrderStateReturned(pfsOrder: ProductForSaleStoreOrder){
        let params = JSON.stringify({
            manageProductForSaleStoreOrder: {
                ...pfsOrder,
                storeStatus: storeOrderStatus.devuelto,
                factoryStatus: storeOrderStatus.devuelto
            }});
        return this.http.post(`${environment.apiUrl}/manageProductForSaleStoreOrder`, params);
    }

    verifyProductForSaleOrder(orderId: string){
        let params = JSON.stringify({
            verifyRawMaterialOrder: {
                rawMaterialOrderID: orderId,
            }});
        return this.http.post(`${environment.apiUrl}/verifyRawMaterialOrder`, params);
    }

    deleteProductForSaleOrder(params: any) {
        let deleteOrder = JSON.stringify({
            updateProductForSaleStoreOrder: {
                ...params,
                storeStatus: storeOrderStatus.eliminado,
                factoryStatus: storeOrderStatus.eliminado,
            }});
        return this.http.post(`${environment.apiUrl}/updateProductForSaleStoreOrder`, deleteOrder);
    }

    /** SALES */
    getShopHistory(params: any) {
        let parameters = JSON.stringify({
            retrieveShopHistory: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/RetrieveShopHistory`, parameters);
    }

    registerShop(params: any) {
        let parameters = JSON.stringify({
            inventoryID: "65bf467e008f7e88678d3927",
            RegisterShop: {
                ...params,
                creatorUser: this.accountService.userValueFixed
            }});
        return this.http.post(`${environment.apiUrl}/registerShop`, parameters);
    }

    updateShopHistory(params: any) {
        let updateShopHistory = JSON.stringify({
            updateShopHistory: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/UpdateShopHistory`, updateShopHistory);
    }

    deleteShopHistory(params: any) {
        let deleteShopHistory = JSON.stringify({
            updateShopHistory: {
                ...params,
                ...statusValues.eliminado
            }});
        return this.http.post(`${environment.apiUrl}/UpdateShopHistory`, deleteShopHistory);
    }

    cancelShop(params: any) {
        let cancelShopRegister = JSON.stringify({
            cancelShopRegister: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/cancelShop`, cancelShopRegister);
    }

    /** LOGS */

    getAllActivityLogs() {
        let params = JSON.stringify({retrieveActivityLog: {}});
        return this.http.post(`${environment.apiUrl}/retrieveActivityLogs`, params);
    }


    getAllActivityLogsByFilter(params: any) {
        let parameters = JSON.stringify({
            retrieveActivityLog: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/retrieveActivityLogs`, parameters);
    }

    addActivityLog(actLog: ActivityLog){
        let params = JSON.stringify({
            addActivityLog: {
                ...actLog,
                user: this.accountService.userValueFixed,
            }});
        return this.http.post(`${environment.apiUrl}/addActivityLog`, params);
    }

    getAllCashClosing() {
        let params = JSON.stringify({retrieveStoreCashClosing: {}});
        return this.http.post(`${environment.apiUrl}/retrieveSotreCashClosing`, params);
    }


    getAllCashClosingByFilter(params: any) {
        let parameters = JSON.stringify({
            retrieveStoreCashClosing: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/retrieveSotreCashClosing`, parameters);
    }

    getCashClosingById(id: string) {
        let params = JSON.stringify({getStoreCashClosing: { "_id": id}});
        return this.http.post(`${environment.apiUrl}/getStoreCashClosing`, params);
    }

    addCashClosing(cashClosing: CashClosing, queryParams?: { [key: string]: any }){
        let body  = JSON.stringify({
            addStoreCashClosing: {
                ...cashClosing,
                ...statusValues.activo,
                userRequest: this.accountService.userValueFixed,
            }});
            
        let params = new HttpParams();
        if (queryParams) {
            Object.keys(queryParams).forEach(key => {
                params = params.append(key, queryParams[key]);
            });
        }
        
        return this.http.post(`${environment.apiUrl}/addStoreCashClosing`, body, { params: params });
    }

    updateCashClosing(id: string, cashClosing: CashClosing){
        let params = JSON.stringify({
            updateStoreCashClosing: {
                "_id": id,
                ...cashClosing
            }});
        return this.http.post(`${environment.apiUrl}/updateStoreCashClosing`, params);
    }

    deleteCashClosing(id: string, cashClosing: CashClosing) {
        let deleteUser = JSON.stringify({
            updateStoreCashClosing: {
                "_id": id,
                ...cashClosing,
                ...deleteStatus
            }});
        return this.http.post(`${environment.apiUrl}/updateStoreCashClosing`, deleteUser);
    }

    verifyCashClosing(id: string, cashClosing: CashClosing) {
        let deleteUser = JSON.stringify({
            updateStoreCashClosing: {
                "_id": id,
                ...cashClosing,
                ...verifyStatus,
                userValidator: this.accountService.userValueFixed,
            }});
        return this.http.post(`${environment.apiUrl}/updateStoreCashClosing`, deleteUser);
    }

}