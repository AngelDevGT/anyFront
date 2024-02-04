import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import {map, startWith} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';

import { AccountService, AlertService, DataService, paymentStatusValues, statusValues} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Establishment } from '@app/models/establishment.model';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSelectChange } from '@angular/material/select';

@Component({ 
    templateUrl: 'list-pfs-store-order.component.html',
    styleUrls: ['list-pfs-store-order.component.scss']
})
export class ListProductForSaleOrderComponent implements OnInit {
    productForSaleOrdes?: ProductForSaleStoreOrder[];
    allProductForSaleOrdes?: ProductForSaleStoreOrder[];
    searchTerm?: string;
    pageTitle?: string;
    entries = [5, 10, 20, 50];
    sortOpts = ['Desc', 'Asc'];
    selectedSortOpt = this.sortOpts[0];
    viewOption = '';
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
            name: "Tienda"
        },
        {
            style: "width: 10%",
            name: "Estado del pedido"
        },
        {
            style: "width: 10%",
            name: "Acciones"
        }
    ];

    constructor(private dataService: DataService, private alertService: AlertService, private route: ActivatedRoute, private router: Router) {}

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            this.viewOption = params['opt'];
        });
        this.pageTitle = 'Pedidos de Producto para Venta (Tienda)';
        if(this.viewOption && this.viewOption === "factory"){
            this.pageTitle = 'Pedidos de Producto para Venta (Fabrica)';
        }
        this.retrieveProductForSaleStoreOrders();
    }

    sortOptSelect(event: MatSelectChange){
        if(event.value){
            this.sortDataByDate(event.value);
        }
    }

    sortDataByDate(sortOpt: string){
        this.productForSaleOrdes = this.productForSaleOrdes?.sort((a,b) => {
            const fechaA = new Date(a.updateDate!);
            const fechaB = new Date(b.updateDate!);
            if(sortOpt === 'Desc'){
                return fechaB.getTime() - fechaA.getTime();
            } else {
                return fechaA.getTime() - fechaB.getTime();
            }
        });
        this.allProductForSaleOrdes = this.productForSaleOrdes;
        this.setTableElements(this.productForSaleOrdes);
    }

    retrieveProductForSaleStoreOrders(){
        this.productForSaleOrdes = undefined;
        this.dataService.getAllProducForSaleOrder()
            .pipe(first())
            .subscribe({
                next: (pfsOrders: any) => {
                    this.productForSaleOrdes = pfsOrders.retrieveProductForSaleStoreOrderResponse?.saleStoreOrder;
                    this.allProductForSaleOrdes = this.productForSaleOrdes;
                    this.sortDataByDate(this.sortOpts[0]);
                }
            });
    }

    search(value: any): void {
        if (this.allProductForSaleOrdes){
            this.productForSaleOrdes = this.allProductForSaleOrdes?.filter((val) => {
                if(this.searchTerm){
                    const nameMatch = val.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const commentMatch = val.comment?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const providerMatch = val.productForSaleStoreOrderElements![0].productForSale?.establishment?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const finalAmountMatch = val.finalAmount?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const pendingAmountMatch = val.pendingAmount?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return nameMatch || commentMatch || providerMatch;
                }
                return true;
            });
        }
        this.setTableElements(this.productForSaleOrdes);
    }

    navigateWithParams(){
        if(this.viewOption){
            this.router.navigate(['/productsForSale/order/create'], {
                queryParams: {
                    opt: this.viewOption
                }
            });
        } else {
            this.router.navigateByUrl('/productsForSale/order');
        }
    }

    setTableElements(elements?: ProductForSaleStoreOrder[]){
        this.tableElementsValues = {
            headers: this.tableHeaders,
            rows: []
        }
        elements?.forEach((element: ProductForSaleStoreOrder) => {
            let curr_row = {
                row: [
                    { type: "text", value: this.dataService.getLocalDateFromUTCTime(element.updateDate!), header_name: "Fecha" },
                    { type: "text", value: element.name, header_name: "Nombre" },
                    // { type: "text", value: element.rawMaterialOrderElements.length, header_name: "Cantidad" },
                    { type: "text", value: element.productForSaleStoreOrderElements![0].productForSale?.establishment?.name, header_name: "Tienda" },
                    this.viewOption === "factory" ? { type: "text", value: element.factoryStatus?.identifier, header_name: "Estado del pedido en fabrica" } : { type: "text", value: element.storeStatus?.identifier, header_name: "Estado del pedido en tienda" },
                    // { type: "text", value: this.dataService.getFormatedPrice(Number(element.finalAmount)), header_name: "Monto total" }
                  ],
            }
            let actionsButtons = [
                {
                    type: "button",
                    routerLink: "view/" + element._id,
                    query_params: {opt: this.viewOption},
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

            curr_row.row.push(rowButtons)

            this.tableElementsValues.rows.push(curr_row);
        });
    }

}