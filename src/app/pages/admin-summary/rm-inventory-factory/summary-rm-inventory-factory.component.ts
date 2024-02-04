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

@Component({ 
    templateUrl: 'summary-rm-inventory-factory.component.html',
    styleUrls: ['summary-rm-inventory-factory.component.scss']
})
export class SummaryRawMaterialByProviderInventoryFactoryComponent implements OnInit {
    inventory?: Inventory;
    inventoryElements?: InventoryElement[];
    allInventoryElements?: InventoryElement[];
    statusOptions?: Status[];
    productForm!: FormGroup;
    maxDate: Date = new Date();
    searchTerm?: string;
    entries = [5, 10, 20, 50];
    pageSize = 5;
    page = 1;
    tableElementsValues?: any;
    tableHeaders = [
        {
            style: "width: 15%",
            name: "Producto"
        },
        {
            style: "width: 10%",
            name: "Estado"
        },
        {
            style: "width: 10%",
            name: "Medida"
        },
        {
            style: "width: 10%",
            name: "Cantidad"
        }
        // {
        //     style: "width: 10%",
        //     name: "Acciones"
        // }
    ];

    constructor(private dataService: DataService, private alertService: AlertService) {
        // this.selectedSortOptSubject.subscribe(value => {
        //     this.sortDataByDate(value);
        // });
    }

    ngOnInit() {
        this.inventory = undefined;
        this.productForm = this.createFormGroup();
        this.retriveRawMaterialOrders();
    }

    retriveRawMaterialOrders(){

        let requestArray = [];
        this.inventoryElements = undefined;

        requestArray.push(this.dataService.getAllInventoryByFilter({ _id: "64d7240f838808573bd7e9ee"}));
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "status", enableElements: "true"})); 

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.inventory = result[0].retrieveInventoryResponse?.Inventorys[0];
                this.statusOptions = result[1].retrieveCatalogGenericResponse.elements;
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                if (this.inventory){
                    this.inventoryElements = this.inventory?.inventoryElements;
                    this.allInventoryElements = this.inventoryElements;
                    this.setTableElements(this.inventoryElements);
                }
            }
        });
    }

    initConstantValues(){
        
    }

    search(value: any): void {
        if (this.allInventoryElements){
            this.inventoryElements = this.allInventoryElements?.filter((val) => {
                if(this.searchTerm){
                    const nameMatch = val.rawMaterialBase?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const measureMatch = val.measure?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const providerMatch = val.rawMaterialByProvider?.provider?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const providerMatch = val.provider?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const paymentTypeMatch = val.paymentType?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const paymentStatusMatch = val.paymentStatus?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const finalAmountMatch = val.finalAmount <= this.searchTerm;
                    // const pendingAmountMatch = val.pendingAmount?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return nameMatch || measureMatch;
                }
                return true;
            });
        }
        this.setTableElements(this.inventoryElements);
    }

    setTableElements(elements?: InventoryElement[]){
        this.tableElementsValues = {
            headers: this.tableHeaders,
            rows: []
        }
        elements?.forEach((element: InventoryElement) => {
            const curr_row = {
                row: [
                    // { type: "text", value: this.dataService.getLocalDateFromUTCTime(element.updateDate!), header_name: "Fecha" },
                    { type: "text", value: element.rawMaterialBase?.name, header_name: "Producto" },
                    // { type: "text", value: element.rawMaterialOrderElements.length, header_name: "Cantidad" },
                    { type: "text", value: "Activo", header_name: "Estado" },
                    { type: "text", value: element.measure?.identifier, header_name: "Medida" },
                    { type: "text", value: element.quantity, header_name: "Cantidad" }
                  ],
            }

            this.tableElementsValues.rows.push(curr_row);
        });
    }

    createFormGroup() {
        return new FormGroup({
            orderStatus: new FormControl('', [Validators.maxLength(45)])
        });
    }

    filterElements(){
        let filters = this.productForm.value;
        if (this.allInventoryElements){
            this.inventoryElements = this.allInventoryElements?.filter((val) => {
                const statusMatch = filters.orderStatus !== "" ? String(val.status?.id) === filters.orderStatus : true;
                return statusMatch ;
            });
        }
        this.setTableElements(this.inventoryElements);
    }

    exportDataToCsv(){
        const finalCsvValues = this.inventoryElements?.map(element => {
            return {
                Nombre: element.rawMaterialBase?.name,
                "Estado": "Activo",
                "Usuario Creador": element.creatorUser?.name,
                InventoryID: this.inventory?._id
            };
        });
        const csvOptions = {
            fieldSeparator: ',',
            quoteStrings: '"',
            decimalseparator: '.',
            showLabels: true,
            headers: [ "Nombre", "Estado", "Usuario Creador", "ID Inventario"]
        }
        new ngxCsv(finalCsvValues, "Resumen_inventario_materia_prima_fabrica_" + this.maxDate.getTime(), csvOptions);
    }

}