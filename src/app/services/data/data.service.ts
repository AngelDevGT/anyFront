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

export const establishmentStatusValues = {
    activo: { status: {id: 28}},
    inactivo: { status: {id: 27}},
    eliminado: { status: {id: 29}}
}

export const providerStatusValues = {
    activo: { status: {id: 30}},
    eliminado: { status: {id: 31}}
}

export const rawMaterialStatusValues = {
    activo: { status: {id: 32}},
    eliminado: { status: {id: 33}}
}

export const rawMaterialByProviderStatusValues = {
    activo: { status: {id: 34}},
    eliminado: { status: {id: 35}}
}

export const finishedProductStatusValues = {
    activo: { status: {id: 36}},
    eliminado: { status: {id: 37}}
}

export const rawMaterialOrderStatusValues = {
    activo: { status: {id: 38}},
    eliminado: { status: {id: 43}},
    verificado: { status: {id: 45}}
}

export const productForSaleStatusValues = {
    activo: { status: {id: 50}},
    eliminado: { status: {id: 51}}
}

export const paymentStatusValues = {
    pendiente: { status: {id: 3}},
    abonado: { status: {id: 4}},
    pagado: { status: {id: 5}}
}

export const pfsStoreOrderStatusValues = {
    en_camino: { status: {id: 20}},
    listo: { status: {id: 21}},
    recibido: { status: {id: 22}},
    cancelado: { status: {id: 23}},
    entregado: { status: {id: 25}},
    devuelto: { status: {id: 26}},
    pendiente: { status: {id: 19}},
    eliminado: { status: {id: 24}}
}

export const pfsFactoryOrderStatusValues = {
    en_camino: { status: {id: 1}},
    eliminado: { status: {id: 10}},
    pendiente: { status: {id: 11}},
    en_curso: { status: {id: 12}},
    listo: { status: {id: 13}},
    recibido: { status: {id: 14}},
    cancelado: { status: {id: 15}},
    entregado: { status: {id: 16}},
    verificado: { status: {id: 17}},
    devuelto: { status: {id: 18}}
}

export const actionTypeValues = {
    register_rm_by_order: { actionType: {id: 1}},
    add_rm_manual: { actionType: {id: 2}},
    remove_rm_manual: { actionType: {id: 3}},
    remove_rm_by_consume: { actionType: {id: 4}},
    register_fp_by_creation: { actionType: {id: 5}},
    add_fp_manual: { actionType: {id: 6}},
    remove_fp_manual: { actionType: {id: 7}},
    remove_fp_by_order: { actionType: {id: 8}},
    add_pfs_by_order: { actionType: {id: 11}},
    register_pfs_by_reservation: { actionType: {id: 9}},
    remove_pfs_by_order: { actionType: {id: 10}},
    remove_pfs_manual: { actionType: {id: 13}},
    remove_pfs_by_sale: { actionType: {id: 14}},
    add_fp_by_devolution: { actionType: {id: 15}},
    add_pfs_manual: { actionType: {id: 12}},
    add_pfs_by_cancelation: { actionType: {id: 16}},
    remove_pfs_by_devolution: { actionType: {id: 17}},
    add_fp_by_devolution_from_store: { actionType: {id: 18}}
}

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
        "bg_color": "#aeb6bf",
        "color": "#fff"
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

    export const measureUnitsConst = 
    {
        unidad: 
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
        docena:
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
        quincena:
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
        cajilla:
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
        onza:
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
        libra:
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
        arroba:
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
        quintal:
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
    }


@Injectable({ providedIn: 'root' })
export class DataService {

    readonly tableEntries = [5, 10, 20, 50, 100];
    readonly defaultPageSize = 50;

    constructor( private router: Router, private http: HttpClient, private accountService: AccountService ) {
    }

    /** PRODUCTS **/

