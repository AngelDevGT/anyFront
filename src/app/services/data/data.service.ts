import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '@environments/enviroment';
import { User } from '@app/models';
import { Establishment } from '@app/models/establishment.model';
import { ProductForSale } from '@app/models/producto-for-sale.model';

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
        product.creatorUser = " ";
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

    addProvider(establishment: Establishment){
        let params = JSON.stringify({
            addProvider: {
                ...establishment,
                "creatorUser": " ",
            }});
        return this.http.post(`${environment.apiUrl}/addProvider`, params);
    }

    updateProvider(id: string, establishment: Establishment){
        let params = JSON.stringify({
            updateProvider: {
                "_id": id,
                ...establishment
            }});
        return this.http.post(`${environment.apiUrl}/updateProvider`, params);
    }

    deleteProvider(params: any) {
        let deleteUser = JSON.stringify({
            updateProvider: {
                ...params
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

}