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
    templateUrl: 'summary-pfs-inventory-store.component.html',
    styleUrls: ['summary-pfs-inventory-store.component.scss']
})
export class SummaryProductForSaleInventoryFactoryComponent implements OnInit {
    inventory?: Inventory;
    inventoryElements?: InventoryElement[];
    allInventoryElements?: InventoryElement[];
    establishmentOptions?: Establishment[];
    statusOptions?: Status[];
    productForm!: FormGroup;
    maxDate: Date = new Date();
    searchTerm?: string;
    entries = [5, 10, 20, 50];
    pageSize = 5;
    page = 1;
    tableElementsValues?: any;

    constructor(private dataService: DataService, private alertService: AlertService) {
        // this.selectedSortOptSubject.subscribe(value => {
        //     this.sortDataByDate(value);
        // });
    }

    ngOnInit() {
        this.inventory = undefined;
        this.productForm = this.createFormGroup();
        this.retriveInventoryElements();
    }

    retriveInventoryElements(){

        let requestArray = [];
        this.inventoryElements = undefined;

        requestArray.push(this.dataService.getInventory({ _id: "65bf467e008f7e88678d3927"}));
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "status", enableElements: "true"}));
        requestArray.push(this.dataService.getAllEstablishmentsByFilter({"status": 1}));

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.inventory = result[0].getInventoryResponse.Inventory;
                this.statusOptions = result[1].retrieveCatalogGenericResponse.elements;
                this.establishmentOptions = result[2].findEstablishmentResponse?.establishment;
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
                    const nameMatch = val.productForSale?.finishedProduct?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const measureMatch = val.measure?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const establishmentMatch = val.productForSale?.establishment?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return nameMatch || measureMatch || establishmentMatch;
                }
                return true;
            });
        }
        this.setTableElements(this.inventoryElements);
    }

    setTableElements(elements?: InventoryElement[]){
        this.tableElementsValues = [];
        elements?.forEach((element: InventoryElement) => {
            const curr_row = [
                    // { type: "text", value: this.dataService.getLocalDateFromUTCTime(element.updateDate!), header_name: "Fecha" },
                    { type: "text", value: element.productForSale?.finishedProduct?.name, header_name: "Producto" },
                    { type: "text", value: element.productForSale?.establishment?.name, header_name: "Tienda" },
                    // { type: "text", value: element.rawMaterialOrderElements.length, header_name: "Cantidad" },
                    { type: "text", value: "Activo", header_name: "Estado" },
                    { type: "text", value: element.measure?.identifier, header_name: "Medida" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.productForSale!.price)), header_name: "Precio" },
                    { type: "text", value: element.quantity, header_name: "Cantidad" }
            ];

            this.tableElementsValues.push(curr_row);
        });
    }

    createFormGroup() {
        return new FormGroup({
            orderStatus: new FormControl('', [Validators.maxLength(45)]),
            establishment: new FormControl('', [Validators.maxLength(45)])
        });
    }

    filterElements(){
        let filters = this.productForm.value;
        if (this.allInventoryElements){
            this.inventoryElements = this.allInventoryElements?.filter((val) => {
                const statusMatch = filters.orderStatus !== "" ? String(val.status?.id) === filters.orderStatus : true;
                const establishmentMatch = filters.establishment !== "" ? val.productForSale?.establishment?._id === filters.establishment : true;
                return statusMatch && establishmentMatch;
            });
        }
        this.setTableElements(this.inventoryElements);
    }

    exportDataToCsv(){
        const finalCsvValues = this.inventoryElements?.map(element => {
            return {
                Nombre: element.finishedProduct?.name,
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
        new ngxCsv(finalCsvValues, "Resumen_inventario_producto_terminado_fabrica_" + this.maxDate.getTime(), csvOptions);
    }

}