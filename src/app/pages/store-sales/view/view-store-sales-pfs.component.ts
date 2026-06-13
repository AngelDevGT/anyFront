import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import { forkJoin } from 'rxjs';

import { AlertService, DataService, PdfService } from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ShopResume } from '@app/models/store/shop-resume.model';
import { ItemsList } from '@app/models/store/item-list.model';
import { ShopSalePayment } from '@app/models/store/shop-sale-payment.model';
import { PaymentType } from '@app/models';
import { ActivityLog } from '@app/models/system/activity-log';

@Component({
    selector: 'page-view-store-sales-pfs',
    templateUrl: 'view-store-sales-pfs.component.html',
    styleUrls: ['view-store-sales-pfs.component.scss']
})
export class ViewStoreSalesPFSComponent implements OnInit{

    id?: string;
    shopResume?: ShopResume;
    tableElementsValues?: any;
    submitting = false;
    submittingPayment = false;
    loading = false;
    loadingPayments = false;
    pageSize = 5;
    elements: any = [];
    deleteOption = false;
    activityLogName = "Acciones de Producto para Venta en tienda";
    activityLog?: ActivityLog;

    @ViewChild('payModalCloseBtn') payModalCloseBtnRef?: ElementRef;

    // Payment modal
    paymentForm!: FormGroup;
    paymentTypeOptions?: PaymentType[];
    orderPendingAmount = 0;
    deliveryPendingAmount = 0;
    paymentError?: string;

    // Payment history
    shopSalePayments?: ShopSalePayment[];

    get isOrderCredit(): boolean {
        return this.shopResume?.paymentType?.identifier === 'Crédito';
    }

    get isDeliveryCredit(): boolean {
        return this.shopResume?.deliveryPaymentType?.identifier === 'Crédito';
    }

    get isCreditSale(): boolean {
        return this.isOrderCredit || this.isDeliveryCredit;
    }

    get hasOrderPending(): boolean {
        return Number(this.shopResume?.pendingAmount) > 0;
    }

    get hasDeliveryPending(): boolean {
        return Number(this.shopResume?.deliveryPendingAmount) > 0;
    }

    get canPayOrder(): boolean {
        return this.isOrderCredit && this.hasOrderPending;
    }

    get canPayDelivery(): boolean {
        return this.isDeliveryCredit && this.hasDeliveryPending;
    }

    get showPayButton(): boolean {
        return this.canPayOrder || this.canPayDelivery;
    }

    get nonCreditPaymentTypes(): PaymentType[] {
        return this.paymentTypeOptions?.filter(pt => pt.identifier !== 'Crédito') ?? [];
    }

    constructor(private dataService: DataService, private alertService: AlertService,
        private route: ActivatedRoute, private pdfService: PdfService, private router: Router) {
    }

