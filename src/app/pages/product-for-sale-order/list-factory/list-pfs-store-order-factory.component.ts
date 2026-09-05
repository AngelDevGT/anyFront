import { Component, OnInit, AfterViewInit, ViewChild, HostListener } from '@angular/core';
import { DatePipe } from '@angular/common';
import { first } from 'rxjs/operators';
import {map, startWith} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';

import { AccountService, AlertService, DataService, DateRangeState, DateRangeStateService, paymentStatusValues, statusValues, storeOrderStatus} from '@app/services';
import { formatOperators } from '@app/helpers';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { DateRange } from '@angular/material/datepicker';
import { Establishment } from '@app/models/establishment.model';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSelectChange } from '@angular/material/select';
import { BehaviorSubject, forkJoin } from 'rxjs';

@Component({
    templateUrl: 'list-pfs-store-order-factory.component.html',
    styleUrls: ['list-pfs-store-order-factory.component.scss'],
    providers: [DatePipe]
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
    entries = this.dataService.tableEntries;
    sortOpts = ['Desc', 'Asc'];
    selectedSortOpt = this.sortOpts[0];
    viewOption = '';
    storeOption = '';
    pageSize = this.dataService.defaultPageSize;
    page = 1;
    tableElementsValues?: any;
    cards: any = [];
    dialogTitle = '';

    datePanelOpen = false;
    maxDate = new Date();
    appliedStartDate?: Date;
    appliedEndDate?: Date;
    selectedDateRange: DateRange<Date> | null = null;
    private dateRange!: DateRangeState;

    constructor(private dataService: DataService, private alertService: AlertService, private route: ActivatedRoute, private router: Router, private datePipe: DatePipe, private dateRangeState: DateRangeStateService) {}

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            this.viewOption = params['opt'];
        });
        this.pageTitle = 'Pedidos';

        // Rango guardado en la pestaña o, si no hay, los últimos 15 días desde la fecha actual
        this.dateRange = this.dateRangeState.createRange(14);
        this.appliedStartDate = this.dateRange.start;
        this.appliedEndDate = this.dateRange.end;
        this.selectedDateRange = new DateRange<Date>(this.dateRange.start, this.dateRange.end);

        this.retrieveProductForSaleStoreOrders();
    }

    private buildOrderParams(): any {
        const params: any = {};
        if (this.appliedStartDate && this.appliedEndDate) {
            const startDateObject = new Date(this.appliedStartDate);
            startDateObject.setHours(0, 0, 0, 0);
            const endDateObject = new Date(this.appliedEndDate);
            endDateObject.setHours(23, 59, 59, 999);
            params['creation_date$gte'] = this.datePipe.transform(startDateObject, 'yyyy-MM-dd HH:mm:ss', 'UTC');
            params['creation_date$lte'] = this.datePipe.transform(endDateObject, 'yyyy-MM-dd HH:mm:ss', 'UTC');
        }
        return params;
    }

    @HostListener('document:click')
    onDocumentClick() {
        if (this.datePanelOpen) this.datePanelOpen = false;
    }

    get dateRangeLabel(): string {
        if (this.appliedStartDate && this.appliedEndDate) {
            return `${this.appliedStartDate.toLocaleDateString('es-GT')} - ${this.appliedEndDate.toLocaleDateString('es-GT')}`;
        }
        return '';
    }

    toggleDatePanel(event?: Event) {
        event?.stopPropagation();
        this.datePanelOpen = !this.datePanelOpen;
        if (this.datePanelOpen) {
            // El panel parte del rango actualmente aplicado; los cambios no se buscan hasta presionar "Buscar"
            this.selectedDateRange = new DateRange<Date>(this.appliedStartDate ?? null, this.appliedEndDate ?? null);
        }
    }

    closeDatePanel() { this.datePanelOpen = false; }

    onDateRangeChange(date: Date | null) {
        if (!date) return;
        const start = this.selectedDateRange?.start ?? null;
        const end = this.selectedDateRange?.end ?? null;
        if (!start || end || date < start) {
            this.selectedDateRange = new DateRange<Date>(date, null);
        } else {
            this.selectedDateRange = new DateRange<Date>(start, date);
        }
    }

    resetDateRange() {
        const { start, end } = this.dateRange.defaultRange();
        this.selectedDateRange = new DateRange<Date>(start, end);
    }

    applyDateRange() {
        if (!this.selectedDateRange?.start || !this.selectedDateRange?.end) {
            this.alertService.warn('Selecciona una fecha de inicio y una de fin');
            return;
        }
        this.appliedStartDate = this.selectedDateRange.start;
        this.appliedEndDate = this.selectedDateRange.end;
        this.dateRange.apply(this.appliedStartDate, this.appliedEndDate);
        this.datePanelOpen = false;
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
            const fechaA = new Date(a.updatedDate!);
            const fechaB = new Date(b.updatedDate!);
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
        requestArray.push(this.dataService.getAllProductForSaleOrderByFilter(this.buildOrderParams())); // providerRequest
        requestArray.push(this.dataService.getAllEstablishmentsByFilter({"status_id": 28})); // paymentTypeRequest

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.allProductForSaleOrdes = this.dataService.findJsonValue(result[0], 'json_result') || [];
                this.establishmentOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];
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
                    // const commentMatch = val.comment?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const providerMatch = val.productForSaleStoreOrderElements![0].productForSale?.establishment?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const finalAmountMatch = val.finalAmount?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const pendingAmountMatch = val.pendingAmount?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const stateMatch = val.factoryStatus?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const numberMatch = String(val.orderNumber ?? '').includes(this.searchTerm);
                    return nameMatch || stateMatch || numberMatch;
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
                    { type: "text", value: element.orderNumber != null ? '#' + element.orderNumber : '--', header_name: "No." },
                    { type: "text", value: this.dataService.getLocalDateFromUTCTime(element.updatedDate!), header_name: "Fecha", rows_bg_color: element.storeStatus?.bg_color, rows_color: element.storeStatus?.color},
                    { type: "text", value: element.name, header_name: "Nombre" },
                    // { type: "text", value: element.rawMaterialOrderElements.length, header_name: "Cantidad" },
                    { type: "text", value: element.productForSaleStoreOrderElements![0].productForSale?.establishment?.name, header_name: "Tienda" },
                    // Los nombres en una linea: la tabla no renderiza capsulas, y el
                    // detalle del pedido ya las muestra.
                    { type: "text", value: formatOperators(element.operators) || '--', header_name: "Operadores" },
                    this.viewOption === "factory" ? { type: "text", value: element.factoryStatus?.identifier, header_name: "Estado del pedido en fabrica", style: "width: 20%" } : { type: "text", value: element.storeStatus?.identifier, header_name: "Estado del pedido en tienda", style: "width: 20%" },
                    // { type: "text", value: this.dataService.getFormatedPrice(Number(element.finalAmount)), header_name: "Monto total" }
                  ]
            let actionsButtons = [
                {
                    type: "button",
                    routerLink: "/productsForSale/order/view/" + element.id,
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
                    return order.establishment?.id === establishment.id;
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
                    if(order.storeStatus?.id == 19){
                        productForSaleOrdersStats.pending++;
                    } else if(order.storeStatus?.id == 20){
                        productForSaleOrdersStats.onWay++;
                    } else if(order.storeStatus?.id == 21){
                        productForSaleOrdersStats.ready++;
                    } else if(order.storeStatus?.id == 22){
                        productForSaleOrdersStats.received++;
                    } else if(order.storeStatus?.id == 26){
                        productForSaleOrdersStats.devuelto++;
                    }
                });
                
                const newCard = {
                    title: establishment.name,
                    id: establishment.id,
                    ...productForSaleOrdersStats
                };
                this.cards.push(newCard);
            });
        }
    }

}