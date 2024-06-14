import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import {map, startWith} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';

import { AccountService, AlertService, DataService, paymentStatusValues, statusValues, storeOrderStatus} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Establishment } from '@app/models/establishment.model';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSelectChange } from '@angular/material/select';
import { BehaviorSubject, forkJoin } from 'rxjs';

@Component({ 
    templateUrl: 'list-pfs-store-order-factory.component.html',
    styleUrls: ['list-pfs-store-order-factory.component.scss']
})
export class ListFinishedProductOrderInFactoryComponent implements OnInit {
    establishmentOrders?: ProductForSaleStoreOrder[];
    allEstablishmentOrders?: ProductForSaleStoreOrder[];
    allProductForSaleOrdes?: ProductForSaleStoreOrder[];
    establishmentOptions?: Establishment[];
    selectedEstablishment?: Establishment;
    selectedEstablishmentSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    loadingOrders = false;
    loadingEstablishments = false;
    searchTerm?: string;
    pageTitle?: string;
    entries = [5, 10, 20, 50];
    sortOpts = ['Desc', 'Asc'];
    selectedSortOpt = this.sortOpts[0];
    viewOption = '';
    storeOption = '';
    pageSize = 5;
    page = 1;
    tableElementsValues?: any;
    cards: any = [];
    dialogTitle = '';

