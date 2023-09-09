import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import {map, startWith} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';

import { AccountService, AlertService, DataService} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Establishment } from '@app/models/establishment.model';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import { Inventory } from '@app/models/inventory/inventory.model';
import { InventoryElement } from '@app/models/inventory/inventory-element.model';

@Component({ 
    templateUrl: 'list-inventory-rmp-bodega.component.html',
    styleUrls: ['list-inventory-rmp-bodega.component.scss']
})
export class ListInventoryRMProviderBodegaComponent implements OnInit {

    inventory?: Inventory;
    inventoryElements?: InventoryElement[];
    allInventoryElements?: InventoryElement[];
    searchTerm?: string;
    entries = [5, 10, 20, 50];
    pageSize = 5;
    page = 1;
    tableElementsValues?: any;
    tableHeaders = [
        {
            style: "width: 20%",
            name: "Nombre"
        },
        {
            style: "width: 20%",
            name: "Proveedor"
        },
        {
            style: "width: 10%",
            name: "Medida"
        },
        {
            style: "width: 10%",
            name: "Cantidad"
        },
        {
            style: "width: 15%",
            name: "Precio"
        },
        {
            style: "width: 15%",
            name: "Estado"
        },
        // {
        //     style: "width: 10%",
        //     name: "Monto pendiente"
        // },
        {
            style: "width: 10%",
            name: "Acciones"
        }
    ];

    constructor(private dataService: DataService, private alertService: AlertService) {}

    ngOnInit() {
        this.retriveInventory();
    }

    retriveInventory(){
        this.inventory = undefined;
        this.dataService.getAllInventoryByFilter({
                status: {
                    id: 2
                },
                inventoryType: {
                    id: 2
                }
            })
            .pipe(first())
            .subscribe({
                next: (inv: any) => {
                    let invValues = inv.retrieveInventoryResponse?.Inventorys;
                    if(invValues.length > 0){
                        this.inventory = invValues[0];
                        this.inventoryElements = this.inventory?.inventoryElements;
                        this.allInventoryElements = this.inventoryElements;
                        this.setTableElements(this.inventoryElements);
                    }
                }
            });
    }

    search(value: any): void {
        if (this.allInventoryElements){
            this.inventoryElements = this.allInventoryElements?.filter((val) => {
                if(this.searchTerm){
                    const nameMatch = val.rawMaterialByProvider?.rawMaterialBase?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const commentMatch = val.comment?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const providerMatch = val.rawMaterialByProvider?.provider?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const paymentTypeMatch = val.paymentType?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const paymentStatusMatch = val.paymentStatus?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const finalAmountMatch = val.finalAmount?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const pendingAmountMatch = val.pendingAmount?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return nameMatch || providerMatch;
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
                    { type: "text", value: element.rawMaterialByProvider?.rawMaterialBase?.name, header_name: "Nombre" },
                    { type: "text", value: element.rawMaterialByProvider?.provider?.name, header_name: "Proveedor" },
                    // { type: "text", value: element.rawMaterialOrderElements.length, header_name: "Cantidad" },
                    { type: "text", value: element.measure?.identifier, header_name: "Medida" },
                    { type: "text", value: element.quantity, header_name: "Cantidad" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.rawMaterialByProvider?.price)), header_name: "Precio" },
                    { type: "text", value: element.status?.identifier, header_name: "Estado" },
                    // { type: "text", value: element.paymentStatus.identifier, header_name: "Estado de pago" },
                    // { type: "text", value: this.dataService.getFormatedPrice(Number(element.pendingAmount)), header_name: "Monto pendiente" },
                    {
                        type: "button",
                        style: "white-space: nowrap",
                        button: [
                            {
                                type: "button",
                                // routerLink: "view/" + element._id,
                                routerLink: '#',
                                class: "btn btn-success btn-sm pb-0 mx-1",
                                icon: {
                                    class: "material-icons",
                                    icon: "visibility"
                                }
                            },
                            // {
                            //     type: "button",
                            //     // routerLink: "edit/" + element._id,
                            //     routerLink: "view/" + element._id,
                            //     class: "btn btn-primary btn-sm pb-0 mx-1",
                            //     icon: {
                            //         class: "material-icons",
                            //         icon: "edit"
                            //     }
                            // }
                        ]
                    }
                  ],
            }
            this.tableElementsValues.rows.push(curr_row);
        });
    }

}