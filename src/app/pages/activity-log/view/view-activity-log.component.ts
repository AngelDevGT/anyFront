import { Component, OnInit } from '@angular/core';

import { AccountService, DataService, measureUnitsConst } from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { BehaviorSubject, forkJoin } from 'rxjs';
import { ActivityLog } from '@app/models/system/activity-log';
import { User } from '@app/models/system/user.model';
import { LogElement } from '@app/models/system/log-element';
import { ItemsList } from '@app/models/store/item-list.model';
import { ActivatedRoute } from '@angular/router';
import { FinishedProductCreationConsumedElement } from '@app/models/product/fp-creation-consumed-element.model';
import { FinishedProductCreationProducedElement } from '@app/models/product/fp-creation-produced-element.model';
import { Measure } from '@app/models';

@Component({ 
    templateUrl: 'view-activity-log.component.html',
    styleUrls: ['view-activity-log.component.scss']
})
export class ViewActivityLogComponent implements OnInit {
    activityLogs?: ActivityLog[];
    allActivityLogs?: ActivityLog[];
    section?: string;
    title?: string;
    dateRange?: string;
    userOptions?: User[];
    cardElements?: any[];
    logForm!: FormGroup;
    maxDate: Date = new Date();
    searchTerm?: string;
    entries = [5, 10, 20, 50];
    pageSize = 5;
    page = 1;

