import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';

import { AlertService, DataService, storeOrderStatus} from '@app/services';
import { Establishment } from '@app/models/establishment.model';
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
    templateUrl: 'list-pfs-store-order.component.html',
    styleUrls: ['list-pfs-store-order.component.scss']
})
export class ListProductForSaleOrderComponent implements OnInit {
    productForSaleOrdes?: ProductForSaleStoreOrder[];
    allProductForSaleOrdes?: ProductForSaleStoreOrder[];
    establishmentOptions?: Establishment[];
    loadingOrders = false;
    loadingEstablishments = false;
    searchTerm?: string;
    pageTitle?: string;
    sortOpts = ['Desc', 'Asc'];
    selectedSortOpt = this.sortOpts[0];
    viewOption = '';
    storeOption = '';
    pageSize = this.dataService.defaultPageSize;
    tableElementsValues?: any;
    storeName = '';
    availableStatuses: string[] = [];
    statusFilter: string | null = null;

    constructor(private readonly dataService: DataService, private readonly alertService: AlertService, private readonly route: ActivatedRoute, private readonly router: Router) {}

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            this.viewOption = params['opt'];
            this.storeOption = params['store'];
            this.storeName = params['name'];
        });
        this.pageTitle = this.viewOption === 'store'
            ? `Pedidos de Producto para Venta (${this.storeName})`
            : `Pedidos de Producto Terminado (${this.storeName})`;
        this.retrieveProductForSaleStoreOrders(this.storeOption);
    }

    sortDataByDate(sortOpt: string) {
        this.selectedSortOpt = sortOpt;
        this.productForSaleOrdes = this.productForSaleOrdes?.sort((a, b) => {
            const fechaA = new Date(a.updatedDate!).getTime();
            const fechaB = new Date(b.updatedDate!).getTime();
            return sortOpt === 'Desc' ? fechaB - fechaA : fechaA - fechaB;
        });
        this.setTableElements(this.productForSaleOrdes);
    }

    retrieveProductForSaleStoreOrders(storeId?: string) {
        this.productForSaleOrdes = undefined;
        this.loadingOrders = true;
        const req$ = storeId
            ? this.dataService.getAllProductForSaleOrderByFilter({ establishment_id: storeId })
            : this.dataService.getAllProducForSaleOrder();

        req$.pipe(first()).subscribe({
            next: (pfsOrders: any) => {
                this.productForSaleOrdes = this.dataService.findJsonValue(pfsOrders, 'json_result') || [];
                this.allProductForSaleOrdes = this.productForSaleOrdes;
                const statusesSource = this.allProductForSaleOrdes || [];
                this.availableStatuses = [...new Set(
                    statusesSource.map(e =>
                        this.viewOption === 'factory' ? e.factoryStatus?.identifier : e.storeStatus?.identifier
                    ).filter((s): s is string => !!s)
                )];
                this.loadingOrders = false;
                this.sortDataByDate(this.sortOpts[0]);
            }
        });
    }

    filterByStatus(status: string | null) {
        this.statusFilter = status;
        this.search(null);
    }

    search(value: any): void {
        if (this.allProductForSaleOrdes) {
            this.productForSaleOrdes = this.allProductForSaleOrdes.filter((val) => {
                const textMatch = !this.searchTerm ||
                    val.name?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                    (this.viewOption === 'factory'
                        ? val.factoryStatus?.identifier?.toLowerCase().includes(this.searchTerm.toLowerCase())
                        : val.storeStatus?.identifier?.toLowerCase().includes(this.searchTerm.toLowerCase()));
                const currentStatus = this.viewOption === 'factory' ? val.factoryStatus?.identifier : val.storeStatus?.identifier;
                const statusMatch = !this.statusFilter || currentStatus === this.statusFilter;
                return textMatch && statusMatch;
            });
        }
        this.sortDataByDate(this.selectedSortOpt);
    }

    navigateWithParams() {
        if (this.viewOption) {
            this.router.navigate(['/productsForSale/order/create'], {
                queryParams: { opt: this.viewOption, store: this.storeOption }
            });
        } else {
            this.router.navigateByUrl('/productsForSale/order');
        }
    }

    setTableElements(elements?: ProductForSaleStoreOrder[]) {
        this.tableElementsValues = [];
        elements?.forEach((element: ProductForSaleStoreOrder) => {
            if (element.factoryStatus?.id === storeOrderStatus.eliminado.id ||
                element.storeStatus?.id === storeOrderStatus.eliminado.id) return;

            const statusValue = this.viewOption === 'factory' ? element.factoryStatus : element.storeStatus;
            const statusHeader = this.viewOption === 'factory' ? 'Estado en fábrica' : 'Estado en tienda';

            const curr_row: any[] = [
                { type: 'text', value: this.dataService.getLocalDateFromUTCTime(element.updatedDate!), header_name: 'Fecha' },
                { type: 'text', value: element.name, header_name: 'Nombre' },
                { type: 'text', value: element.establishment?.name, header_name: 'Tienda' },
                {
                    type: 'badge',
                    value: (statusValue?.text || statusValue?.identifier) ?? '--',
                    identifier: statusValue?.identifier?.toLowerCase(),
                    bg_color: statusValue?.bg_color,
                    color: statusValue?.color,
                    header_name: statusHeader
                },
                {
                    type: 'button',
                    header_name: 'Acciones',
                    button: [
                        {
                            type: 'button',
                            routerLink: 'view/' + element.id,
                            query_params: { opt: this.viewOption },
                            colorClass: 'dt-btn-view',
                            icon: { class: 'material-icons', icon: 'visibility' }
                        }
                    ]
                }
            ];
            this.tableElementsValues.push(curr_row);
        });
    }
}
