import { Component, OnInit, HostListener } from '@angular/core';
import { DatePipe } from '@angular/common';
import { first } from 'rxjs/operators';
import { forkJoin } from 'rxjs';

import { AlertService, DataService, DateRangeState, DateRangeStateService, PdfService, storeOrderStatus} from '@app/services';
import { DateRange } from '@angular/material/datepicker';
import { Establishment } from '@app/models/establishment.model';
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
    templateUrl: 'list-pfs-store-order.component.html',
    styleUrls: ['list-pfs-store-order.component.scss'],
    providers: [DatePipe]
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
    selectedOrderIds: string[] = [];
    exportingPdf = false;
    /** Modo consulta: se listan, ven y exportan pedidos, pero no se crean ni editan. */
    readOnly = false;

    datePanelOpen = false;
    maxDate = new Date();
    appliedStartDate?: Date;
    appliedEndDate?: Date;
    selectedDateRange: DateRange<Date> | null = null;
    private dateRange!: DateRangeState;

    constructor(private readonly dataService: DataService, private readonly alertService: AlertService, private readonly route: ActivatedRoute, private readonly router: Router, private readonly datePipe: DatePipe, private readonly pdfService: PdfService, private readonly dateRangeState: DateRangeStateService) {}

    ngOnInit() {
        this.readOnly = !!this.route.snapshot.data['readOnly'];

        // La tienda llega siempre por query params: desde el listado de tiendas, o desde el
        // dashboard de pedidos en el caso de consultas
        this.route.queryParams.subscribe(params => {
            this.viewOption = params['opt'];
            this.storeOption = params['store'];
            this.storeName = params['name'];
        });
        this.setPageTitle();

        // Rango guardado en la pestaña o, si no hay, los últimos 15 días desde la fecha actual
        this.dateRange = this.dateRangeState.createRange(14);
        this.appliedStartDate = this.dateRange.start;
        this.appliedEndDate = this.dateRange.end;
        this.selectedDateRange = new DateRange<Date>(this.dateRange.start, this.dateRange.end);

        this.retrieveProductForSaleStoreOrders(this.storeOption);
    }

    private setPageTitle() {
        this.pageTitle = this.viewOption === 'store'
            ? `Pedidos de Producto para Venta (${this.storeName})`
            : `Pedidos de Producto Terminado (${this.storeName})`;
    }

    private buildOrderParams(storeId?: string): any {
        const params: any = {};
        if (storeId) params['establishment_id'] = storeId;
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
        this.retrieveProductForSaleStoreOrders(this.storeOption);
    }

    sortDataByDate(sortOpt: string) {
        this.selectedSortOpt = sortOpt;
        this.productForSaleOrdes = this.productForSaleOrdes?.sort((a, b) => {
            const fechaA = new Date(a.creationDate!).getTime();
            const fechaB = new Date(b.creationDate!).getTime();
            return sortOpt === 'Desc' ? fechaB - fechaA : fechaA - fechaB;
        });
        this.setTableElements(this.productForSaleOrdes);
    }

    retrieveProductForSaleStoreOrders(storeId?: string) {
        this.productForSaleOrdes = undefined;
        this.loadingOrders = true;
        const req$ = this.dataService.getAllProductForSaleOrderByFilter(this.buildOrderParams(storeId));

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

    onSelectionChange(selectedIds: string[]) {
        this.selectedOrderIds = selectedIds;
    }

    exportSelectedToPdf() {
        if (!this.selectedOrderIds.length || this.exportingPdf) return;

        // El listado no trae el detalle de los productos, se pide el de cada pedido seleccionado.
        // forkJoin conserva el orden del arreglo, que ya viene en el orden del listado.
        this.exportingPdf = true;
        const requests = this.selectedOrderIds.map(id => this.dataService.getProductForSaleOrderByIdForPdf(id));

        forkJoin(requests).pipe(first()).subscribe({
            next: (responses: any[]) => {
                const orders: ProductForSaleStoreOrder[] = responses
                    .map(response => this.dataService.findJsonValue(response, 'json_result'))
                    .filter(order => !!order);

                if (!orders.length) {
                    this.exportingPdf = false;
                    this.alertService.error('No se pudo obtener el detalle de los pedidos seleccionados');
                    return;
                }

                this.pdfService.generateMultipleProductForSaleOrdersPDF(orders, this.viewOption, this.storeName)
                    .then(() => this.exportingPdf = false)
                    .catch(() => {
                        this.exportingPdf = false;
                        this.alertService.error('Error al generar el PDF');
                    });
            },
            error: () => {
                this.exportingPdf = false;
                this.alertService.error('Error al obtener los pedidos seleccionados');
            }
        });
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
                { type: 'text', value: this.dataService.getLocalDateTimeFromUTCTime(element.creationDate!), header_name: 'Fecha' },
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
            // Identificador usado por la columna de seleccion de la tabla
            (curr_row as any).rowKey = element.id;
            this.tableElementsValues.push(curr_row);
        });
    }
}