    getAllProducts() {
        let params = JSON.stringify({findProduct: {}});
        return this.http.post(`${environment.apiUrlV3}/retrieveProducts`, params);
    }


    getAllProductsByFilter(params: any) {
        let parameters = JSON.stringify({
            findProduct: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveProducts`, parameters);
    }

    getProductById(id: string) {
        let params = JSON.stringify({getProduct: { "_id": id}});
        return this.http.post(`${environment.apiUrlV3}/getProduct`, params);
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
    //     return this.http.post(`${environment.apiUrlV3}/addProduct`, params);
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
    //     return this.http.post(`${environment.apiUrlV3}/updateProduct`, params);
    // }

    deleteProduct(params: any) {
        let deleteUser = JSON.stringify({
            updateProduct: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/updateProduct`, deleteUser);
    }

    toSnakeCase(str: string): string {
        return str.replace(/([A-Z])/g, "_$1").toLowerCase();
    }

    convertAndFilter(obj: Record<string, any>): Record<string, any> {
        const result: Record<string, any> = {};

        for (const key in obj) {
            const value = obj[key];

            // Caso especial: objeto con 'id'
            if (
            value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            "id" in value &&
            typeof value.id !== "object"
            ) {
            result[`${this.toSnakeCase(key)}_id`] = value.id;
            }

            // Valor primitivo (string, number, boolean, null)
            else if (
            value === null ||
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
            ) {
            result[this.toSnakeCase(key)] = value;
            }

            // Todo lo demás (arrays, objetos anidados sin `id`) se ignora
        }

        return result;
    }


    /** ESTABLISHMENT */

    getAllEstablishments() {
        let params = JSON.stringify({e: {}});
        return this.http.post(`${environment.apiUrlV3}/retrieveEstablishments`, params);
    }


    getAllEstablishmentsByFilter(params: any) {
        let parameters = JSON.stringify({
            e: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveEstablishments`, parameters);
    }

    getEstablishmentById(id: string) {
        let params = JSON.stringify({e: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getEstablishment`, params);
    }

    getShortEstablishmentInfo(establishment: Establishment){
        return establishment.name + " (" + establishment.address + ")";
    }

    addEstablishment(establishment: Establishment){
        let params = JSON.stringify({
                name: establishment.name,
                address: establishment.address,
                description: establishment.description,
                receive_pending_orders_enabled: establishment.receivePendingOrdersEnabled ?? false,
                establishment_type_id: establishment.establishmentTypeId ?? 1,
                status_id: establishmentStatusValues.activo.status.id,
                creator_user_id: this.accountService.userValue.uuid
            });
        return this.http.put(`${environment.apiUrlV3}/addEstablishment`, params);
    }

    updateEstablishment(id: string, establishment: Establishment){
        let params = JSON.stringify({
            name: establishment.name,
            address: establishment.address,
            description: establishment.description,
            receive_pending_orders_enabled: establishment.receivePendingOrdersEnabled ?? false,
            establishment_type_id: establishment.establishmentTypeId ?? 1,
            id: id
        });
        return this.http.patch(`${environment.apiUrlV3}/updateEstablishment`, params);
    }

    deleteEstablishment(params: any) {
        let deleteUser = JSON.stringify({
            id: params.id
        });
        return this.http.patch(`${environment.apiUrlV3}/deleteEstablishment`, deleteUser);
    }

    /** PROVIDERS */

    getAllProviders() {
        let params = JSON.stringify({p: {}});
        return this.http.post(`${environment.apiUrlV3}/retriveProviders`, params);
    }


    getAllProvidersByFilter(params: any) {
        let parameters = JSON.stringify({
            p: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveProviders`, parameters);
    }

    getProviderById(id: string) {
        let params = JSON.stringify({p: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getProvider`, params);
    }

    addProvider(provider: Provider){
        let params = JSON.stringify({
            name: provider.name,
            phone: provider.phone,
            description: provider.description,
            company: provider.company,
            email: provider.email,
            status_id: providerStatusValues.activo.status.id,
            creator_user_id: this.accountService.userValue.uuid
        });
        return this.http.put(`${environment.apiUrlV3}/addProvider`, params);
    }

    updateProvider(id: string, provider: Provider){
        let params = JSON.stringify({
            name: provider.name,
            phone: provider.phone,
            description: provider.description,
            company: provider.company,
            id: id
        });
        return this.http.patch(`${environment.apiUrlV3}/updateProvider`, params);
    }

    deleteProvider(params: any) {
        let deleteUser = JSON.stringify({
            id: params.id
        });
        return this.http.patch(`${environment.apiUrlV3}/deleteProvider`, deleteUser);
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
    
        return this.http.post(`${environment.apiUrlV2}/ImageUpload`, formData, { headers });
    }

    getImageById(id: string) {
        let params = JSON.stringify({getImage: { "_id": id}});
        return this.http.post(`${environment.apiUrlV2}/getImage`, params);
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
        utcTime = utcTime.includes("Z") ? utcTime : utcTime + "Z";
        let date = new Date(utcTime.replaceAll("\"",""));
        return date.toLocaleString().replace(",", " ");
    }

    getLocalDateFromUTCTime(utcTime: string){
        utcTime = utcTime.includes("Z") ? utcTime : utcTime + "Z";
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

    getConvertedPrice(price: number, unitMeasure?: Measure, weightMeasure?: Measure, prevMeasure?: Measure){
        let formattedPrice = price;
        if(prevMeasure?.unitBase?.name == unitMeasure?.unitBase?.name){
            formattedPrice =  Number((price * (Number(unitMeasure?.unitBase!.quantity) || 1)).toFixed(2));
        } else if(prevMeasure?.unitBase?.name == weightMeasure?.unitBase?.name){
            formattedPrice = Number((price * (Number(weightMeasure?.unitBase!.quantity) || 1)).toFixed(2));
        }
        return this.getFormatedPrice(formattedPrice);
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

    findJsonValue(obj: any, targetKey: string): any | null {
        if (obj == null || typeof obj !== 'object') return null;

        if (targetKey in obj) {
            return obj[targetKey];
        }

        if (Array.isArray(obj)) {
            for (const item of obj) {
            const result = this.findJsonValue(item, targetKey);
            if (result !== null) return result;
            }
        }

        for (const key of Object.keys(obj)) {
            const result = this.findJsonValue(obj[key], targetKey);
            if (result !== null) return result;
        }

        return null;
    }

    getAnyComponent(params: any, catalog: any) {
        return this.http.post(`${environment.apiUrlV3}/${catalog}`, params);
    }

    getErrorMessageResponse(error: any, defaultMessage: string): string {
        const errorValue = error.error;
        let errorResponse = this.findJsonValue(errorValue, 'error');
        let ackError = this.findJsonValue(errorValue, 'AcknowledgementDescription');
        if (ackError && errorResponse) {
            return `${ackError}: ${errorResponse}`;
        }
        return defaultMessage;
    }

    /** RAW MATERIAL BASE */

    getAllRawMaterials() {
        let params = JSON.stringify({rm: {}});
        return this.http.post(`${environment.apiUrlV3}/retrieveRawMaterial`, params);
    }


    getAllRawMaterialsByFilter(params: any) {
        let parameters = JSON.stringify({
            rm: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveRawMaterial`, parameters);
    }

    getRawMaterialById(id: string) {
        let params = JSON.stringify({rm: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getRawMaterial`, params);
    }

    addRawMaterial(rawMaterial: RawMaterialBase, img?: string){
        rawMaterial.photo = img;
        if (!img){
            delete rawMaterial.photo;
        }
        let params = JSON.stringify({
            name: rawMaterial.name,
            description: rawMaterial.description,
            photo: rawMaterial.photo,
            unit_base_id: rawMaterial.measure?.id,
            status_id: rawMaterialStatusValues.activo.status.id,
            creator_user_id: this.accountService.userValue.uuid
        });
        return this.http.put(`${environment.apiUrlV3}/addRawMaterial`, params);
    }

    updateRawMaterial(id: string, rawMaterial: RawMaterialBase, img?: string){
        rawMaterial.photo = img;
        if (!img){
            rawMaterial.photo = "";
        }
        let params = JSON.stringify({
            name: rawMaterial.name,
            description: rawMaterial.description,
            photo: rawMaterial.photo,
            id: id   
        });
        return this.http.patch(`${environment.apiUrlV3}/UpdateRawMaterial`, params);
    }

    deleteRawMaterial(params: any) {
        let deleteUser = JSON.stringify({
            id: params.id
        });
        return this.http.patch(`${environment.apiUrlV3}/deleteRawMaterial`, deleteUser);
    }

    /** RAW MATERIAL BY PROVIDER */

    getAllRawMaterialsByProvider() {
        let params = JSON.stringify({rmbp: {}});
        return this.http.post(`${environment.apiUrlV3}/retrieveRawMaterialByProvider`, params);
    }


    getAllRawMaterialsByProviderByFilter(params: any) {
        let parameters = JSON.stringify({
            rmbp: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveRawMaterialByProvider`, parameters);
    }

    getRawMaterialByProviderById(id: string) {
        let params = JSON.stringify({rmbp: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getRawMaterialByProvider`, params);
    }

    addRawMaterialByProvider(rawMaterial: RawMaterialByProvider){
        let params = JSON.stringify({
            price: rawMaterial.price,
            provider_id: rawMaterial.provider?.id,
            raw_material_base_id: rawMaterial.rawMaterialBase?.id,
            status_id: rawMaterialByProviderStatusValues.activo.status.id,
            creator_user_id: this.accountService.userValue.uuid,
            raw_material_by_provider_type_id: rawMaterial.rawMaterialByProviderTypeId ?? 1
        });
        return this.http.put(`${environment.apiUrlV3}/addRawMaterialByProvider`, params);
    }

    updateRawMaterialByProvider(id: string, rawMaterial: RawMaterialByProvider){
        let params = JSON.stringify({
            price: rawMaterial.price,
            id: id
        });
        return this.http.patch(`${environment.apiUrlV3}/updateRawMaterialByProvider`, params);
    }

    deleteRawMaterialByProvider(params: any) {
        let deleteUser = JSON.stringify({
            id: params.id
        });
        return this.http.patch(`${environment.apiUrlV3}/deleteRawMaterialByProvider`, deleteUser);
    }

    /** FINISHED PRODUCT */

    getAllFinishedProduct() {
        let params = JSON.stringify({fp: {}});
        return this.http.post(`${environment.apiUrlV3}/retrieveFinishedProduct`, params);
    }


    getAllFinishedProductByFilter(params: any) {
        let parameters = JSON.stringify({
            fp: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveFinishedProduct`, parameters);
    }

    getFinishedProductById(id: string) {
        let params = JSON.stringify({fp: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getFinishedProduct`, params);
    }

    addFinishedProduct(product: FinishedProduct, img?: string){
        product.photo = img;
        if (img === ""){
            delete product.photo;
        }
        let params = JSON.stringify({
            name: product.name,
            description: product.description,
            photo: product.photo,
            status_id: finishedProductStatusValues.activo.status.id,
            unit_base_id: product.measure?.id,
            creator_user_id: this.accountService.userValue.uuid,
            finished_product_type_id: product.finishedProductTypeId ?? 1
        });
        return this.http.put(`${environment.apiUrlV3}/addFinishedProduct`, params);
    }

    updateFinishedProduct(id: string, product: FinishedProduct, img?: string){
        product.photo = img;
        if(!img){
            product.photo = "";
        }
        let params = JSON.stringify({
            name: product.name,
            description: product.description,
            photo: product.photo,
            id: id
        });
        return this.http.patch(`${environment.apiUrlV3}/updateFinishedProduct`, params);
    }

    deleteFinishedProduct(params: any) {
        let deleteUser = JSON.stringify({
            id: params.id
        });
        return this.http.patch(`${environment.apiUrlV3}/deleteFinishedProduct`, deleteUser);
    }

    /** RAW MATERIAL ORDER */

    getAllRawMaterialOrder() {
        let params = JSON.stringify({rmo: {}});
        return this.http.post(`${environment.apiUrlV3}/listRawMaterialOrder`, params);
    }


    getAllRawMaterialOrderByFilter(params: any) {
        let parameters = JSON.stringify({
            rmo: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/listRawMaterialOrder`, parameters);
    }

    getRawMaterialOrderById(id: string) {
        let params = JSON.stringify({rmo: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getRawMaterialOrder`, params);
    }

    addRawMaterialOrder(rmOrder: RawMaterialOrder){
        let params = JSON.stringify({
            "$1": JSON.stringify({
                ...rmOrder,
                description: rmOrder.comment,
                rawMaterialByProviderTypeId: rmOrder.rawMaterialByProviderTypeId ?? 1,
                creatorUser: { id: this.accountService.userValue.uuid }
            }),
            "$2": JSON.stringify(rmOrder.rawMaterialOrderElements)
        });
        return this.http.patch(`${environment.apiUrlV3}/addRawMaterialOrder`, params);
    }

    updateRawMaterialOrderElements(rmOrder: RawMaterialOrder){
        let params = JSON.stringify({
            order_id: rmOrder.id,
            order_properties: JSON.stringify({
                ...rmOrder,
                description: rmOrder.comment,
                creatorUser: { id: this.accountService.userValue.uuid }
            }),
            order_elements: JSON.stringify(rmOrder.rawMaterialOrderElements)
        });
        return this.http.post(`${environment.apiUrlV3}/updateRawMaterialOrderElements`, params);
    }

    updateRawMaterialOrder(rmOrder: RawMaterialOrder){
        let params = JSON.stringify({
            name: rmOrder.name,
            payment_type_id: rmOrder.paymentType?.id,
            description: rmOrder.comment,
            id: rmOrder.id
        });
        return this.http.patch(`${environment.apiUrlV3}/updateRawMaterialOrder`, params);
    }

    addRawMaterialOrderPaymentHistory(rmoId: string, amount: string, paymentTypeId: string){
        let params = JSON.stringify({
            "$1": rmoId,
            "$2": amount,
            "$3": paymentTypeId
        });
        return this.http.patch(`${environment.apiUrlV3}/addRawMaterialOrderPaymentHistory`, params);
    }

    verifyRawMaterialOrder(rmOrder: RawMaterialOrder){
        let params = JSON.stringify({
            "$1": rmOrder.id,
            "$2": JSON.stringify({
                ...rmOrder,
                description: rmOrder.comment
            }),
            "$3": JSON.stringify(rmOrder.rawMaterialOrderElements),
            "$4": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/verifyRawMaterialOrder`, params);
    }

    deleteRawMaterialOrder(params: any) {
        let deleteOrder = JSON.stringify({
            id: params.id
        });
        return this.http.patch(`${environment.apiUrlV3}/deleteRawMaterialOrder`, deleteOrder);
    }

    /** MOVEMENT */
    
    moveStoreToFactory(movement: MovementWarehouseToFactory){
        let params = JSON.stringify({
            moveStoreToFactory: {
                ...movement
            }});
        return this.http.post(`${environment.apiUrlV3}/MoveStoreToFactory`, params);
    }

    /** INVENTORY */

    getInventoryByType(params: any, inventoryType: string) {
        let parameters = JSON.stringify({
            i: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/${inventoryType}`, parameters);
    }

    getAllInventoryByFilter(params: any) {
        let parameters = JSON.stringify({
            i: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveInventory`, parameters);
    }

    getInventory(params: any) {
        let parameters = JSON.stringify({
            getInventory: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/getInventory`, parameters);
    }

    addRemoveInventoryElement(params: any) {
        let parameters = JSON.stringify({
                "$1": params.inventoryType,
                "$2": params.unitName,
                "$3": params.elementId,
                "$4": params.selectedMeasureId,
                "$5": params.elementQuantity,
                "$6": this.accountService.userValue.uuid,
                "$7": params.reason,
                "$8": params.actionTypeId
            });
        return this.http.patch(`${environment.apiUrlV3}/addRemoveInventoryElement`, parameters);
    }

    returnPFSToWarehouse(params: any) {
        let parameters = JSON.stringify({
            "$1": params.inventoryType,
            "$2": params.unitName,
            "$3": params.elementId,
            "$4": params.measureId,
            "$5": params.quantity,
            "$6": this.accountService.userValue.uuid,
            "$7": params.reason
        });
        return this.http.patch(`${environment.apiUrlV3}/returnPFSToWarehouse`, parameters);
    }

    multiAddRemoveInventoryElement(params: any) {
        let parameters = JSON.stringify({
            "$1": JSON.stringify(params)
        });
        return this.http.patch(`${environment.apiUrlV3}/multiAddRemoveInventoryElement`, parameters);
    }

    updateInventoryElement(params: any) {
        let parameters = JSON.stringify({
            updateInventoryElement: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/UpdateInventoryElement`, parameters);
    }

    /** PRODUCT CREATION */
    
    registerFinishedProductCreation(fpCreation: FinishedProductCreation){
        let params = JSON.stringify({
            registerFinishedProductCreation: {
                ...fpCreation
            }});
        return this.http.post(`${environment.apiUrlV3}/registerFinishedProductCreation`, params);
    }

    /** PRODUCT FOR SALE */
    getAllProductForSale() {
        let params = JSON.stringify({pfs: {}});
        return this.http.post(`${environment.apiUrlV3}/retrieveProductsForSale`, params);
    }


    getAllProductForSaleByFilter(params: any) {
        let parameters = JSON.stringify({
            pfs: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveProductsForSale`, parameters);
    }

    getProductForSaleById(id: string) {
        let params = JSON.stringify({pfs: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getProductForSale`, params);
    }

    addProductForSale(product: ProductForSale){
        let params = JSON.stringify({
            price: product.price,
            establishment_id: product.establishment?.id,
            finished_product_id: product.finishedProduct?.id,
            status_id: productForSaleStatusValues.activo.status.id,
            creatorUser: this.accountService.userValue.uuid,
        });
        return this.http.put(`${environment.apiUrlV3}/addProductForSale`, params);
    }

    addMultiProductForSale(products: ProductForSale[]){
        let params = JSON.stringify({
            "$1": JSON.stringify(products),
            "$2": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/addManyProductForSale`, params);
    }

    updateProductForSale(id: string, product: ProductForSale){
        let params = JSON.stringify({
            "$1": product.price,
            "$2": id
        });
        return this.http.patch(`${environment.apiUrlV3}/updateProductForSale`, params);
    }

    deleteProductForSale(params: any) {
        let deleteUser = JSON.stringify({
            id: params.id
        });
        return this.http.patch(`${environment.apiUrlV3}/deleteProductForSale`, deleteUser);
    }

    /** PRODUCT FOR SALE ORDER */

    getAllProducForSaleOrder() {
        let params = JSON.stringify({pfsso: {}});
        return this.http.post(`${environment.apiUrlV3}/listProductForSaleStoreOrder`, params);
    }


    getAllProductForSaleOrderByFilter(params: any) {
        let parameters = JSON.stringify({
            pfsso: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/listProductForSaleStoreOrder`, parameters);
    }

    getProductForSaleOrderById(id: string) {
        let params = JSON.stringify({pfsso: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getProductForSaleStoreOrder`, params);
    }

    addProductForSaleOrder(pfsOrder: ProductForSaleStoreOrder){
        let params = JSON.stringify({
            "$1": JSON.stringify({
                ...pfsOrder,
                creatorUser: { id: this.accountService.userValue.uuid },
            }),
            "$2": JSON.stringify(pfsOrder.productForSaleStoreOrderElements)
        });
        return this.http.patch(`${environment.apiUrlV3}/addProductForSaleStoreOrder`, params);
    }

    updateProductForSaleOrder(pfsOrder: ProductForSaleStoreOrder){
        let params = JSON.stringify({
            "$1": pfsOrder.id,
            "$2": JSON.stringify({
                ...pfsOrder
            }),
            "$3": JSON.stringify(pfsOrder.productForSaleStoreOrderElements)
        });
        return this.http.patch(`${environment.apiUrlV3}/updateProductForSaleStoreOrder`, params);
    }

    updateProductForSaleOrderEnCamino(pfsOrderId: string){
        let params = JSON.stringify({
            "$1": pfsOrderId
        });
        return this.http.patch(`${environment.apiUrlV3}/updateProductForSaleStoreOrderEnCamino`, params);
    }

    updateProductForSaleOrderStatus(pfsOrder: ProductForSaleStoreOrder){
        let params = JSON.stringify({
            "$1": pfsOrder.id    
        });
        return this.http.patch(`${environment.apiUrlV3}/updateProductForSaleStoreOrder`, params);
    }

    manageProductForSaleOrderStateReady(pfsOrderId: string){
        let params = JSON.stringify({
            "$1": pfsOrderId,
            "$2": pfsFactoryOrderStatusValues.listo.status.id,
            "$3": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/manageProductForSaleStoreOrder`, params);
    }

    manageProductForSaleOrderStateReceived(pfsOrderId: string){
        let params = JSON.stringify({
            "$1": pfsOrderId,
            "$2": pfsFactoryOrderStatusValues.entregado.status.id,
            "$3": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/manageProductForSaleStoreOrder`, params);
    }

    confirmAndReceivePFSOrder(pfsOrderId: string){
        let params = JSON.stringify({
            "$1": pfsOrderId,
            "$2": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/confirmAndReceivePFSOrder`, params);
    }

    manageProductForSaleOrderStateReturned(pfsOrderId: string){
        let params = JSON.stringify({
            "$1": pfsOrderId,
            "$2": pfsFactoryOrderStatusValues.devuelto.status.id,
            "$3": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/manageProductForSaleStoreOrder`, params);
    }

    verifyProductForSaleOrder(orderId: string){
        let params = JSON.stringify({
            verifyRawMaterialOrder: {
                rawMaterialOrderID: orderId,
            }});
        return this.http.post(`${environment.apiUrlV3}/verifyRawMaterialOrder`, params);
    }

    deleteProductForSaleOrder(orderId: any) {
        let deleteOrder = JSON.stringify({
            "$1": orderId,
        });
        return this.http.patch(`${environment.apiUrlV3}/deleteProductForSaleStoreOrder`, deleteOrder);
    }

    /** SALES */
    getShopSaleSummary(params: any) {
        let parameters = JSON.stringify({ ss: { ...params } });
        return this.http.post(`${environment.apiUrlV3}/listShopSaleSummary`, parameters);
    }

    getAllShopHistory(params: any) {
        let parameters = JSON.stringify({
            ss: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/listShopSale`, parameters);
    }

    getShopHistoryById(params: any) {
        let parameters = JSON.stringify({
            ss: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/getShopSale`, parameters);
    }

    registerShop(params: ShopResume) {
        let parameters = JSON.stringify({
            "$1": JSON.stringify({
                ...params
            }),
            "$2": JSON.stringify(params.itemsList),
            "$3": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/registerShop`, parameters);
    }

    updateShopHistory(params: ShopResume) {
        let updateShopHistory = JSON.stringify({
            "$1": params.nameClient,
            "$2": params.nitClient,
            "$3": params.nota,
            "$4": params.id
        });
        return this.http.patch(`${environment.apiUrlV3}/UpdateShopHistory`, updateShopHistory);
    }

    cancelShop(params: ShopResume) {
        let deleteShopHistory = JSON.stringify({
            "$1": params.id,
            "$2": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/cancelShopHistory`, deleteShopHistory);
    }

    /** LOGS */

    getAllActivityLogs() {
        let params = JSON.stringify({retrieveActivityLog: {}});
        return this.http.post(`${environment.apiUrlV3}/retrieveActivityLogs`, params);
    }


    getAllActivityLogsByFilter(params: any) {
        let parameters = JSON.stringify({
            retrieveActivityLog: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveActivityLogs`, parameters);
    }

    getAllInventoryLogsByFilter(params: any, catalog: any) {
        let parameters = JSON.stringify({
            iea: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/${catalog}`, parameters);
    }

    addActivityLog(actLog: ActivityLog){
        let params = JSON.stringify({
            addActivityLog: {
                ...actLog,
                user: this.accountService.userValueFixed,
            }});
        return this.http.post(`${environment.apiUrlV3}/addActivityLog`, params);
    }

    getAllCashClosing() {
        let params = JSON.stringify({retrieveStoreCashClosing: {}});
        return this.http.post(`${environment.apiUrlV3}/retrieveSotreCashClosing`, params);
    }

    getLogActionName(action?: string){
        return action === "consume" ? "Consumo" : action === "creation" ? "Registro" : (action === "sale" ? "Venta" : (action === "cancel" ? "Cancelacion" : (action === "remove" ? "Retiro" : "Ingreso")));
    }

    getLogActionColor(action?: string){
        return action === "consume" ? "warning" : action === "creation" ? "primary" : (action === "sale" ? "primary" : (action === "cancel" ? "danger" : (action === "remove" ? "danger" :  "success")));
    }


    getAllCashClosingByFilter(params: any) {
        let parameters = JSON.stringify({
            retrieveStoreCashClosing: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveSotreCashClosing`, parameters);
    }

    getAllCashClosingV2ByFilter(params: any) {
        let parameters = JSON.stringify({
            retrieveStoreCashClosing: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveStoreCashClosingV2`, parameters);
    }

    listCashClosingByFilter(params: any) {
        let parameters = JSON.stringify({
            cc: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/listStoreCashClosing`, parameters);
    }

    getNewCashClosing(id: string) {
        let params = JSON.stringify({e: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getNewStoreCashClosing`, params);
    }

    getCashClosingById(id: string) {
        let params = JSON.stringify({cc: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/retrieveStoreCashClosing`, params);
    }

    addCashClosingV2(notes: string, establishment_id: string){
        let params = JSON.stringify({
            "$1": notes,
            "$2": establishment_id,
            "$3": this.accountService.userValue.uuid
        });
        
        return this.http.patch(`${environment.apiUrlV3}/addStoreCashClosing`, params);
    }

    updateCashClosing(id: string, note: string){
        let params = JSON.stringify({
            "$1": note,
            "$2": id
        });
        return this.http.patch(`${environment.apiUrlV3}/updateStoreCashClosing`, params);
    }

    deleteCashClosing(id: string) {
        let deleteCashClosing = JSON.stringify({
            "$1": id
        });
        return this.http.patch(`${environment.apiUrlV3}/deleteStoreCashClosing`, deleteCashClosing);
    }

    verifyCashClosing(id: string) {
        let verifyCashClosing = JSON.stringify({
            "$1": id,
            "$2": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/verifyCashClosing`, verifyCashClosing);
    }

}