import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import {map, startWith} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';

import { AccountService, AlertService, DataService, paymentStatusValues, statusValues} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Establishment } from '@app/models/establishment.model';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import { BehaviorSubject } from 'rxjs';
import { MatSelectChange } from '@angular/material/select';

@Component({ 
    templateUrl: 'list-raw-material-order.component.html',
    styleUrls: ['list-raw-material-order.component.scss']
})
export class ListRawMaterialOrderComponent implements OnInit {
    rawMaterialOrders?: RawMaterialOrder[];
    allRawMaterialOrders?: RawMaterialOrder[];
    searchTerm?: string;
    entries = [5, 10, 20, 50];
    sortOpts = ['Desc', 'Asc'];
    selectedSortOpt = this.sortOpts[0];
    pageSize = 5;
    page = 1;
    tableElementsValues?: any;

    constructor(private dataService: DataService, private alertService: AlertService) {
        // this.selectedSortOptSubject.subscribe(value => {
        //     this.sortDataByDate(value);
        // });
    }

    sortOptSelect(event: MatSelectChange){
        if(event.value){
            this.sortDataByDate(event.value);
        }
    }

    sortDataByDate(sortOpt: string){
        this.rawMaterialOrders = this.rawMaterialOrders?.sort((a,b) => {
            const fechaA = new Date(a.updateDate!);
            const fechaB = new Date(b.updateDate!);
            if(sortOpt === 'Desc'){
                return fechaB.getTime() - fechaA.getTime();
            } else {
                return fechaA.getTime() - fechaB.getTime();
            }
        });
        this.allRawMaterialOrders = this.rawMaterialOrders;
        this.setTableElements(this.rawMaterialOrders);
    }

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
                    this.sortDataByDate(this.sortOpts[0]);
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
        this.tableElementsValues = [];
        elements?.forEach((element: RawMaterialOrder) => {
            const curr_row =
            [
                { type: "text", value: this.dataService.getLocalDateFromUTCTime(element.updateDate!), header_name: "Fecha", style: "width: 10%"},
                { type: "text", value: element.name, header_name: "Nombre", style: "width: 15%" },
                { type: "text", value: element.provider?.name, header_name: "Proveedor", style: "width: 15%" },
                { type: "text", value: element.status?.identifier, header_name: "Estado del pedido", style: "width: 10%" },
                { type: "text", value: element.paymentType?.identifier, header_name: "Tipo de pago", style: "width: 10%" },
                { type: "text", value: element.paymentStatus?.identifier, header_name: "Estado de pago", style: "width: 10%" },
                { type: "text", value: this.dataService.getFormatedPrice(Number(element.finalAmount)), header_name: "Monto total", style: "width: 10%" },
                { type: "text", value: this.dataService.getFormatedPrice(Number(element.pendingAmount)), header_name: "Monto pendiente", style: "width: 10%" }
            ];
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

            let rowButtons = {
                type: "button",
                style: "white-space: nowrap",
                value: undefined,
                header_name: "Acciones",
                button: [
                    ...actionsButtons
                ]
            }

            curr_row.push(rowButtons);

            this.tableElementsValues.push(curr_row);
        });
    }

}