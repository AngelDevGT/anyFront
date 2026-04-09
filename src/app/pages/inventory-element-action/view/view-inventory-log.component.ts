import { Component, OnInit} from '@angular/core';
import { DatePipe } from '@angular/common';

import { AccountService, AlertService, DataService, measureUnitsConst } from '@app/services';
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
import { InventoryElementAction } from '@app/models/inventory/inventory-element-action.model';
import { Inventory } from '@app/models/inventory/inventory.model';

@Component({ 
    templateUrl: 'view-inventory-log.component.html',
    styleUrls: ['view-inventory-log.component.scss'],
    providers: [DatePipe]
})
export class ViewInventoryLogComponent implements OnInit {
    inventoryLogs?: InventoryElementAction[];
    allInventoryLogs?: InventoryElementAction[];
    inventoryType?: string;
    unitName?: string;
    productType?: number;
    section?: string;
    title?: string;
    dateRange?: string;
    userOptions?: User[];
    cardElements?: any[];
    logForm!: FormGroup;
    maxDate: Date = new Date();
    searchTerm?: string;
    entries = this.dataService.tableEntries;
    pageSize = this.dataService.defaultPageSize;
    page = 1;

    constructor(private dataService: DataService, private route: ActivatedRoute, private accountService: AccountService, 
        private datePipe: DatePipe, private alertService: AlertService) {
        // this.selectedSortOptSubject.subscribe(value => {
        //     this.sortDataByDate(value);
        // });
    }

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            this.inventoryType = params['type'];
            this.unitName = params['unit'];
            this.productType = params['productType'] ? Number(params['productType']) : undefined;
            // this.section = params['sec'];
            // this.title = this.section?.split('|||')[0];
        });
        this.logForm = this.createFormGroup();
        this.retriveActivityLogs();
    }

    retriveActivityLogs(userId?: string, startDate?: string, endDate?: string){
        let activityLogFilter: any = {
            i :{
                inventory_type: this.inventoryType,
                unit_name: this.unitName
            }
        };
        // activityLogFilter.section = this.section;
        if (userId && userId !== ""){
            activityLogFilter.u = { id: userId };
        }
        const nowObject = new Date();
        let startDateObject = new Date(nowObject.getFullYear(), nowObject.getMonth(), 1, 0, 0, 0, 0);
        let endDateObject = nowObject;

        if (startDate && startDate !== "" && endDate && endDate !== "") {
            startDateObject = new Date(startDate);
            endDateObject = new Date(endDate);
            endDateObject.setHours(23, 59, 59, 999);
        } 

        const startDateOnly = new Date(startDateObject).toLocaleDateString('es-GT').replace(/-/g, '/');
        const endDateOnly = new Date(endDateObject).toLocaleDateString('es-GT').replace(/-/g, '/');

        let formmatedStartDateTime = this.datePipe.transform(startDateObject, 'yyyy-MM-dd HH:mm:ss', 'UTC');
        let formmatedEndDateTime = this.datePipe.transform(endDateObject, 'yyyy-MM-dd HH:mm:ss', 'UTC');

        let filterDates = {
            "creation_date$gte": formmatedStartDateTime,
            "creation_date$lte": formmatedEndDateTime
        };

        activityLogFilter = {
            ...activityLogFilter,
            ...filterDates
        };

        this.dateRange = `${startDateOnly} - ${endDateOnly}`;

        // this.cardElements = [];
        let requestArray = [];
        this.inventoryLogs = undefined;
        this.allInventoryLogs = undefined;
        this.cardElements = [];

        let catalogFilter = '';
        switch (this.inventoryType) {
            case 'product_for_sale':
                catalogFilter = 'retriveProductForSaleInventoryActions';
                break;
            case 'raw_material':
                catalogFilter = 'retriveRawMaterialInventoryActions';
                break;
            case 'finished_product':
                catalogFilter = 'retriveFinishedProductInventoryActions';
                break;
            default:
                catalogFilter = 'default_catalog';
                break;
        }

        requestArray.push(this.dataService.getAllInventoryLogsByFilter(activityLogFilter, catalogFilter));
        if (this.userOptions == undefined) {
            requestArray.push(this.accountService.getAllUsersByFilter({ status_id: 2 }));
        }

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.inventoryLogs = this.dataService.findJsonValue(result[0], 'json_result') || [];
                this.allInventoryLogs = this.inventoryLogs;
                if (result[1]) {
                    this.userOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];
                }
            },
            error: (e) =>  this.alertService.error(this.dataService.findJsonValue(e, 'AcknowledgementDescription')),
            complete: () => {
                if (this.productType !== undefined) {
                    this.inventoryLogs = this.allInventoryLogs?.filter(log =>
                        (log.element?.finishedProductTypeId ?? 1) === this.productType
                    );
                    this.allInventoryLogs = this.inventoryLogs;
                }
                this.setCardElements(this.inventoryLogs);
            }
        });
    }

    initConstantValues(){
        
    }

    search(value: any): void {
        if (this.allInventoryLogs) {
            this.inventoryLogs = this.allInventoryLogs?.filter((val) => {
                if(this.searchTerm){
                    const descriptionMatch = val.actionType?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const reasonMatch = val.reason?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const elementMatch = val.element?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const userMatch = val.creatorUser?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return descriptionMatch || userMatch || reasonMatch || elementMatch;
                }
                return true;
            });
        }
        this.setCardElements(this.inventoryLogs);
    }

    setCardElements(elements?: InventoryElementAction[]) {
        elements = elements?.sort((a, b) => new Date(b.creationDate!).getTime() - new Date(a.creationDate!).getTime());
        this.cardElements = [];
        elements?.forEach((element: InventoryElementAction) => {
            let cardElement = [
                { value: element.actionType?.color, title: "cardColor", type: "color" },
                { value: element.actionType?.action, title: "", type: "title" },
                { value: this.dataService.getLocalDateTimeFromUTCTime(element.creationDate!), title: "Fecha", type: "row" },
                { value: element.actionType?.name, title: "Descripcion", type: "row" },
                { value: element.reason, title: "Razon", type: "row" },
                { value: element.element?.name, title: "Elemento", type: "row" },
                { value: `${element.quantity} ${element.measure?.identifier}(s)`, title: "Cantidad", type: "row" },
                { value: `${element.creatorUser?.name} (${element.creatorUser?.email})`, title: "Usuario", type: "row" },
            ]

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