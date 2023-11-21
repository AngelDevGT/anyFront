import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import {map, startWith} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';

import { AccountService, AlertService, DataService, paymentStatusValues, statusValues} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Establishment } from '@app/models/establishment.model';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';

@Component({ 
    templateUrl: 'list-raw-material-order.component.html',
    styleUrls: ['list-raw-material-order.component.scss']
})
export class ListRawMaterialOrderComponent implements OnInit {
    rawMaterialOrders?: RawMaterialOrder[];
    allRawMaterialOrders?: RawMaterialOrder[];
    searchTerm?: string;
    entries = [5, 10, 20, 50];
    pageSize = 5;
    page = 1;
    tableElementsValues?: any;
    tableHeaders = [
        {
            style: "width: 10%",
            name: "Fecha"
        },
        {
            style: "width: 15%",
            name: "Nombre"
        },
        {
            style: "width: 15%",
            name: "Proveedor"
        },
        {
            style: "width: 10%",
            name: "Estado del pedido"
        },
        {
            style: "width: 10%",
            name: "Tipo de pago"
        },
        {
            style: "width: 10%",
            name: "Estado de pago"
        },
        {
            style: "width: 10%",
            name: "Monto total"
        },
        {
            style: "width: 10%",
            name: "Monto pendiente"
        },
        {
            style: "width: 10%",
            name: "Acciones"
        }
    ];

    constructor(private dataService: DataService, private alertService: AlertService) {}

    ngOnInit() {
        this.retriveRawMaterialOrders();
    }

    retriveRawMaterialOrders(){
        this.rawMaterialOrders = undefined;
        this.dataService.getAllRawMaterialOrderByFilter({"status": 1})
            .pipe(first())
            .subscribe({
                next: (rmOrders: any) => {
                    this.rawMaterialOrders = rmOrders.retrieveRawMaterialOrderResponse?.rawMaterial;
                    this.allRawMaterialOrders = this.rawMaterialOrders;
                    this.setTableElements(this.rawMaterialOrders);
                }
            });
    }

    search(value: any): void {
        if (this.allRawMaterialOrders){
            this.rawMaterialOrders = this.allRawMaterialOrders?.filter((val) => {
                if(this.searchTerm){
                    const nameMatch = val.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const commentMatch = val.comment?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const providerMatch = val.provider?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const paymentTypeMatch = val.paymentType?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const paymentStatusMatch = val.paymentStatus?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const finalAmountMatch = val.finalAmount?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const pendingAmountMatch = val.pendingAmount?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return nameMatch || commentMatch || providerMatch || paymentTypeMatch || paymentStatusMatch;
                }
                return true;
            });
        }
        this.setTableElements(this.rawMaterialOrders);
    }

    setTableElements(elements?: RawMaterialOrder[]){
        this.tableElementsValues = {
            headers: this.tableHeaders,
            rows: []
        }
        elements?.forEach((element: RawMaterialOrder) => {
            const curr_row = {
                row: [
                    { type: "text", value: this.dataService.getLocalDateFromUTCTime(element.updateDate!), header_name: "Fecha" },
                    { type: "text", value: element.name, header_name: "Nombre" },
                    // { type: "text", value: element.rawMaterialOrderElements.length, header_name: "Cantidad" },
                    { type: "text", value: element.provider?.name, header_name: "Proveedor" },
                    { type: "text", value: element.status?.identifier, header_name: "Estado del pedido" },
                    { type: "text", value: element.paymentType?.identifier, header_name: "Tipo de pago" },
                    { type: "text", value: element.paymentStatus?.identifier, header_name: "Estado de pago" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.finalAmount)), header_name: "Monto total" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.pendingAmount)), header_name: "Monto pendiente" }
                  ],
            }
            let actionsButtons = [
                {
                    type: "button",
                    routerLink: "view/" + element._id,
                    class: "btn btn-success btn-sm pb-0 mx-1",
                    icon: {
                        class: "material-icons",
                        icon: "visibility"
                    }
                }
            ];

            // if (element.paymentStatus?.id != paymentStatusValues.pagado.paymentStatus.id && 
            //     (element.status?.id == statusValues.activo.status.id ||
            //         element.status?.id == statusValues.en_curso.status.id ||
            //         element.status?.id == statusValues.pendiente.status.id)){
            //     actionsButtons.push({
            //         type: "button",
            //         routerLink: "edit/" + element._id,
            //         class: "btn btn-primary btn-sm pb-0 mx-1",
            //         icon: {
            //             class: "material-icons",
            //             icon: "edit"
            //         }
            //     })
            // }

            let rowButtons = {
                type: "button",
                style: "white-space: nowrap",
                value: undefined,
                header_name: "Acciones",
                button: [
                    ...actionsButtons
                ]
            }

            curr_row.row.push(rowButtons)

            this.tableElementsValues.rows.push(curr_row);
        });
    }

}