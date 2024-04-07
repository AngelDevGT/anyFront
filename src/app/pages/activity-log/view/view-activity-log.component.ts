import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { filter, first } from 'rxjs/operators';
import {map, startWith} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';
import { ngxCsv } from 'ngx-csv';

import { AccountService, AlertService, DataService, paymentStatusValues, statusValues} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Establishment } from '@app/models/establishment.model';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import { BehaviorSubject, forkJoin } from 'rxjs';
import { MatSelectChange } from '@angular/material/select';
import { Provider } from '@app/models/system/provider.model';
import { Status } from '@app/models';
import { InventoryElement } from '@app/models/inventory/inventory-element.model';
import { Inventory } from '@app/models/inventory/inventory.model';
import { ActivityLog } from '@app/models/system/activity-log';
import { User } from '@app/models/system/user.model';
import { LogElement } from '@app/models/system/log-element';
import { ActivatedRoute } from '@angular/router';

@Component({ 
    templateUrl: 'view-activity-log.component.html',
    styleUrls: ['view-activity-log.component.scss']
})
export class ViewActivityLogComponent implements OnInit {
    activityLogs?: ActivityLog[];
    allActivityLogs?: ActivityLog[];
    section?: string;
    title?: string;
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
        if (startDate && startDate !== "" && endDate && endDate !== "") {
            const startDateOnly = new Date(startDate).toISOString().split('T')[0].replace(/-/g, '/');
            const endDateOnly = new Date(endDate).toISOString().split('T')[0].replace(/-/g, '/');
            activityLogFilter.initialDate = startDateOnly;
            activityLogFilter.finalDate = endDateOnly;
        }
        console.log(activityLogFilter);

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
        this.cardElements = [];
        elements?.forEach((element: ActivityLog) => {

            let cardElement = [
                { value: element.action === "movement" ? "primary" : element.action === "remove" ? "danger" : "success", title: "cardColor", type: "color" },
                { value: element.action === "movement" ? "Movimiento" : element.action === "remove" ? "Retiro" : "Ingreso", title: "", type: "title" },
                { value: this.dataService.getLocalDateFromUTCTime(element.creationDate!), title: "Fecha", type: "row" },
                { value: element.description, title: "Descripcion", type: "row" }
            ]

            if(element.extra?.reason){
                cardElement.push({ value: element.extra?.reason, title: "Razon", type: "row" });
            }

            if(this.section?.includes("Materia Prima por Proveedor")){
                cardElement.push(
                    { value: element?.extra?.inventoryElement?.rawMaterialByProvider?.rawMaterialBase?.name, title: "Elemento", type: "row" },
                    { value: `${element.extra?.inventoryElement?.quantity} (${element.extra?.inventoryElement?.measure?.identifier})`, title: "Cantidad original", type: "row" }
                );
            }

            if(this.section?.includes("Producto para Venta")){
                cardElement.push(
                    { value: element?.extra?.inventoryElement?.productForSale?.finishedProduct?.name, title: "Elemento", type: "row" },
                    { value: `${element.extra?.inventoryElement?.quantity} (${element.extra?.inventoryElement?.measure?.identifier})`, title: "Cantidad original", type: "row" }
                );
            }

            if(element.action === "movement"){
                cardElement.push(
                    { value: `${element.request?.quantity} (${element.request?.measure?.identifier})`, title: "Cantidad movida", type: "row" }
                );
            } else {
                cardElement.push(
                    { value: `${element?.request?.newQuantity} (${element.extra?.inventoryElement?.measure?.identifier})`, title: "Cantidad final", type: "row" },
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