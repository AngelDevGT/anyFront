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
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';

@Component({ 
    templateUrl: 'summary-pfs-store-order.component.html',
    styleUrls: ['summary-pfs-store-order.component.scss']
})
export class SummaryProductForSaleOrderComponent implements OnInit {
    productForSaleStoreOrders?: ProductForSaleStoreOrder[];
    allProductForSaleStoreOrders?: ProductForSaleStoreOrder[];
    establishmentOptions?: Establishment[];
    statusOptions?: Status[];
    productForm!: FormGroup;
    maxDate: Date = new Date();
    searchTerm?: string;
    entries = [5, 10, 20, 50];
    sortOpts = ['Desc', 'Asc'];
    selectedSortOpt = this.sortOpts[0];
    pageSize = 5;
    page = 1;
    tableElementsValues?: any;

    constructor(private dataService: DataService, private alertService: AlertService) {
    }

    sortOptSelect(event: MatSelectChange){
        if(event.value){
            this.sortDataByDate(event.value);
        }
    }

    sortDataByDate(sortOpt: string){
        this.productForSaleStoreOrders = this.productForSaleStoreOrders?.sort((a,b) => {
            const fechaA = new Date(a.updateDate!);
            const fechaB = new Date(b.updateDate!);
            if(sortOpt === 'Desc'){
                return fechaB.getTime() - fechaA.getTime();
            } else {
                return fechaA.getTime() - fechaB.getTime();
            }
        });
        this.allProductForSaleStoreOrders = this.productForSaleStoreOrders;
        this.setTableElements(this.productForSaleStoreOrders);
    }

    ngOnInit() {
        this.productForm = this.createFormGroup();
        this.retriveProductoForSaleOrders();
    }

    retriveProductoForSaleOrders(){

        let requestArray = [];
        this.productForSaleStoreOrders = undefined;

        requestArray.push(this.dataService.getAllProducForSaleOrder());
        requestArray.push(this.dataService.getAllEstablishmentsByFilter({"status": 1}));
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "storeOrderStatus", enableElements: "true"}));

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.productForSaleStoreOrders = result[0].retrieveProductForSaleStoreOrderResponse?.saleStoreOrder;
                this.allProductForSaleStoreOrders = this.productForSaleStoreOrders;
                this.establishmentOptions = result[1].findEstablishmentResponse?.establishment;
                this.statusOptions = result[2].retrieveCatalogGenericResponse.elements;
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
        if (this.allProductForSaleStoreOrders){
            this.productForSaleStoreOrders = this.allProductForSaleStoreOrders?.filter((val) => {
                if(this.searchTerm){
                    const nameMatch = val.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const commentMatch = val.comment?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return nameMatch || commentMatch;
                }
                return true;
            });
        }
        this.setTableElements(this.productForSaleStoreOrders);
    }

    setTableElements(elements?: ProductForSaleStoreOrder[]){
        this.tableElementsValues = [];
        elements?.forEach((element: ProductForSaleStoreOrder) => {
            const curr_row = [
                    { type: "text", value: this.dataService.getLocalDateFromUTCTime(element.updateDate!), header_name: "Fecha" },
                    { type: "text", value: element.name, header_name: "Nombre" },
                    // { type: "text", value: element.rawMaterialOrderElements.length, header_name: "Cantidad" },
                    { type: "text", value: element.productForSaleStoreOrderElements![0].productForSale?.establishment?.name, header_name: "Tienda" },
                    { type: "text", value: element.storeStatus?.identifier, header_name: "Estado del pedido" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.finalAmount)), header_name: "Monto total" }
            ];
            this.tableElementsValues.push(curr_row);
        });
    }

    createFormGroup() {
        return new FormGroup({
            orderStatus: new FormControl('', [Validators.maxLength(45)]),
            price: new FormControl('', [Validators.maxLength(45)]),
            establishment: new FormControl('', [Validators.maxLength(45)]),
            initialDate: new FormControl('', [Validators.maxLength(45)]),
            creatorUser: new FormControl('', [Validators.maxLength(45)]),
        });
    }

    filterElements(){
        let filters = this.productForm.value;
        console.log(filters);
        let initialDateMatch = true;
        if (this.allProductForSaleStoreOrders){
            this.productForSaleStoreOrders = this.allProductForSaleStoreOrders?.filter((val) => {
                console.log(val);
                if(filters.initialDate !== ""){
                    const initialDate = new Date(filters.initialDate);
                    const orderDate = new Date(val.updateDate!);
                    initialDateMatch = (initialDate.getTime() - orderDate.getTime()) <= 0 ? true : false;
                }
                const establishmentMatch = filters.establishment !== "" ? val.establishmentID === filters.establishment : true;
                const statusMatch = filters.orderStatus !== "" ? String(val.storeStatus?.id) === filters.orderStatus : true;
                return establishmentMatch && statusMatch && initialDateMatch;
            });
        }
        this.setTableElements(this.productForSaleStoreOrders);
    }

    exportDataToCsv(){
        const finalProductForSaleOrders = this.productForSaleStoreOrders?.map(pfsOrd => {
            return {
                Nombre: pfsOrd.name,
                Comentario: pfsOrd.comment,
                Establecimiento: pfsOrd.productForSaleStoreOrderElements![0].productForSale?.establishment?.name,
                "Fecha Modificacion": this.dataService.getLocalDateTimeFromUTCTime(pfsOrd.updateDate!),
                "Fecha Creacion": this.dataService.getLocalDateTimeFromUTCTime(pfsOrd.creationDate!),
                "Estado del pedido": pfsOrd.storeStatus?.identifier,
                "Monto total": this.dataService.getFormatedPrice(Number(pfsOrd.finalAmount)),
                "Usuario Creador": pfsOrd.creatorUser?.name,
                ID: pfsOrd._id
            };
        });
        const csvOptions = {
            fieldSeparator: ',',
            quoteStrings: '"',
            decimalseparator: '.',
            showLabels: true,
            headers: [ "Nombre Pedido", "Comentario", "Tienda", "Fecha Modificacion", "Fecha Creacion", "Estado del pedido", "Monto total", "Usuario Creador", "ID"]
        }
        new ngxCsv(finalProductForSaleOrders, "Resumen_pedidos_de_producto_para_venta_tienda_" + this.maxDate.getTime(), csvOptions);
    }

}