    constructor(private dataService: DataService, private route: ActivatedRoute, private accountService: AccountService) {
        // this.selectedSortOptSubject.subscribe(value => {
        //     this.sortDataByDate(value);
        // });
    }

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            this.section = params['sec'];
            this.title = this.section?.split('|||')[0];
        });
        this.logForm = this.createFormGroup();
        this.retriveActivityLogs();
    }

    retriveActivityLogs(userId?: string, startDate?: string, endDate?: string){
        let activityLogFilter: any = {};
        activityLogFilter.section = this.section;
        if (userId && userId !== ""){
            activityLogFilter.user = { _id: userId };
        }
        const nowObject = new Date();
        let startDateObject = new Date(nowObject.getFullYear(), nowObject.getMonth(), 1, 0, 0, 0, 0);
        let endDateObject = nowObject;

        if (startDate && startDate !== "" && endDate && endDate !== "") {
            startDateObject = new Date(startDate);
            endDateObject = new Date(endDate);
        } 

        const startDateOnly = new Date(startDateObject).toLocaleDateString('es-GT').replace(/-/g, '/');
        const endDateOnly = new Date(endDateObject).toLocaleDateString('es-GT').replace(/-/g, '/');
        const startDateUS = new Date(startDateObject).toLocaleDateString('en-US').replace(/-/g, '/');
        const endDateUS = new Date(endDateObject).toLocaleDateString('en-US').replace(/-/g, '/');
        activityLogFilter.initialDate = startDateUS;
        activityLogFilter.finalDate = endDateUS;

        this.dateRange = `${startDateOnly} - ${endDateOnly}`;

        this.cardElements = [];
        let requestArray = [];
        this.activityLogs = undefined;

        requestArray.push(this.dataService.getAllActivityLogsByFilter(activityLogFilter));
        requestArray.push(this.accountService.getAllUsersByFilter({ status: { id: 2 }}));

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.activityLogs = result[0].retrieveActivityLogResponse?.activityLogs;
                this.allActivityLogs = this.activityLogs;
                this.userOptions = result[1].retrieveUsersResponse?.users;
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.setCardElements(this.activityLogs);
            }
        });
    }

    initConstantValues(){
        
    }

    search(value: any): void {
        if (this.allActivityLogs){
            this.activityLogs = this.allActivityLogs?.filter((val) => {
                if(this.searchTerm){
                    const descriptionMatch = val.description?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const userMatch = val.user?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return descriptionMatch || userMatch;
                }
                return true;
            });
        }
        this.setCardElements(this.activityLogs);
    }

    setCardElements(elements?: ActivityLog[]){
        elements = elements?.sort((a, b) => new Date(b.creationDate!).getTime() - new Date(a.creationDate!).getTime());
        this.cardElements = [];
        elements?.forEach((element: ActivityLog) => {

            let isUnidad = element.extra?.inventoryElement?.measure?.id === measureUnitsConst.unidad.id ? true : false;

            let cardElement = [
                { value: this.dataService.getLogActionColor(element.action), title: "cardColor", type: "color" },
                { value: this.dataService.getLogActionName(element.action), title: "", type: "title" },
                { value: this.dataService.getLocalDateTimeFromUTCTime(element.creationDate!), title: "Fecha", type: "row" },
                { value: element.description, title: "Descripcion", type: "row" }
            ]

            if(element.extra?.reason){
                cardElement.push({ value: element.extra?.reason, title: "Razon", type: "row" });
            }

            if(this.section?.includes("Materia Prima por Proveedor")){
                cardElement.push(
                    { value: element?.extra?.inventoryElement?.rawMaterialByProvider?.rawMaterialBase?.name, title: "Elemento", type: "row" },
                );
            }

            if(this.section?.includes("Materia Prima en")){
                if(element.action === "consume"){
                    cardElement.push(
                        { value: element?.request?.rawMaterialList?.map((fpcElement: FinishedProductCreationConsumedElement) => fpcElement.rawMaterialName).join(", "), title: "Elemento(s)", type: "row" },
                    );
                } else {
                    cardElement.push(
                        { value: element?.extra?.inventoryElement?.rawMaterialBase?.name, title: "Elemento", type: "row" },
                    );
                }
            }

            if(this.section?.includes("Producto para Venta")){
                if(element.action === "sale" || element.action === "cancel"){
                    cardElement.push(
                        { value: element?.request?.itemsList?.map((item: ItemsList) => item.productForSale?.finishedProduct?.name).join(", "), title: "Elemento(s)", type: "row" },
                    );
                } else {
                    cardElement.push(
                        { value: element?.extra?.inventoryElement?.productForSale?.finishedProduct?.name, title: "Elemento", type: "row" },
                    );
                }
            }

            if(this.section?.includes("Producto en Inventario")){
                if(element.action === "creation"){
                    cardElement.push(
                        { value: element?.request?.finishedProductList?.map((fpcElement: FinishedProductCreationProducedElement) => fpcElement.finishedProductName).join(", "), title: "Elemento(s)", type: "row" },
                    );
                } else {
                    cardElement.push(
                        { value: element?.extra?.inventoryElement?.finishedProduct?.name, title: "Elemento", type: "row" },
                    );
                }
            }

            if(element.action === "consume"){
                for (let i = 0; i < element.request?.rawMaterialList?.map((fpcElement: FinishedProductCreationConsumedElement) => fpcElement.rawMaterialName).length; i++) {
                    let currIsUnidad = element.request?.rawMaterialList[i]?.measure?.id === measureUnitsConst.unidad.id ? true : false;
                    let quantityUnit = currIsUnidad ? "Docena" : element.request?.rawMaterialList[i]?.measure?.identifier;
                    let newQuantity = currIsUnidad ? Number(Number(element.request?.rawMaterialList[i]?.quantity)/12).toFixed(2) : element.request?.rawMaterialList[i]?.quantity;
                    cardElement.push(
                        { value: `${element.request?.rawMaterialList[i]?.rawMaterialName} (${newQuantity} ${quantityUnit})`, title: "Consumo", type: "row" }
                    );
                }
            } else if(element.action === "creation"){
                for (let i = 0; i < element.request?.finishedProductList?.map((fpcElement: FinishedProductCreationProducedElement) => fpcElement.finishedProductName).length; i++) {
                    let currIsUnidad = element.request?.finishedProductList[i]?.measure?.id === measureUnitsConst.unidad.id ? true : false;
                    let quantityUnit = currIsUnidad ? "Docena" : element.request?.finishedProductList[i]?.measure?.identifier;
                    let newQuantity = currIsUnidad ? Number(Number(element.request?.finishedProductList[i]?.quantity)/12).toFixed(2) : element.request?.finishedProductList[i]?.quantity;
                    cardElement.push(
                        { value: `${element.request?.finishedProductList[i]?.finishedProductName} (${newQuantity} ${quantityUnit})`, title: "Registro", type: "row" }
                    );
                }
            } else if(element.action === "sale" || element.action === "cancel"){
                let docenaObject = measureUnitsConst.docena;
                let libraObject = measureUnitsConst.libra;
                for (let i = 0; i< element.request?.itemsList?.map((item: ItemsList) => item.productForSale?.finishedProduct?.name).length; i++){
                    let currIsUnidad = element.request?.itemsList[i]?.productForSale?.finishedProduct?.measure?.id === measureUnitsConst.unidad.id ? true : false;
                    let quantityUnit = currIsUnidad ? "Docena" : element.request?.itemsList[i]?.productForSale?.finishedProduct?.measure?.identifier;
                    let newQuantity = this.dataService.getConvertedMeasure(Number(element.request?.itemsList[i]?.quantity * element.request?.itemsList[i]?.measure.unitBase!.quantity), {"unitBase": {name: docenaObject.unitBase.name, quantity: String(docenaObject.unitBase.quantity)}}, {"unitBase": {name: libraObject.unitBase.name, quantity: String(libraObject.unitBase.quantity)}}, element.request?.itemsList[i]?.measure);
                    console.log(element.request?.itemsList[i]);
                    cardElement.push(
                        { value: `${newQuantity} ${quantityUnit}(s) de ${element.request?.itemsList[i]?.productForSale?.finishedProduct?.name}`, title: "Venta", type: "row" }
                    );
                }
            } else {
                let quantityUnit = isUnidad ? "Docena" : element.extra?.inventoryElement?.measure?.identifier;
                let newQuantity = isUnidad ? Number(Number(element.request?.newQuantity)/12).toFixed(2) : element.request?.newQuantity;
                let quantity = isUnidad ? Number((Number(element.extra?.inventoryElement?.quantity)||0)/12).toFixed(2) : element.extra?.inventoryElement?.quantity;
                let modifiedQuantity = isUnidad ? Number((Number(element.request?.newQuantity) - Number(element.extra?.inventoryElement?.quantity))/12).toFixed(2) || 0 : Number(element.request?.newQuantity) - Number(element.extra?.inventoryElement?.quantity) || 0;

                cardElement.push(
                    { value: `${quantity} (${quantityUnit})`, title: "Cantidad original", type: "row" },
                    { value: `${newQuantity} (${quantityUnit})`, title: "Cantidad final", type: "row" },
                    { value: `${modifiedQuantity} (${quantityUnit})`, title: "Cantidad modificada",  type: "row" },
                );
                
            }

            cardElement.push(
                { value: element.user?.name, title: "Usuario", type: "row" });

            this.cardElements?.push(cardElement);
        });
    }

    createFormGroup() {
        return new FormGroup({
            user: new FormControl('', [Validators.maxLength(45)]),
            startDate: new FormControl('', [Validators.maxLength(45)]),
            endDate: new FormControl('', [Validators.maxLength(45)])
        });
    }

    filterElements(){
        let filters = this.logForm.value;
        this.retriveActivityLogs(filters.user, filters.startDate, filters.endDate);
    }

}