    constructor(private dataService: DataService, private alertService: AlertService, private route: ActivatedRoute, private router: Router) {}

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            this.viewOption = params['opt'];
        });
        this.pageTitle = 'Pedidos de Producto Terminado';
        this.retrieveProductForSaleStoreOrders();
    }

    sortOptSelect(event: Event){
        if(event){
            this.sortDataByDate(event.toString());
        }
    }


    loadOrders(establishmentId: string, establishmentName: string){
        this.dialogTitle = establishmentName;
        this.establishmentOrders = this.allProductForSaleOrdes?.filter((order) => {
            return order.establishmentID === establishmentId;
        });
        this.allEstablishmentOrders = this.establishmentOrders;
        this.sortDataByDate(this.selectedSortOpt);
        // this.setTableElements(this.establishmentOrders);
    }

    navigateWithParamsEstablishmentOrders(establishmentID: string, establishmenName: string){
        this.router.navigate(['/productsForSale/order'], {
            queryParams: {
                opt: this.viewOption,
                store: establishmentID,
                name: establishmenName
            }
        });
    }

    sortDataByDate(sortOpt: string){
        this.establishmentOrders = this.establishmentOrders?.sort((a,b) => {
            const fechaA = new Date(a.updateDate!);
            const fechaB = new Date(b.updateDate!);
            if(sortOpt === 'Desc'){
                return fechaB.getTime() - fechaA.getTime();
            } else {
                return fechaA.getTime() - fechaB.getTime();
            }
        });
        // this.allEstablishmentOrders = this.establishmentOrders;
        this.setTableElements(this.establishmentOrders);
        // this.getCards();
    }

    retrieveProductForSaleStoreOrders(){
        this.loadingOrders = true;

        let requestArray = [];
        requestArray.push(this.dataService.getAllProducForSaleOrder()); // providerRequest
        requestArray.push(this.dataService.getAllEstablishmentsByFilter({"status": 1})); // paymentTypeRequest

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.allProductForSaleOrdes = result[0].retrieveProductForSaleStoreOrderResponse?.saleStoreOrder;
                this.establishmentOptions = result[1].findEstablishmentResponse?.establishment;
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.loadingOrders = false;
                this.getCards();
                // this.sortDataByDate(this.sortOpts[0]);
            }
        });
    }

    search(value: any): void {
        if (this.allEstablishmentOrders){
            this.establishmentOrders = this.allEstablishmentOrders?.filter((val) => {
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
        this.setTableElements(this.establishmentOrders);
    }

    navigateWithParams(){
        if(this.viewOption){
            this.router.navigate(['/productsForSale/order/create'], {
                queryParams: {
                    opt: this.viewOption,
                    store: this.storeOption
                }
            });
        } else {
            this.router.navigateByUrl('/productsForSale/order');
        }
    }

    setTableElements(elements?: ProductForSaleStoreOrder[]){
        this.tableElementsValues = [];
        elements?.forEach((element: ProductForSaleStoreOrder) => {

            if(element.factoryStatus?.id === storeOrderStatus.eliminado.id || element.storeStatus?.id === storeOrderStatus.eliminado.id) return;  
            let curr_row = [
                    { type: "text", value: this.dataService.getLocalDateFromUTCTime(element.updateDate!), header_name: "Fecha", rows_bg_color: element.storeStatus?.bg_color, rows_color: element.storeStatus?.color},
                    { type: "text", value: element.name, header_name: "Nombre" },
                    // { type: "text", value: element.rawMaterialOrderElements.length, header_name: "Cantidad" },
                    { type: "text", value: element.productForSaleStoreOrderElements![0].productForSale?.establishment?.name, header_name: "Tienda" },
                    this.viewOption === "factory" ? { type: "text", value: element.factoryStatus?.identifier, header_name: "Estado del pedido en fabrica", style: "width: 20%" } : { type: "text", value: element.storeStatus?.identifier, header_name: "Estado del pedido en tienda", style: "width: 20%" },
                    // { type: "text", value: this.dataService.getFormatedPrice(Number(element.finalAmount)), header_name: "Monto total" }
                  ]
            let actionsButtons = [
                {
                    type: "button",
                    routerLink: "/productsForSale/order/view/" + element._id,
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

            curr_row.push(rowButtons)

            this.tableElementsValues.push(curr_row);
        });
    }

    getCards(){
        this.cards = [];
        // if (this.establishmentOptions){
        //     this.establishmentOptions.forEach(establishment => {
        //         let currentCard = {
        //             title: establishment.name,
        //             // photo: element.photo,
        //             descriptions: [
        //                 {name:'Descripcion:', value: establishment.description},
        //                 // {name:'Medida:', value: element.measure?.identifier},
        //                 {name:'Creacion:', value: this.dataService.getLocalDateTimeFromUTCTime(establishment.creationDate!)},
        //                 {name:'Modificacion:', value: this.dataService.getLocalDateTimeFromUTCTime(establishment.updateDate!)},
        //             ]
        //             // buttons: [
        //             //     {title: 'Ver', value: 'visibility', link: '/rawMaterials/view/' + element._id},
        //             //     {title: 'Editar', value: 'edit_note', link: '/rawMaterials/edit/' + element._id},
        //             //     // {title: 'Eliminar', value: 'delete', link: '/products/delete' + currRawMaterial._id},
        //             // ]
        //         };
        //         this.cards!.push(currentCard);
        //     });
        // }

        if (this.establishmentOptions){
            this.establishmentOptions.forEach(establishment => {
                const establishmentOrders = this.allProductForSaleOrdes?.filter((order) => {
                    return order.establishmentID === establishment._id;
                });

                let productForSaleOrdersStats = {
                    total: 0,
                    pending: 0,
                    onWay: 0,
                    received: 0,
                    ready: 0,
                    devuelto: 0
                };

                establishmentOrders?.forEach((order) => {
                    productForSaleOrdersStats.total++;
                    if(order.storeStatus?.id == 1){
                        productForSaleOrdersStats.pending++;
                    } else if(order.storeStatus?.id == 2){
                        productForSaleOrdersStats.onWay++;
                    } else if(order.storeStatus?.id == 7){
                        productForSaleOrdersStats.ready++;
                    } else if(order.storeStatus?.id == 3){
                        productForSaleOrdersStats.received++;
                    } else if(order.storeStatus?.id == 6){
                        productForSaleOrdersStats.devuelto++;
                    }
                });
                
                const newCard = {
                    title: establishment.name,
                    id: establishment._id,
                    ...productForSaleOrdersStats
                };
                this.cards.push(newCard);
            });
        }
    }

}