import { Component, OnInit, HostListener } from '@angular/core';
import { DatePipe } from '@angular/common';

import { AlertService, DataService, DateRangeState, DateRangeStateService, StoreContextService} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { DateRange } from '@angular/material/datepicker';
import { Measure } from '@app/models';
import { UnitBase } from '@app/models/auxiliary/unit-base.model';
import { switchMap } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { ShopResume } from '@app/models/store/shop-resume.model';
import { Establishment } from '@app/models/establishment.model';

@Component({
    templateUrl: 'list-store-sales-pfs.component.html',
    styleUrls: ['list-store-sales-pfs.component.scss'],
    providers: [DatePipe]
})
export class ListStoreSalesPFSComponent implements OnInit {

    establishment?: Establishment;
    submitting = false;
    storeName?: string;
    shopResumes?: ShopResume[];
    allShopResumes?: ShopResume[];
    selectedInventoryElement?: ShopResume;
    rawMaterialForm!: FormGroup;
    selectedMeasure?: Measure;
    elements: any = [];
    measureOptions?: Measure[];
    inventoryUnitBase?: UnitBase;
    currentMeasureQuantity = 0;
    filteredMeasureOptions?: Measure[];
    selectedQuantity = 0;
    formQuantity = 0;
    modalSelectedQuantity = 0;
    modalUnitBaseTotalQuantity = 0;
    searchTerm?: string;
    pageSize = this.dataService.defaultPageSize;
    tableElementsValues?: any;
    availableSaleStatuses: string[] = [];
    availableOrderPaymentStatuses: string[] = [];
    availableDeliveryPaymentStatuses: string[] = [];

    /** Modo consulta: sin registrar ventas y con la tienda elegida en la propia pantalla. */
    readOnly = false;
    storePicker = false;
    storeSelected = false;

    filterPanelOpen = false;
    datePanelOpen = false;
    maxDate = new Date();
    establishmentId!: string;
    appliedStartDate?: Date;
    appliedEndDate?: Date;
    selectedDateRange: DateRange<Date> | null = null;
    private dateRange!: DateRangeState;
    saleStatusFilters: string[] = [];
    orderPaymentStatusFilters: string[] = [];
    deliveryPaymentStatusFilters: string[] = [];
    pendingSaleStatuses: string[] = [];
    pendingOrderPaymentStatuses: string[] = [];
    pendingDeliveryPaymentStatuses: string[] = [];
    saleStatusExpanded = true;
    orderPaymentExpanded = true;
    deliveryPaymentExpanded = true;

    constructor(private dataService: DataService, private route: ActivatedRoute, private alertService: AlertService, private router: Router, private datePipe: DatePipe, private dateRangeState: DateRangeStateService, private storeContext: StoreContextService) {}

    ngOnInit() {
        this.readOnly = !!this.route.snapshot.data['readOnly'];
        this.storePicker = !!this.route.snapshot.data['storePicker'];

        // Rango guardado en la pestaña o, si no hay, los últimos 15 días desde la fecha actual
        this.dateRange = this.dateRangeState.createRange(14);
        this.appliedStartDate = this.dateRange.start;
        this.appliedEndDate = this.dateRange.end;
        this.selectedDateRange = new DateRange<Date>(this.dateRange.start, this.dateRange.end);

        this.rawMaterialForm = this.createMaterialFormGroup();

        // Las medidas no dependen de la tienda, se piden una sola vez
        this.dataService.getAnyComponent({}, 'getMeasure').subscribe({
            next: (result: any) => this.measureOptions = this.dataService.findJsonValue(result, 'json_result') || [],
            error: (e) => console.error('Se ha producido un error al obtener las medidas', e)
        });

        // En consultas la tienda se elige en la propia pantalla con store-picker. En la sección de
        // Tienda viaja en la ruta: el selector global navega a esta misma ruta con otra tienda y
        // Angular reutiliza el componente, así que la recarga cuelga del parámetro.
        if (!this.storePicker) {
            this.route.paramMap
                .pipe(switchMap(params => this.storeContext.resolveFromRoute(params.get('id'))))
                .subscribe(store => this.onStoreChange(store));
        }
    }

    /** Cambio de tienda desde el selector: sin tienda no se consulta nada y la tabla queda vacía. */
    onStoreChange(store?: Establishment) {
        this.establishment = store;
        this.establishmentId = store?.id ?? '';
        this.storeName = store?.name;
        this.storeSelected = !!store;

        if (!this.storeSelected) {
            this.shopResumes = undefined;
            this.allShopResumes = undefined;
            this.availableSaleStatuses = [];
            this.availableOrderPaymentStatuses = [];
            this.availableDeliveryPaymentStatuses = [];
            this.tableElementsValues = [];
            return;
        }
        // La tienda ya viene del selector, solo faltan sus ventas
        this.fetchSales();
    }

