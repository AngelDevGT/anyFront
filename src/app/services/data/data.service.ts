import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '@environments/enviroment';
import { Role, User } from '@app/models';
import { Establishment } from '@app/models/establishment.model';
import { ProductForSale } from '@app/models/producto-for-sale.model';
import { Provider } from '@app/models/system/provider.model';
import { RawMaterialBase } from '@app/models/raw-material/raw-material-base.model';
import { RawMaterialByProvider } from '@app/models/raw-material/raw-material-by-provider.model';

const activeStatus = {
    status: {
        "id": 2,
        "status": 1,
        "text": "1",
        "identifier": "Activo"
    }
};

const deleteStatus = {
    status: {
        "id": 3,
        "status": 1,
        "text": "2",
        "identifier": "Eliminado"
    }
}

@Injectable({ providedIn: 'root' })
export class DataService {

    constructor( private router: Router, private http: HttpClient ) {
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

    addProduct(product: ProductForSale, productImg: string){
        product.photo = productImg;
        if (productImg === ""){
            delete product.photo;
        }
        console.log(product)
        product.creatorUser = " ";
        let params = JSON.stringify({
            addProduct: {
                ...product,
            }});
        return this.http.post(`${environment.apiUrl}/addProduct`, params);
    }

    updateProduct(id: string, product: ProductForSale, productImg: string){
        if (productImg !== ""){
            product.photo = productImg;
        }
        product._id = id;
        let params = JSON.stringify({
            updateProduct: {
                ...product,
            }});
        return this.http.post(`${environment.apiUrl}/updateProduct`, params);
    }

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
            findEstablishment: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/retrieveEstablishments`, parameters);
    }

    getEstablishmentById(id: string) {
        let params = JSON.stringify({findEstablishment: { "_id": id}});
        return this.http.post(`${environment.apiUrl}/retrieveEstablishments`, params);
    }

    getShortEstablishmentInfo(establishment: Establishment){
        return establishment.name + " (" + establishment.address + ")";
    }

    addEstablishment(establishment: Establishment){
        let params = JSON.stringify({
            addEstablishment: {
                ...establishment,
                "creatorUser": " ",
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
                ...params
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
                "creatorUser": " ",
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


    /** IMAGE */

    getImageById(id: string) {
        let params = JSON.stringify({getImage: { "_id": id}});
        return this.http.post(`${environment.apiUrl}/getImage`, params);
    }

    /** STATUS */

    getStatusByNumber(id: number){
        return id == 0 ? "Inactivo" : id == 1 ? "Activo" : id == 2 ? "Eliminado" : "Sin definir";
    }

    /** DATE */
    
    getLocalDateTimeFromUTCTime(utcTime: string){
        let date = new Date(utcTime.replaceAll("\"",""));
        return date.toLocaleString();
    }

    getLocalDateFromUTCTime(utcTime: string){
        let date = new Date(utcTime.replaceAll("\"",""));
        return date.toJSON().slice(0, 10);
    }

    /** MEASURE */

    getMeasureByName(measure: string){
        if(measure == "unit")
            return "Unidades"
        if(measure == "onz")
            return "Onzas"
        return "Sin Definir"
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

    addRawMaterial(rawMaterial: RawMaterialBase, img: string){
        rawMaterial.photo = img;
        if (img === ""){
            delete rawMaterial.photo;
        }
        let params = JSON.stringify({
            addRawMaterial: {
                ...rawMaterial,
                ...activeStatus,
                "creatorUser": " ",
            }});
        return this.http.post(`${environment.apiUrl}/addRawMaterial`, params);
    }

    updateRawMaterial(id: string, rawMaterial: RawMaterialBase, img: string){
        if (img !== ""){
            rawMaterial.photo = img;
        }
        let params = JSON.stringify({
            updateRawMaterial: {
                "_id": id,
                ...rawMaterial
            }});
        console.log(params);
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
                "creatorUser": " ",
            }});
        return this.http.post(`${environment.apiUrl}/AddRawMaterialByProvider`, params);
    }

    updateRawMaterialByProvider(id: string, rawMaterial: RawMaterialByProvider){
        let params = JSON.stringify({
            updateRawMaterialByProvider: {
                "_id": id,
                ...rawMaterial
            }});
        console.log(params);
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
    

}