    ngOnInit(): void {
        this.id = this.route.snapshot.params['id'];
        this.loading = true;
        this.paymentForm = this.createPaymentFormGroup();

        if (this.id) {
            forkJoin([
                this.dataService.getShopHistoryById({id: this.id}),
                this.dataService.getAnyComponent({}, 'getPaymentTypes')
            ]).subscribe({
                next: (result: any) => {
                    const shopRes = this.dataService.findJsonValue(result[0], 'json_result') || {};
                    this.shopResume = shopRes;
                    this.paymentTypeOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];
                },
                error: () => { this.loading = false; },
                complete: () => {
                    if (this.shopResume?.status?.id === 3) {
                        this.deleteOption = true;
                    }
                    this.setElements(this.shopResume);
                    this.activityLogName = this.activityLogName + "|||" + this.shopResume?.establecimiento?.id;
                    this.orderPendingAmount = Number(this.shopResume?.pendingAmount);
                    this.deliveryPendingAmount = Number(this.shopResume?.deliveryPendingAmount);
                    this.loading = false;
                }
            });
        }
    }

    cancelSale() {
        if (this.shopResume) {
            this.submitting = true;
            this.dataService.cancelShop(this.shopResume)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Venta cancelada', { keepAfterRouteChange: true });
                this.router.navigateByUrl('/store/sales/history/' + this.shopResume?.establishment?.id);
                },
                error: error => {
                    let errorMessage = this.dataService.getErrorMessageResponse(error, 'Error al cancelar la venta');
                    this.alertService.error(errorMessage);
                    this.submitting = false;
                }
            });
        }
    }

    editSale() {
        this.router.navigateByUrl('/store/sales/history/edit/' + this.id);
    }

    setElements(shopResume?: ShopResume){
        this.elements.push({icon : "person", name : "Cliente", value : shopResume?.nameClient ? shopResume?.nameClient : "--"});
        this.elements.push({icon : "tag", name : "NIT", value : shopResume?.nitClient ? shopResume?.nitClient : "--"});
        this.elements.push({icon : "feed", name : "Notas", value : shopResume?.nota ? shopResume?.nota : "--"});
        this.elements.push({icon : "credit_card", name : "Tipo de pago (pedido)", value : shopResume?.paymentType?.identifier ?? "--"});
        this.elements.push({icon : "local_shipping", name : "Tipo de pago (envío)", value : shopResume?.deliveryPaymentType?.identifier ?? "--"});
        this.elements.push({icon : "info", name : "Estado", value : shopResume?.status?.identifier});
        this.elements.push({icon : "payments", name : "Estado de pago (pedido)", value : shopResume?.paymentStatus?.identifier ?? "--"});
        this.elements.push({icon : "local_shipping", name : "Estado de pago (envío)", value : shopResume?.deliveryPaymentStatus?.identifier ?? "--"});
        this.elements.push({icon : "calendar_today", name : "Fecha Creación", value : this.dataService.getLocalDateTimeFromUTCTime(shopResume!.creationDate!.replaceAll("\"",""))});
        this.elements.push({icon : "calendar_today", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(shopResume!.updatedDate!.replaceAll("\"",""))});
        this.elements.push({icon : "badge", name : "Vendido por", value : shopResume?.creatorUser?.name});
        this.setTableElements(shopResume?.itemsList);
    }

    setTableElements(elements?: ItemsList[]){
        this.tableElementsValues = [];
        elements?.forEach((element: ItemsList) => {
            let curr_row = [
                    { type: "text", value: element.productForSale?.finishedProduct?.name, header_name: "Nombre" },
                    { type: "text", value: element.measure?.identifier, header_name: "Medida" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.price)), header_name: "Precio" },
                    { type: "text", value: element.quantity, header_name: "Cantidad" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.totalDiscount)), header_name: "Descuento Total" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.total)), header_name: "Total" },
            ];
            this.tableElementsValues.push(curr_row);
        });
    }

    getSubTotal(){
        return Number(this.shopResume?.total || 0) - Number(this.shopResume?.delivery || 0);
    }

    getSubTotalWithoutDiscount(){
        return Number(this.shopResume?.total || 0) + Number(this.shopResume?.totalDiscount) - Number(this.shopResume?.delivery || 0);
    }

    generatePDF() {
        this.pdfService.generateStoreSalePDF(this.shopResume!);
    }

    // ── Payment modal ─────────────────────────────────────────────────────────

    createPaymentFormGroup(): FormGroup {
        return new FormGroup({
            orderAmount: new FormControl('', [Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
            orderPaymentType: new FormControl(''),
            deliveryAmount: new FormControl('', [Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
            deliveryPaymentType: new FormControl('')
        });
    }

    onOrderAmountInput(event: Event) {
        if (event.target instanceof HTMLInputElement) {
            const val = Number(event.target.value);
            if (val > this.orderPendingAmount) {
                this.paymentForm.get('orderAmount')?.setValue(this.orderPendingAmount.toFixed(2));
            }
        }
    }

    onDeliveryAmountInput(event: Event) {
        if (event.target instanceof HTMLInputElement) {
            const val = Number(event.target.value);
            if (val > this.deliveryPendingAmount) {
                this.paymentForm.get('deliveryAmount')?.setValue(this.deliveryPendingAmount.toFixed(2));
            }
        }
    }

    private buildPaymentEntry(amount: any, paymentType: any): { amount: string; paymentType: string } | null {
        const amt = Number(amount);
        if (!amount || Number.isNaN(amt) || amt <= 0 || !paymentType) return null;
        return { amount: String(amount), paymentType: String(paymentType) };
    }

    get canSubmitPayment(): boolean {
        if (this.paymentForm.invalid) return false;
        const v = this.paymentForm.value;
        const order = this.canPayOrder ? this.buildPaymentEntry(v.orderAmount, v.orderPaymentType) : null;
        const delivery = this.canPayDelivery ? this.buildPaymentEntry(v.deliveryAmount, v.deliveryPaymentType) : null;
        return !!(order || delivery);
    }

    submitPayment() {
        if (!this.shopResume?.id) return;

        // Capture values BEFORE closing the modal — clicking the X triggers
        // closePaymentModal() which resets the form, nullifying the values.
        const v = this.paymentForm.value;
        const calls = [];
        if (this.canPayOrder) {
            const order = this.buildPaymentEntry(v.orderAmount, v.orderPaymentType);
            if (order) calls.push(this.dataService.addShopSalePayment(this.shopResume.id, order.amount, order.paymentType, 'ORDER'));
        }
        if (this.canPayDelivery) {
            const delivery = this.buildPaymentEntry(v.deliveryAmount, v.deliveryPaymentType);
            if (delivery) calls.push(this.dataService.addShopSalePayment(this.shopResume.id, delivery.amount, delivery.paymentType, 'DELIVERY'));
        }
        if (calls.length === 0) {
            this.paymentError = 'Ingrese al menos un monto a pagar';
            return;
        }

        this.payModalCloseBtnRef?.nativeElement?.click();
        this.paymentError = undefined;
        this.submittingPayment = true;

        forkJoin(calls)
            .pipe(first())
            .subscribe({
                next: () => {
                    globalThis.location.reload();
                },
                error: error => {
                    this.submittingPayment = false;
                    this.paymentError = this.dataService.getErrorMessageResponse(error, 'Error al registrar el pago');
                }
            });
    }

    closePaymentModal() {
        this.paymentForm.reset();
        this.paymentError = undefined;
    }

    // ── Payment history modal ─────────────────────────────────────────────────

    loadPaymentHistory() {
        if (!this.shopResume?.id) return;
        this.loadingPayments = true;
        this.dataService.getShopSalePayments(this.shopResume.id)
            .pipe(first())
            .subscribe({
                next: (res: any) => {
                    this.shopSalePayments = this.dataService.findJsonValue(res, 'json_result') || [];
                },
                error: () => { this.loadingPayments = false; },
                complete: () => { this.loadingPayments = false; }
            });
    }

    getPaymentDate(dateStr?: string): string {
        if (!dateStr) return '--';
        return this.dataService.getLocalDateTimeFromUTCTime(dateStr.replaceAll('"', ''));
    }

    getPaymentTargetLabel(target?: string): string {
        if (target === 'DELIVERY') return 'Envío';
        if (target === 'ORDER') return 'Pedido';
        return '--';
    }
}
