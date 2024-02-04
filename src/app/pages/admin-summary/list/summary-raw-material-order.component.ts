import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { filter, first } from 'rxjs/operators';
import {map, startWith} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';

import { AccountService, AlertService, DataService, paymentStatusValues, statusValues} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Establishment } from '@app/models/establishment.model';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import { BehaviorSubject, forkJoin } from 'rxjs';
import { MatSelectChange } from '@angular/material/select';
import { Provider } from '@app/models/system/provider.model';
import { Status } from '@app/models';

@Component({ 
    templateUrl: 'summary-raw-material-order.component.html',
    styleUrls: ['summary-raw-material-order.component.scss']
})
export class SummaryRawMaterialOrderComponent implements OnInit {
    rawMaterialOrders?: RawMaterialOrder[];
    allRawMaterialOrders?: RawMaterialOrder[];
    providerOptions?: Provider[];
    statusOptions?: Status[];
    paymentTypeOptions?: Status[];
    paymentStatusOptions?: Status[];
    productForm!: FormGroup;
    maxDate: Date = new Date();
    searchTerm?: string;
    entries = [5, 10, 20, 50];
    sortOpts = ['Desc', 'Asc'];
    selectedSortOpt = this.sortOpts[0];
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
        this.productForm = this.createFormGroup();
        this.retriveRawMaterialOrders();
    }

    retriveRawMaterialOrders(){

        let requestArray = [];
        this.rawMaterialOrders = undefined;

        requestArray.push(this.dataService.getAllRawMaterialOrderByFilter({"status": 1}));
        requestArray.push(this.dataService.getAllProvidersByFilter({"status": 1})); // providerRequest
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "status", enableElements: "true"})); 
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "paymentType", enableElements: "true"})); 
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "paymentStatus", enableElements: "true"})); 
        requestArray.push(this.dataService.getInventory({ _id: "64d7dae896457636c3f181e9"}));
        requestArray.push(this.dataService.getAllProductForSaleByFilter({"status": { "id": 2}})); //rawMaterialByProviderRequest

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.rawMaterialOrders = result[0].retrieveRawMaterialOrderResponse?.rawMaterial;
                this.allRawMaterialOrders = this.rawMaterialOrders;
                this.providerOptions = result[1].retrieveProviderResponse?.providers;
                this.statusOptions = result[2].retrieveCatalogGenericResponse.elements;
                this.paymentTypeOptions = result[3].retrieveCatalogGenericResponse.elements;
                this.paymentStatusOptions = result[4].retrieveCatalogGenericResponse.elements;
                // console.log(respuestaPeticion1, respuestaPeticion2, respuestaPeticion3);
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.sortDataByDate(this.sortOpts[0]);
            }
        });
    }

    initConstantValues(){
        
    }

    search(value: any): void {
        if (this.allRawMaterialOrders){
            this.rawMaterialOrders = this.allRawMaterialOrders?.filter((val) => {
                if(this.searchTerm){
                    const nameMatch = val.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const commentMatch = val.comment?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const providerMatch = val.provider?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const paymentTypeMatch = val.paymentType?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const paymentStatusMatch = val.paymentStatus?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const finalAmountMatch = val.finalAmount <= this.searchTerm;
                    // const pendingAmountMatch = val.pendingAmount?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return nameMatch || commentMatch;
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

            // let rowButtons = {
            //     type: "button",
            //     style: "white-space: nowrap",
            //     value: undefined,
            //     header_name: "Acciones",
            //     button: [
            //         ...actionsButtons
            //     ]
            // }

            // curr_row.row.push(rowButtons)

            this.tableElementsValues.rows.push(curr_row);
        });
    }

    createFormGroup() {
        return new FormGroup({
            orderStatus: new FormControl('', [Validators.maxLength(45)]),
            paymentStatus: new FormControl('', [Validators.maxLength(45)]),
            paymentType: new FormControl('', [Validators.maxLength(45)]),
            price: new FormControl('', [Validators.maxLength(45)]),
            provider: new FormControl('', [Validators.maxLength(45)]),
            initialDate: new FormControl('', [Validators.maxLength(45)]),
            creatorUser: new FormControl('', [Validators.maxLength(45)]),
        });
    }

    filterElements(){
        let filters = this.productForm.value;
        let initialDateMatch = true;
        if (this.allRawMaterialOrders){
            this.rawMaterialOrders = this.allRawMaterialOrders?.filter((val) => {
                if(filters.initialDate !== ""){
                    const initialDate = new Date(filters.initialDate);
                    const orderDate = new Date(val.updateDate!);
                    console.log(initialDate);
                    console.log(orderDate)
                    initialDateMatch = (initialDate.getTime() - orderDate.getTime()) <= 0 ? true : false;
                    console.log(initialDateMatch);
                }
                const providerMatch = filters.provider !== "" ? val.provider?._id === filters.provider : true;
                const statusMatch = filters.orderStatus !== "" ? String(val.status?.id) === filters.orderStatus : true;
                const paymentTypeMatch = filters.paymentType !== "" ? String(val.paymentType?.id) === filters.paymentType : true;
                const paymentStatusMatch = filters.paymentStatus !== "" ? String(val.paymentStatus?.id) === filters.paymentStatus : true;
                return providerMatch && statusMatch && providerMatch && paymentTypeMatch && paymentStatusMatch && initialDateMatch;
            });
        }
        this.setTableElements(this.rawMaterialOrders);
        console.log(filters);
        console.log(this.rawMaterialOrders);
    }

}