    private buildSalesParams(): any {
        const params: any = { establishment_id: this.establishmentId };
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

    private applyShopResumes(resumes: ShopResume[]) {
        this.shopResumes = (resumes || []).sort((a, b) =>
            new Date(b.creationDate!).getTime() - new Date(a.creationDate!).getTime()
        );
        this.allShopResumes = this.shopResumes;
        this.availableSaleStatuses = [...new Set(
            (this.allShopResumes || []).map(e => e.status?.identifier).filter((s): s is string => !!s)
        )];
        this.availableOrderPaymentStatuses = [...new Set(
            (this.allShopResumes || []).map(e => e.paymentStatus?.identifier).filter((s): s is string => !!s)
        )];
        this.availableDeliveryPaymentStatuses = [...new Set(
            (this.allShopResumes || []).map(e => e.deliveryPaymentStatus?.identifier).filter((s): s is string => !!s)
        )];
        this.search(null);
    }

    private fetchSales() {
        this.shopResumes = undefined;
        this.tableElementsValues = undefined;
        this.dataService.getAllShopHistory(this.buildSalesParams()).subscribe({
            next: (result: any) => this.applyShopResumes(this.dataService.findJsonValue(result, 'json_result') || []),
            error: (e) => console.error('Se ha producido un error al obtener las ventas', e)
        });
    }

    @HostListener('document:click')
    onDocumentClick() {
        if (this.filterPanelOpen) this.filterPanelOpen = false;
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
            this.filterPanelOpen = false;
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
        if (this.storeSelected) {
            this.fetchSales();
        }
    }

    get activeFilterCount(): number {
        return this.saleStatusFilters.length + this.orderPaymentStatusFilters.length + this.deliveryPaymentStatusFilters.length;
    }

    toggleFilterPanel(event?: Event) {
        event?.stopPropagation();
        this.filterPanelOpen = !this.filterPanelOpen;
        if (this.filterPanelOpen) {
            this.datePanelOpen = false;
            this.pendingSaleStatuses = [...this.saleStatusFilters];
            this.pendingOrderPaymentStatuses = [...this.orderPaymentStatusFilters];
            this.pendingDeliveryPaymentStatuses = [...this.deliveryPaymentStatusFilters];
        }
    }

    closeFilterPanel() { this.filterPanelOpen = false; }

    toggleSaleStatus(value: string) {
        const idx = this.pendingSaleStatuses.indexOf(value);
        if (idx > -1) this.pendingSaleStatuses.splice(idx, 1); else this.pendingSaleStatuses.push(value);
        this.pendingSaleStatuses = [...this.pendingSaleStatuses];
    }

    toggleOrderPaymentStatus(value: string) {
        const idx = this.pendingOrderPaymentStatuses.indexOf(value);
        if (idx > -1) this.pendingOrderPaymentStatuses.splice(idx, 1); else this.pendingOrderPaymentStatuses.push(value);
        this.pendingOrderPaymentStatuses = [...this.pendingOrderPaymentStatuses];
    }

    toggleDeliveryPaymentStatus(value: string) {
        const idx = this.pendingDeliveryPaymentStatuses.indexOf(value);
        if (idx > -1) this.pendingDeliveryPaymentStatuses.splice(idx, 1); else this.pendingDeliveryPaymentStatuses.push(value);
        this.pendingDeliveryPaymentStatuses = [...this.pendingDeliveryPaymentStatuses];
    }

    applyFilters() {
        this.saleStatusFilters = [...this.pendingSaleStatuses];
        this.orderPaymentStatusFilters = [...this.pendingOrderPaymentStatuses];
        this.deliveryPaymentStatusFilters = [...this.pendingDeliveryPaymentStatuses];
        this.search(null);
        this.filterPanelOpen = false;
    }

    resetFilters() {
        this.pendingSaleStatuses = [];
        this.pendingOrderPaymentStatuses = [];
        this.pendingDeliveryPaymentStatuses = [];
        this.saleStatusFilters = [];
        this.orderPaymentStatusFilters = [];
        this.deliveryPaymentStatusFilters = [];
        this.search(null);
        this.filterPanelOpen = false;
    }

    search(value: any): void {
        if (this.allShopResumes) {
            this.shopResumes = this.allShopResumes.filter((val) => {
                const textMatch = !this.searchTerm ||
                    val.nameClient?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                    val.creationDate?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                    String(val.total ?? '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                    String(val.saleNumber ?? '').includes(this.searchTerm);
                const saleStatusMatch = !this.saleStatusFilters.length || this.saleStatusFilters.includes(val.status?.identifier || '');
                const orderPaymentMatch = !this.orderPaymentStatusFilters.length || this.orderPaymentStatusFilters.includes(val.paymentStatus?.identifier || '');
                const deliveryPaymentMatch = !this.deliveryPaymentStatusFilters.length || this.deliveryPaymentStatusFilters.includes(val.deliveryPaymentStatus?.identifier || '');
                return textMatch && saleStatusMatch && orderPaymentMatch && deliveryPaymentMatch;
            });
        }
        this.setTableElements(this.shopResumes);
    }

    setTableElements(elements?: ShopResume[]) {
        elements = elements?.filter(element => element.status?.id !== 8);
        this.tableElementsValues = [];
        elements?.forEach((element: ShopResume) => {
            const orderPending = element.paymentType?.identifier === 'Crédito' ? Number(element.pendingAmount) || 0 : 0;
            const deliveryPending = element.deliveryPaymentType?.identifier === 'Crédito' ? Number(element.deliveryPendingAmount) || 0 : 0;
            const hasPending = element.paymentType?.identifier === 'Crédito' || element.deliveryPaymentType?.identifier === 'Crédito';
            const curr_row: any = [
                { type: 'text', value: element.saleNumber != null ? '#' + element.saleNumber : '--', header_name: 'No.' },
                { type: 'text', value: this.dataService.getLocalDateTimeFromUTCTime(element.creationDate!), header_name: 'Fecha' },
                { type: 'text', value: element.nameClient ?? '--', header_name: 'Cliente' },
                {
                    type: 'badge',
                    value: (element.status?.text || element.status?.identifier) ?? '--',
                    identifier: element.status?.identifier?.toLowerCase(),
                    bg_color: element.status?.bg_color,
                    color: element.status?.color,
                    header_name: 'Estado'
                },
                { type: 'text', value: this.dataService.getFormatedPrice(Number(element.total)), header_name: 'Total' },
                { type: 'text', value: hasPending ? this.dataService.getFormatedPrice(orderPending + deliveryPending) : '--', header_name: 'Pendiente' },
                { type: 'text', value: element.paymentType?.identifier ?? '--', header_name: 'Pedido' },
                {
                    type: 'badge',
                    value: (element.paymentStatus?.text || element.paymentStatus?.identifier) ?? '--',
                    identifier: element.paymentStatus?.identifier?.toLowerCase(),
                    bg_color: element.paymentStatus?.bg_color,
                    color: element.paymentStatus?.color,
                    header_name: 'Pago pedido'
                },
                { type: 'text', value: element.deliveryPaymentType?.identifier ?? '--', header_name: 'Envío' },
                {
                    type: 'badge',
                    value: (element.deliveryPaymentStatus?.text || element.deliveryPaymentStatus?.identifier) ?? '--',
                    identifier: element.deliveryPaymentStatus?.identifier?.toLowerCase(),
                    bg_color: element.deliveryPaymentStatus?.bg_color,
                    color: element.deliveryPaymentStatus?.color,
                    header_name: 'Pago envío'
                },
                { type: 'text', value: this.dataService.getFormatedPrice(Number(element.delivery)), header_name: 'Total envío' }
            ];
            // En modo consulta el detalle vive bajo la ruta del propio listado (/consultas/ventas/view/:id)
            curr_row.rowLink = this.readOnly ? 'view/' + element.id : '/store/sales/history/view/' + element.id;
            curr_row.rowLinkAbsolute = !this.readOnly;
            this.tableElementsValues.push(curr_row);
        });
    }

    get r() { return this.rawMaterialForm.controls; }

    selectMeasure(measureId?: string) {
        return this.measureOptions?.find(measure => String(measure.id) === measureId);
    }

    get quantityInput() { return this.rawMaterialForm.get('quantity'); }
    get measureSelect() { return this.rawMaterialForm.get('measure'); }

    closeRawMaterialDialog() { this.onResetMaterialForm(); }

    onResetMaterialForm() {
        this.rawMaterialForm.reset();
        this.selectedInventoryElement = undefined;
        this.selectedMeasure = undefined;
        this.currentMeasureQuantity = 0;
        this.formQuantity = 0;
        this.modalSelectedQuantity = 0;
        this.modalUnitBaseTotalQuantity = 0;
        this.elements = [];
    }

    createMaterialFormGroup() {
        return new FormGroup({
            quantity: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/)]),
            measure: new FormControl('', [Validators.required])
        });
    }

    saveSale() {
        this.router.navigate(['/store/sales/create'], { queryParams: { strId: this.establishment?.id } });
    }
}
