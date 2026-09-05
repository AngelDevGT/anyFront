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
import { StoreExpense } from '@app/models/store/store-expense.model';
import { Customer } from '@app/models/system/customer.model';

export const customerStatusValues = {
    activo: { status: {id: 62}},
    eliminado: { status: {id: 63}}
}

export const storeExpenseStatusValues = {
    activo: { status: {id: 58}},
    eliminado: { status: {id: 59}}
}

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
    devuelto: { status: {id: 18}},
    /**
     * Paso OPCIONAL entre En curso(12) y Listo(13), exclusivo del tablero. No
     * mueve inventario ni cambia el estado que ve la tienda.
     * Ver src/database/migrations/2026-08-26-estado-preparado.sql
     */
    preparado: { status: {id: 64}}
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

    /**
     * V2 agrega 'banks' al objeto de la tienda. Es un superset estricto de la V1, asi que las
     * pantallas que solo leen nombre y direccion no cambian.
     * Ver src/database/migrations/2026-08-31-bancos-por-tienda.sql
     */
    getEstablishmentById(id: string) {
        let params = JSON.stringify({e: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getEstablishmentV2`, params);
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

    /**
     * Escribe SOLO los bancos de la tienda. Es un endpoint aparte de updateEstablishment, que
     * tiene un SET explicito sin banks: asi el formulario normal de la tienda no puede borrarlos
     * y este modal no puede pisar el resto de los campos.
     *
     * El texto viene serializado con saltos de linea (serializeBanks). Cadena vacia deja la
     * columna en NULL, que es valido: es quitarle todos los bancos a la tienda.
     */
    updateEstablishmentBanks(id: string, banks: string) {
        let params = JSON.stringify({
            "$1": banks,
            "$2": id
        });
        return this.http.patch(`${environment.apiUrlV3}/updateEstablishmentBanks`, params);
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

    /** CUSTOMERS */

    getAllCustomersByFilter(params: any) {
        let parameters = JSON.stringify({
            c: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveCustomersV2`, parameters);
    }

    getCustomerById(id: string) {
        let parameters = JSON.stringify({c: { "id": id }});
        return this.http.post(`${environment.apiUrlV3}/getCustomerV2`, parameters);
    }

    /**
     * Clientes marcados como Operador, activos. Devuelve solo id y nombre: lo
     * consume el modal de operadores del pedido, que no necesita nada más.
     *
     * El wrapper va vacío a propósito: el filtro está dentro de la query y el
     * backend solo concatena su WHERE cuando el body trae llaves.
     */
    getOperatorCustomers() {
        let parameters = JSON.stringify({ c: {} });
        return this.http.post(`${environment.apiUrlV3}/retrieveOperatorCustomers`, parameters);
    }

    addCustomer(customer: Customer) {
        let parameters = JSON.stringify({
            "$1": customer.name,
            "$2": customer.phone,
            "$3": customer.email,
            "$4": customer.nit || 'C/F',
            "$5": !!customer.isOperator,
            "$6": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/addCustomerV2`, parameters);
    }

    updateCustomer(customer: Customer) {
        let parameters = JSON.stringify({
            "$1": customer.name,
            "$2": customer.phone,
            "$3": customer.email,
            "$4": customer.nit || 'C/F',
            "$5": !!customer.isOperator,
            "$6": customer.id
        });
        return this.http.patch(`${environment.apiUrlV3}/updateCustomerV2`, parameters);
    }

    deleteCustomer(id: string) {
        let parameters = JSON.stringify({
            "$1": id
        });
        return this.http.patch(`${environment.apiUrlV3}/deleteCustomer`, parameters);
    }

    /** CLIENTES POR TIENDA */

    /**
     * Clientes asignados a una tienda, con los datos de la asignación y el
     * saldo pendiente del cliente en esa tienda.
     */
    getEstablishmentCustomers(establishmentId: string) {
        let parameters = JSON.stringify({
            ec: { "establishment_id": establishmentId }
        });
        return this.http.post(`${environment.apiUrlV3}/retrieveEstablishmentCustomers`, parameters);
    }

    addEstablishmentCustomer(establishmentId: string, customerId: string) {
        let parameters = JSON.stringify({
            "$1": establishmentId,
            "$2": customerId,
            "$3": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/addEstablishmentCustomer`, parameters);
    }

    /** Recibe el id de la asignación (establishment_customer.id). */
    deleteEstablishmentCustomer(assignmentId: string) {
        let parameters = JSON.stringify({
            "$1": assignmentId
        });
        return this.http.patch(`${environment.apiUrlV3}/deleteEstablishmentCustomer`, parameters);
    }

    /** PRICE */

    getFormatedPrice(price: number){
        return "Q. " + price.toFixed(2);
    }

    getFormatedPriceWithSeparators(price: number): string {
        return 'Q. ' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
        const date = new Date(utcTime.replaceAll("\"",""));
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
            `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    getLocalDateFromUTCTime(utcTime: string){
        utcTime = utcTime.includes("Z") ? utcTime : utcTime + "Z";
        let date = new Date(utcTime.replaceAll("\"",""));
        return date.toLocaleString().split(",")[0];
        // return date.toJSON().slice(0, 10);
    }

    /**
     * Convierte el valor de un <input type="datetime-local"> (hora local, sin
     * zona) al formato UTC 'YYYY-MM-DD HH:mm:ss' que espera la base de datos.
     * Devuelve cadena vacía si el valor no es una fecha válida.
     */
    getUTCTimeFromLocalDateTime(localDateTime?: string){
        if(!localDateTime) return "";
        const date = new Date(localDateTime);
        if(Number.isNaN(date.getTime())) return "";
        return date.toISOString().slice(0, 19).replace("T", " ");
    }

    /**
     * Fecha y hora local en el formato 'YYYY-MM-DDTHH:mm' que requiere un
     * <input type="datetime-local">. Sin argumentos devuelve el momento actual.
     */
    getLocalDateTimeInputValue(date: Date = new Date()){
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T` +
            `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    /** MEASURE */

    getMeasureByName(measure: string){
        if(measure == "unit")
            return "Unidades"
        if(measure == "onz")
            return "Onzas"
        return "Sin Definir"
    }

    getConvertedPriceRaw(price: number, unitMeasure?: Measure, weightMeasure?: Measure, prevMeasure?: Measure): number {
        if(prevMeasure?.unitBase?.name == unitMeasure?.unitBase?.name){
            return Number((price * (Number(unitMeasure?.unitBase!.quantity) || 1)).toFixed(2));
        }
        if(prevMeasure?.unitBase?.name == weightMeasure?.unitBase?.name){
            return Number((price * (Number(weightMeasure?.unitBase!.quantity) || 1)).toFixed(2));
        }
        return price;
    }

    getConvertedPrice(price: number, unitMeasure?: Measure, weightMeasure?: Measure, prevMeasure?: Measure){
        return this.getFormatedPrice(this.getConvertedPriceRaw(price, unitMeasure, weightMeasure, prevMeasure));
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

    // ---- V2 (soporte de thumbnail) — no reemplaza a los métodos anteriores ----
    getAllRawMaterialsByFilterV2(params: any) {
        let parameters = JSON.stringify({
            rm: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveRawMaterialV2`, parameters);
    }

    // ---- V3 (orden personalizado: agrega sortOrder y ordena por sort_order) ----
    getAllRawMaterialsByFilterV3(params: any) {
        let parameters = JSON.stringify({
            rm: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveRawMaterialV3`, parameters);
    }

    updateRawMaterialSortOrder(items: { id: string, sort_order: number }[]) {
        let params = JSON.stringify({ "$1": JSON.stringify(items) });
        return this.http.patch(`${environment.apiUrlV3}/updateRawMaterialSortOrder`, params);
    }

    getRawMaterialByIdV2(id: string) {
        let params = JSON.stringify({rm: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getRawMaterialV2`, params);
    }

    addRawMaterialV2(rawMaterial: RawMaterialBase, img?: string, thumb?: string){
        let params = JSON.stringify({
            name: rawMaterial.name,
            description: rawMaterial.description,
            photo: img || undefined,
            thumb: thumb || undefined,
            unit_base_id: rawMaterial.measure?.id,
            status_id: rawMaterialStatusValues.activo.status.id,
            creator_user_id: this.accountService.userValue.uuid
        });
        return this.http.put(`${environment.apiUrlV3}/addRawMaterialV2`, params);
    }

    // El orden de las claves debe coincidir con los parámetros posicionales
    // de UpdateRawMaterialV2: name=$1, description=$2, photo=$3, thumb=$4, id=$5
    updateRawMaterialV2(id: string, rawMaterial: RawMaterialBase, img?: string, thumb?: string){
        let params = JSON.stringify({
            name: rawMaterial.name,
            description: rawMaterial.description,
            photo: img || "",
            thumb: thumb || "",
            id: id
        });
        return this.http.patch(`${environment.apiUrlV3}/UpdateRawMaterialV2`, params);
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

    // ---- V2 (orden personalizado: agrega sortOrder y ordena por sort_order) ----
    getAllRawMaterialsByProviderByFilterV2(params: any) {
        let parameters = JSON.stringify({
            rmbp: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveRawMaterialByProviderV2`, parameters);
    }

    updateRawMaterialByProviderSortOrder(items: { id: string, sort_order: number }[]) {
        let params = JSON.stringify({ "$1": JSON.stringify(items) });
        return this.http.patch(`${environment.apiUrlV3}/updateRawMaterialByProviderSortOrder`, params);
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

    // ---- V2 (soporte de thumbnail) — no reemplaza a los métodos anteriores ----
    getAllFinishedProductByFilterV2(params: any) {
        let parameters = JSON.stringify({
            fp: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveFinishedProductV2`, parameters);
    }

    getFinishedProductByIdV2(id: string) {
        let params = JSON.stringify({fp: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getFinishedProductV2`, params);
    }

    // ---- V3 (orden personalizado: agrega sortOrder y ordena por sort_order) ----
    getAllFinishedProductByFilterV3(params: any) {
        let parameters = JSON.stringify({
            fp: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveFinishedProductV3`, parameters);
    }

    updateFinishedProductSortOrder(items: { id: string, sort_order: number }[]) {
        let params = JSON.stringify({ "$1": JSON.stringify(items) });
        return this.http.patch(`${environment.apiUrlV3}/updateFinishedProductSortOrder`, params);
    }

    addFinishedProductV2(product: FinishedProduct, img?: string, thumb?: string){
        let params = JSON.stringify({
            name: product.name,
            description: product.description,
            photo: img || undefined,
            thumb: thumb || undefined,
            status_id: finishedProductStatusValues.activo.status.id,
            unit_base_id: product.measure?.id,
            creator_user_id: this.accountService.userValue.uuid,
            finished_product_type_id: product.finishedProductTypeId ?? 1
        });
        return this.http.put(`${environment.apiUrlV3}/addFinishedProductV2`, params);
    }

    // El orden de las claves debe coincidir con los parámetros posicionales
    // de updateFinishedProductV2: name=$1, description=$2, photo=$3, thumb=$4, id=$5
    updateFinishedProductV2(id: string, product: FinishedProduct, img?: string, thumb?: string){
        let params = JSON.stringify({
            name: product.name,
            description: product.description,
            photo: img || "",
            thumb: thumb || "",
            id: id
        });
        return this.http.patch(`${environment.apiUrlV3}/updateFinishedProductV2`, params);
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

    /** Devolucion masiva de producto de tienda a bodega, en una sola transaccion. */
    multiReturnPFSToWarehouse(params: any) {
        let parameters = JSON.stringify({
            "$1": JSON.stringify(params)
        });
        return this.http.patch(`${environment.apiUrlV3}/multiReturnPFSToWarehouse`, parameters);
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

    // ---- V2 (soporte de thumbnail, heredado de finished_product) ----
    getAllProductForSaleByFilterV2(params: any) {
        let parameters = JSON.stringify({
            pfs: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveProductsForSaleV2`, parameters);
    }

    getProductForSaleByIdV2(id: string) {
        let params = JSON.stringify({pfs: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getProductForSaleV2`, params);
    }

    // ---- V3 (orden personalizado por tienda: agrega sortOrder y ordena por sort_order) ----
    getAllProductForSaleByFilterV3(params: any) {
        let parameters = JSON.stringify({
            pfs: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveProductsForSaleV3`, parameters);
    }

    updateProductForSaleSortOrder(items: { id: string, sort_order: number }[]) {
        let params = JSON.stringify({ "$1": JSON.stringify(items) });
        return this.http.patch(`${environment.apiUrlV3}/updateProductForSaleSortOrder`, params);
    }

    // ---- Costo (product_for_sale.cost): solo para el rol Sistema ----
    // Las lecturas con costo viven en endpoints aparte para que el payload de un usuario
    // de tienda no lo incluya. El backend no valida rol, así que el gate real es de UI.

    /** Igual a getAllProductForSaleByFilterV3 pero incluyendo el costo. */
    getAllProductForSaleByFilterV4(params: any) {
        let parameters = JSON.stringify({
            pfs: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/retrieveProductsForSaleV4`, parameters);
    }

    /** Igual a getProductForSaleById pero incluyendo el costo. */
    getProductForSaleByIdWithCost(id: string) {
        let params = JSON.stringify({pfs: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getProductForSaleWithCost`, params);
    }

    updateProductForSaleCost(id: string, cost: string) {
        let params = JSON.stringify({
            "$1": cost,
            "$2": id
        });
        return this.http.patch(`${environment.apiUrlV3}/updateProductForSaleCost`, params);
    }

    /**
     * Edición masiva de costos. Se resuelve con un solo UPDATE en base de datos,
     * de modo que todos los cambios se aplican juntos o no se aplica ninguno.
     */
    updateManyProductForSaleCost(items: { id: string, cost: number }[]) {
        let params = JSON.stringify({ "$1": JSON.stringify(items) });
        return this.http.patch(`${environment.apiUrlV3}/updateManyProductForSaleCost`, params);
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
        return this.http.post(`${environment.apiUrlV3}/listProductForSaleStoreOrderV2`, params);
    }


    getAllProductForSaleOrderByFilter(params: any) {
        let parameters = JSON.stringify({
            pfsso: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/listProductForSaleStoreOrderV3`, parameters);
    }

    getProductForSaleOrderById(id: string) {
        let params = JSON.stringify({pfsso: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getProductForSaleStoreOrderV6`, params);
    }

    /**
     * Solo lo que pinta el modal "Ver productos" del tablero: nombre, cantidad y
     * medida de cada producto, más el comentario del pedido.
     *
     * Aparte de getProductForSaleOrderById porque ese trae el detalle completo,
     * con finished_product.photo (la imagen en base64) por cada producto. El
     * modal no cachea a proposito —los productos se pueden editar mientras el
     * pedido esté en Pendiente o En curso— así que ese payload se volvía a bajar
     * en cada apertura.
     */
    getProductForSaleOrderElementsById(id: string) {
        let params = JSON.stringify({pfsso: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getProductForSaleStoreOrderElementsV3`, params);
    }

    /**
     * Guarda de una sola vez los productos que bodega marcó como alistados en el
     * panel del tablero. Los clicks se acumulan en el front y viajan juntos: un
     * pedido de 20 productos son 20 clicks y una llamada.
     *
     * La base solo aplica el cambio si el pedido está En curso(12) o Preparado(64)
     * y si los elementos le pertenecen. Fuera de eso el UPDATE afecta 0 filas y NO
     * devuelve error: la acción no se aplica y ya.
     *
     * @param elements tanda con la forma [{ id, is_check }]. Conviene mandar solo
     *                 los que cambiaron; los demás no aportan nada.
     */
    updateProductForSaleOrderElementsCheck(pfsOrderId: string, elements: { id: number, is_check: boolean }[]) {
        let params = JSON.stringify({
            "$1": pfsOrderId,
            "$2": JSON.stringify(elements)
        });
        return this.http.patch(`${environment.apiUrlV3}/updateProductForSaleStoreOrderElementsCheck`, params);
    }

    /**
     * Listado para el tablero de bodega. Igual al listado normal más
     * assignedUser, startDate y readyDate; sin los elementos del pedido, que se
     * piden aparte con getProductForSaleOrderById al abrir "Ver productos".
     *
     * La V6 excluye del lado de la base los pedidos ya entregados —factory 16 /
     * store 22—, que el tablero bajaba solo para que distribute() los tirara. El
     * resto de estados que el tablero tampoco pinta (En camino, Cancelado,
     * Devuelto, Eliminado) sí siguen viniendo: son casos raros.
     * Ver src/database/migrations/2026-08-30-tablero-filtrar-pedidos-entregados.sql
     */
    getAllProductForSaleOrderForBoard(params: any) {
        let parameters = JSON.stringify({
            pfsso: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/listProductForSaleStoreOrderBoardV6`, parameters);
    }

    /**
     * Listado de la vista "Pedidos preparados": TODOS los pedidos en Preparado(64)
     * CON su lista de productos, en una sola llamada.
     *
     * Aparte del listado del tablero porque esa query no trae los elementos —el
     * tablero los pide de a uno al abrir una tarjeta— y esta pantalla los muestra
     * todos: por ese camino cada recarga serían 1 + N llamadas. De paso el
     * resultado es un snapshot consistente, sin cabeceras de antes de un
     * movimiento y productos de después.
     *
     * El wrapper va vacío a propósito: el filtro por estado está dentro de la
     * query y el backend solo concatena su WHERE cuando el body trae llaves. Sin
     * filtro de fechas tampoco: Preparado es un estado de paso, así que el
     * conjunto es chico por definición y acotarlo escondería justo los pedidos
     * viejos que la pantalla existe para destapar.
     * Ver src/database/migrations/2026-08-31-vista-pedidos-preparados.sql
     */
    getPreparedProductForSaleOrders() {
        let parameters = JSON.stringify({ pfsso: {} });
        return this.http.post(`${environment.apiUrlV3}/listProductForSaleStoreOrderPreparedV2`, parameters);
    }

    /**
     * Guarda la segunda pasada de control: los productos que quien revisa marcó en
     * la vista "Pedidos preparados". Gemela de
     * updateProductForSaleOrderElementsCheck, sobre la columna prepared_check.
     *
     * La base solo la aplica con el pedido en Preparado(64) y sobre elementos de
     * ese pedido. Fuera de eso el UPDATE afecta 0 filas y NO devuelve error.
     *
     * @param elements tanda con la forma [{ id, prepared_check }]. Conviene mandar
     *                 solo los que cambiaron.
     */
    updateProductForSaleOrderElementsPreparedCheck(pfsOrderId: string, elements: { id: number, prepared_check: boolean }[]) {
        let params = JSON.stringify({
            "$1": pfsOrderId,
            "$2": JSON.stringify(elements)
        });
        return this.http.patch(`${environment.apiUrlV3}/updateProductForSaleStoreOrderElementsPreparedCheck`, params);
    }

    /**
     * Firma la verificación de un pedido sin moverlo de estado. Es el camino OPCIONAL,
     * el del botón "Verificar": adelantarla desde Preparado(64) deja constancia de que
     * alguien revisó el pedido ANTES de cerrarlo.
     *
     * Acepta además Listo(13), que es donde queda un pedido que perdió la firma al
     * editarse: editar los productos de un pedido Listo la borra, y volver a firmarlo
     * es opcional —Entregado y Devuelto no la piden—.
     * Ver src/database/migrations/2026-09-01-editar-pedido-listo.sql
     *
     * Firma el usuario logueado. La V3 ya no valida su rol: el gate es la capacidad
     * orders.verify, que muestra u oculta el botón. La base solo comprueba que el
     * pedido esté en Preparado o Listo y sin firma previa, porque no se reemplaza.
     * Ver src/database/migrations/2026-09-02-verificacion-por-usuario-actual.sql
     */
    verifyPreparedProductForSaleOrder(pfsOrderId: string){
        let params = JSON.stringify({
            "$1": pfsOrderId,
            "$2": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/verifyProductForSaleStoreOrderV3`, params);
    }

    /**
     * Pendiente -> En curso. Asigna al usuario actual como encargado, marca la
     * hora de inicio y guarda los operadores. No mueve inventario.
     *
     * @param operators nombres separados por pipes, ya pasados por
     *                  serializeOperators. Cadena vacía deja la columna en NULL:
     *                  tomar un pedido sin operadores es un caso permitido.
     */
    startProductForSaleOrder(pfsOrderId: string, operators = ''){
        let params = JSON.stringify({
            "$1": pfsOrderId,
            "$2": this.accountService.userValue.uuid,
            "$3": operators
        });
        return this.http.patch(`${environment.apiUrlV3}/startProductForSaleStoreOrderV2`, params);
    }

    /**
     * En curso -> Pendiente. Libera el pedido y limpia encargado, hora de inicio,
     * operadores y los productos marcados. Solo lo permite la base si quien llama
     * es el encargado o un admin; en el front la capacidad orders.release
     * gobierna el botón.
     *
     * La V3 agrega el borrado de los checks: el avance del alistado es de quien
     * tenía el pedido, no del pedido, así que se va con el resto cuando vuelve al
     * pool. Va en la misma sentencia (un CTE) y acoplado al RETURNING del
     * release, para que un intento rechazado por los guards no borre nada.
     * Ver src/database/migrations/2026-08-30-liberar-pedido-limpia-checks.sql
     */
    releaseProductForSaleOrder(pfsOrderId: string){
        let params = JSON.stringify({
            "$1": pfsOrderId,
            "$2": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/releaseProductForSaleStoreOrderV3`, params);
    }

    /**
     * En curso -> Preparado. Paso opcional del tablero: no mueve inventario y no
     * cambia el estado que ve la tienda. Solo lo permite la base si quien llama
     * es el encargado del pedido o un admin.
     */
    prepareProductForSaleOrder(pfsOrderId: string){
        let params = JSON.stringify({
            "$1": pfsOrderId,
            "$2": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/prepareProductForSaleStoreOrder`, params);
    }

    /**
     * Preparado -> En curso. El reverso exacto de prepareProductForSaleOrder, con el
     * mismo guard: lo retrocede su encargado, o un admin.
     *
     * CONSERVA encargado, hora de inicio y operadores —el pedido no cambia de manos,
     * solo retrocede un paso para corregirlo—, a diferencia de
     * releaseProductForSaleOrder, que lo devuelve al pool y los borra.
     *
     * BORRA la fecha de preparación, la verificación y —desde la V2— los productos
     * marcados en la revisión (prepared_check). Lo de la firma es lo importante:
     * los productos se pueden editar mientras el pedido está En curso, así que una
     * firma que sobreviviera al retroceso certificaría productos distintos de los que
     * se despachan, y la base no volvería a pedir verificador al cerrarlo. La
     * revisión de preparado se borra por el mismo motivo.
     *
     * CONSERVA además los checks de alistado (is_check): eso lo puso bodega y sigue
     * valiendo, el pedido no cambia de manos.
     * Ver src/database/migrations/2026-09-03-check-preparado-productos.sql
     */
    unprepareProductForSaleOrder(pfsOrderId: string){
        let params = JSON.stringify({
            "$1": pfsOrderId,
            "$2": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/unprepareProductForSaleStoreOrderV2`, params);
    }

    /**
     * Cambia solo los operadores del pedido: no toca estados ni inventario.
     *
     * La V2 solo los deja editar mientras el pedido siga en bodega —Pendiente(11),
     * En curso(12) o Preparado(64)—. Desde Listo(13) el pedido ya salió y sus
     * operadores son un registro histórico. Fuera de esos estados el UPDATE afecta
     * 0 filas y NO devuelve error.
     *
     * Eso quita el caso que la V1 habilitaba: ponerle operadores a un pedido ya
     * cerrado desde la vista de detalle, que va de Pendiente a Listo directo y
     * nunca los pide. Ahora hay que cargarlos antes de marcarlo como Listo.
     * Ver src/database/migrations/2026-08-30-operadores-solo-antes-de-listo.sql
     */
    updateProductForSaleOrderOperators(pfsOrderId: string, operators: string){
        let params = JSON.stringify({
            "$1": pfsOrderId,
            "$2": operators
        });
        return this.http.patch(`${environment.apiUrlV3}/updateProductForSaleStoreOrderOperatorsV2`, params);
    }

    /**
     * Version reducida de getProductForSaleOrderById: solo los campos que se imprimen en el PDF.
     */
    getProductForSaleOrderByIdForPdf(id: string) {
        let params = JSON.stringify({pfsso: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getProductForSaleStoreOrderForPdfV3`, params);
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

    /**
     * Guarda un pedido editado. La V2 suma dos estados con edición real de productos:
     *
     *   Preparado(64) -> era un bug: el estado nació después de la lista del procedure
     *                    v1 y nunca se agregó, así que editar los productos respondía
     *                    OK y no guardaba nada. No mueve inventario.
     *   Listo(13)     -> el producto ya salió de bodega, así que la base AJUSTA
     *                    inventario por diferencias: descuenta lo que se agrega y
     *                    devuelve a bodega lo que se quita. Si no alcanza el stock,
     *                    revienta y no se aplica NADA de la edición.
     *
     * Si cambia la lista de productos, el pedido pierde la verificación. Editar solo
     * nombre o notas no la toca.
     *
     * $4 es el usuario que edita: queda como autor de los movimientos de inventario en
     * el log de actividad. El v1 no recibía ninguno.
     * Ver src/database/migrations/2026-09-01-editar-pedido-listo.sql
     */
    updateProductForSaleOrder(pfsOrder: ProductForSaleStoreOrder){
        let params = JSON.stringify({
            "$1": pfsOrder.id,
            "$2": JSON.stringify({
                ...pfsOrder
            }),
            "$3": JSON.stringify(pfsOrder.productForSaleStoreOrderElements),
            "$4": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/updateProductForSaleStoreOrderV2`, params);
    }

    /**
     * Listo -> En camino. La v2 registra in_transit_date y solo aplica si el
     * pedido sigue en Listo, así que un doble clic no reescribe la fecha.
     *
     * SIN USO desde que "En camino" dejó de ser un paso del flujo: ni el tablero
     * ni la vista de detalle lo ofrecen. Se conserva porque el estado no se
     * eliminó —los pedidos que quedaron ahí siguen siendo válidos y se reciben o
     * devuelven con normalidad— y volver a habilitarlo es reponer un botón.
     */
    updateProductForSaleOrderEnCamino(pfsOrderId: string){
        let params = JSON.stringify({
            "$1": pfsOrderId
        });
        return this.http.patch(`${environment.apiUrlV3}/updateProductForSaleStoreOrderEnCaminoV2`, params);
    }

    updateProductForSaleOrderStatus(pfsOrder: ProductForSaleStoreOrder){
        let params = JSON.stringify({
            "$1": pfsOrder.id    
        });
        return this.http.patch(`${environment.apiUrlV3}/updateProductForSaleStoreOrder`, params);
    }

    /**
     * Transiciones de estado del pedido: Listo(13), Entregado(16) y Devuelto(18).
     *
     * El procedure v3 agregó el relleno de los campos que quedaban vacíos cuando
     * el pedido toma un atajo: al ir de Pendiente directo a Listo asigna
     * encargado y hora de inicio, y al entregarlo registra la hora de recepción.
     *
     * El v4 solo suma Preparado(64) como origen válido hacia Listo, con la misma
     * validación de encargado que ya se aplicaba desde En curso.
     *
     * El v5 sumó el verificador como CUARTO parámetro: había que elegirlo de una
     * lista y sin él la transición fallaba.
     *
     * El v6 lo saca. Un pedido que llega a Listo sin firma lo firma quien lo cierra,
     * que es $3 y ya viajaba; si ya venía verificado desde Preparado, esa firma se
     * conserva. La transición no puede fallar por falta de verificador.
     * Ver src/database/migrations/2026-09-02-verificacion-por-usuario-actual.sql
     */
    private manageProductForSaleOrderState(pfsOrderId: string, factoryStatusId: number){
        let params = JSON.stringify({
            "$1": pfsOrderId,
            "$2": factoryStatusId,
            "$3": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/manageProductForSaleStoreOrderV6`, params);
    }

    /**
     * Pendiente, En curso o Preparado -> Listo. Mueve inventario: bodega -> in_transit.
     * Si el pedido no venía verificado, queda firmado por el usuario actual.
     */
    manageProductForSaleOrderStateReady(pfsOrderId: string){
        return this.manageProductForSaleOrderState(pfsOrderId, pfsFactoryOrderStatusValues.listo.status.id);
    }

    /** Listo o En camino -> Entregado. Mueve inventario: in_transit -> tienda. */
    manageProductForSaleOrderStateReceived(pfsOrderId: string){
        return this.manageProductForSaleOrderState(pfsOrderId, pfsFactoryOrderStatusValues.entregado.status.id);
    }

    /** Listo o En camino -> Devuelto. Mueve inventario: in_transit -> bodega. */
    manageProductForSaleOrderStateReturned(pfsOrderId: string){
        return this.manageProductForSaleOrderState(pfsOrderId, pfsFactoryOrderStatusValues.devuelto.status.id);
    }

    /**
     * Atajo de la tienda: Pendiente -> Entregado en un solo paso, sin pasar por
     * Listo ni En camino. La v2 rellena encargado, inicio, listo y recepción con
     * el momento de la acción.
     */
    confirmAndReceivePFSOrder(pfsOrderId: string){
        let params = JSON.stringify({
            "$1": pfsOrderId,
            "$2": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/confirmAndReceivePFSOrderV2`, params);
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
        return this.http.post(`${environment.apiUrlV3}/listShopSaleSummary`, params);
    }

    getAllShopHistory(params: any) {
        let parameters = JSON.stringify({
            ss: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/listShopSaleV3`, parameters);
    }

    getShopHistoryById(params: any) {
        let parameters = JSON.stringify({
            ss: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/getShopSaleV3`, parameters);
    }

    /**
     * `depositBank` / `depositReferenceNo` / `depositComment` / `depositDate` (y sus equivalentes
     * de envío) viajan dentro de params: la procedure registra el pago bancario si viene alguno de
     * los tres primeros. Solo aplica a las ventas con Depósito o con Cheque.
     * Ver src/database/migrations/2026-09-01-banco-y-referencia-en-pagos.sql
     */
    registerShop(params: ShopResume) {
        let parameters = JSON.stringify({
            "$1": JSON.stringify({
                ...params
            }),
            "$2": JSON.stringify(params.itemsList),
            "$3": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/registerShopV6`, parameters);
    }

    /**
     * `comment` y `date` son opcionales: si se mandan vacíos la procedure aplica
     * sus defaults (comentario NULL y fecha = now() en UTC).
     * `date` debe venir ya convertida a UTC con getUTCTimeFromLocalDateTime().
     * `$7` es el usuario que cobra, que no siempre es el que hizo la venta.
     * `$8` y `$9` son el banco y el número de transferencia o cheque: obligatorios en el
     * formulario cuando el tipo de pago es Depósito o Cheque, vacíos en el resto.
     */
    addShopSalePayment(shopSaleId: string, amount: string, paymentTypeId: string, paymentTarget: string = 'ORDER',
        comment: string = '', date: string = '', bank: string = '', referenceNo: string = '') {
        let params = JSON.stringify({
            "$1": shopSaleId,
            "$2": amount,
            "$3": paymentTypeId,
            "$4": paymentTarget,
            "$5": comment,
            "$6": date,
            "$7": this.accountService.userValue.uuid,
            "$8": bank,
            "$9": referenceNo
        });
        return this.http.patch(`${environment.apiUrlV3}/addShopSalePaymentV6`, params);
    }

    getShopSalePayments(shopSaleId: string) {
        let params = JSON.stringify({
            ssp: { shop_sale_id: shopSaleId }
        });
        return this.http.post(`${environment.apiUrlV3}/getShopSalePaymentsV6`, params);
    }

    /**
     * Abonos de crédito de un cliente en una tienda, del más reciente al más
     * antiguo y con la venta anidada en `sale`. El filtro va sobre shop_sale
     * (alias `ss`), por eso no sirve /getShopSalePaymentsV5, que filtra por
     * una sola venta. El depósito registrado con la venta queda fuera desde la
     * query: no es un abono de crédito.
     */
    getCustomerCreditPayments(establishmentId: string, customerId: string) {
        let params = JSON.stringify({
            ss: { establishment_id: establishmentId, customer_id: customerId }
        });
        return this.http.post(`${environment.apiUrlV3}/retrieveCustomerCreditPaymentsV2`, params);
    }

    /**
     * Historial de ventas de un cliente en una tienda: una fila por venta, de
     * la más reciente a la más antigua, con el tipo de pago, los estados y el
     * acumulado de abonos de cada una. Incluye las ventas que no son al crédito
     * y las de crédito sin abonos todavía, que es donde se queda corto
     * /retrieveCustomerCreditPayments (parte de shop_sale_payment).
     */
    getCustomerSalesHistory(establishmentId: string, customerId: string) {
        let params = JSON.stringify({
            ss: { establishment_id: establishmentId, customer_id: customerId }
        });
        return this.http.post(`${environment.apiUrlV3}/retrieveCustomerSalesHistory`, params);
    }

    /**
     * Solo actualiza nombre y NIT si la venta es de un cliente escrito a mano;
     * cuando la venta tiene un cliente registrado la query ignora $1 y $2.
     */
    updateShopHistory(params: ShopResume) {
        let updateShopHistory = JSON.stringify({
            "$1": params.nameClient,
            "$2": params.nitClient,
            "$3": params.nota,
            "$4": params.id
        });
        return this.http.patch(`${environment.apiUrlV3}/UpdateShopHistoryV2`, updateShopHistory);
    }

    cancelShop(params: ShopResume) {
        let deleteShopHistory = JSON.stringify({
            "$1": params.id,
            "$2": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/cancelShopHistory`, deleteShopHistory);
    }

    /** STORE EXPENSES */

    getAllStoreExpenses(params: any) {
        let parameters = JSON.stringify({
            se: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/listStoreExpense`, parameters);
    }

    getStoreExpenseById(params: any) {
        let parameters = JSON.stringify({
            se: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/getStoreExpense`, parameters);
    }

    addStoreExpense(expense: StoreExpense) {
        let parameters = JSON.stringify({
            "$1": expense.title,
            "$2": expense.comment,
            "$3": expense.totalAmount,
            "$4": expense.nit || 'C/F',
            "$5": expense.supplier,
            "$6": expense.establishmentId,
            "$7": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/addStoreExpense`, parameters);
    }

    updateStoreExpense(expense: StoreExpense) {
        let parameters = JSON.stringify({
            "$1": expense.title,
            "$2": expense.comment,
            "$3": expense.totalAmount,
            "$4": expense.nit || 'C/F',
            "$5": expense.supplier,
            "$6": expense.id
        });
        return this.http.patch(`${environment.apiUrlV3}/updateStoreExpense`, parameters);
    }

    deleteStoreExpense(id: string) {
        let parameters = JSON.stringify({
            "$1": id
        });
        return this.http.patch(`${environment.apiUrlV3}/deleteStoreExpense`, parameters);
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

    listCashClosingByFilter(params: any) {
        let parameters = JSON.stringify({
            cc: {
                ...params
            }});
        return this.http.post(`${environment.apiUrlV3}/listStoreCashClosing`, parameters);
    }

    /**
     * Las tres versiones del cierre dejan fuera de `creditPayments` los pagos
     * registrados junto con la venta (depósito): ese dinero ya viene contado
     * como venta con depósito y contarlo otra vez inflaría el cierre y el saldo
     * de crédito. Cada abono trae además el usuario que lo cobró (`creatorUser`,
     * vacío en los abonos anteriores a 2026-08-11) y el banco y número de
     * referencia del pago (`bank` / `referenceNo`, vacíos en los pagos en
     * efectivo y en los anteriores a 2026-09-01).
     *
     * OJO: los cierres YA GUARDADOS congelaron `creditPayments` como jsonb, así
     * que los anteriores a 2026-09-01 no traen banco ni referencia por más que
     * la query los pida. Las vistas muestran '--', igual que con el comentario.
     */
    getNewCashClosing(id: string) {
        let params = JSON.stringify({e: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getNewStoreCashClosingV6`, params);
    }

    getCashClosingById(id: string) {
        let params = JSON.stringify({cc: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/retrieveStoreCashClosingV7`, params);
    }

    getCashClosingByIdV2(id: string) {
        let params = JSON.stringify({cc: { "id": id}});
        return this.http.post(`${environment.apiUrlV3}/getStoreCashClosingV7`, params);
    }

    addCashClosingV2(notes: string, establishment_id: string){
        let params = JSON.stringify({
            "$1": notes,
            "$2": establishment_id,
            "$3": this.accountService.userValue.uuid
        });
        return this.http.patch(`${environment.apiUrlV3}/addStoreCashClosing`, params);
    }

    addCashClosingV3(notes: string, establishment_id: string, sobrante: number = 0){
        let params = JSON.stringify({
            "$1": notes,
            "$2": establishment_id,
            "$3": this.accountService.userValue.uuid,
            "$4": sobrante
        });
        return this.http.patch(`${environment.apiUrlV3}/addStoreCashClosingV3`, params);
    }

    addCashClosingV4(notes: string, establishment_id: string, sobrante: number = 0){
        let params = JSON.stringify({
            "$1": notes,
            "$2": establishment_id,
            "$3": this.accountService.userValue.uuid,
            "$4": sobrante
        });
        return this.http.patch(`${environment.apiUrlV3}/addStoreCashClosingV4`, params);
    }

    addCashClosingV5(notes: string, establishment_id: string, sobrante: number = 0){
        let params = JSON.stringify({
            "$1": notes,
            "$2": establishment_id,
            "$3": this.accountService.userValue.uuid,
            "$4": sobrante
        });
        return this.http.patch(`${environment.apiUrlV3}/addStoreCashClosingV5`, params);
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