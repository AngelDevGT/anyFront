import { Component, OnInit, HostListener } from '@angular/core';

import { AlertService, DataService} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Measure } from '@app/models';
import { UnitBase } from '@app/models/auxiliary/unit-base.model';
import { forkJoin } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ShopResume } from '@app/models/store/shop-resume.model';
import { Establishment } from '@app/models/establishment.model';

@Component({
    templateUrl: 'list-store-sales-pfs.component.html',
    styleUrls: ['list-store-sales-pfs.component.scss']
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

    filterPanelOpen = false;
    saleStatusFilters: string[] = [];
    orderPaymentStatusFilters: string[] = [];
    deliveryPaymentStatusFilters: string[] = [];
    pendingSaleStatuses: string[] = [];
    pendingOrderPaymentStatuses: string[] = [];
    pendingDeliveryPaymentStatuses: string[] = [];
    saleStatusExpanded = true;
    orderPaymentExpanded = true;
    deliveryPaymentExpanded = true;

    constructor(private dataService: DataService, private route: ActivatedRoute, private alertService: AlertService, private router: Router) {}

    ngOnInit() {
        const establishmentId = this.route.snapshot.params['id'];
        const requestArray = [
            this.dataService.getAllShopHistory({establishment_id: establishmentId}),
            this.dataService.getAnyComponent({}, 'getMeasure'),
            this.dataService.getEstablishmentById(establishmentId)
        ];

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.shopResumes = this.dataService.findJsonValue(result[0], 'json_result') || [];
                this.allShopResumes = this.shopResumes;
                this.measureOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];
                this.establishment = this.dataService.findJsonValue(result[2], 'json_result') || {};
            },
            error: (e) => console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.shopResumes = this.shopResumes?.sort((a, b) =>
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
                this.setTableElements(this.shopResumes);
                this.storeName = this.establishment?.name;
            }
        });
        this.rawMaterialForm = this.createMaterialFormGroup();
    }

    @HostListener('document:click')
    onDocumentClick() {
        if (this.filterPanelOpen) this.filterPanelOpen = false;
    }

    get activeFilterCount(): number {
        return this.saleStatusFilters.length + this.orderPaymentStatusFilters.length + this.deliveryPaymentStatusFilters.length;
    }

    toggleFilterPanel(event?: Event) {
        event?.stopPropagation();
        this.filterPanelOpen = !this.filterPanelOpen;
        if (this.filterPanelOpen) {
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
            curr_row.rowLink = '/store/sales/history/view/' + element.id;
            curr_row.rowLinkAbsolute = true;
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
