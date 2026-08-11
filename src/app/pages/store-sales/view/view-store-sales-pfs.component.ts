import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import { forkJoin } from 'rxjs';

import { AlertService, DataService, PdfService } from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ShopResume } from '@app/models/store/shop-resume.model';
import { ShopSalePayment } from '@app/models/store/shop-sale-payment.model';
import { PaymentType } from '@app/models';
import { ActivityLog } from '@app/models/system/activity-log';

/** Abono listo para mandarse: monto, tipo de pago, comentario y fecha ya en UTC. */
interface PaymentEntry {
    amount: string;
    paymentType: string;
    comment: string;
    date: string;
}

@Component({
    selector: 'page-view-store-sales-pfs',
    templateUrl: 'view-store-sales-pfs.component.html',
    styleUrls: ['view-store-sales-pfs.component.scss']
})
export class ViewStoreSalesPFSComponent implements OnInit{

    id?: string;
    shopResume?: ShopResume;
    timeline: any[] = [];
    submitting = false;
    submittingPayment = false;
    loading = false;
    deleteOption = false;
    activityLogName = "Acciones de Producto para Venta en tienda";
    activityLog?: ActivityLog;
    /** Modo consulta: la venta solo se ve y se exporta a PDF, sin editar, cancelar ni cobrar. */
    readOnly = false;

    @ViewChild('payModalCloseBtn') payModalCloseBtnRef?: ElementRef;

    // Payment modal
    paymentForm!: FormGroup;
    paymentTypeOptions?: PaymentType[];
    orderPendingAmount = 0;
    deliveryPendingAmount = 0;
    paymentError?: string;
    /** Tope del comentario del abono — igual al varchar(200) de shop_sale_payment.comment */
    readonly commentMaxLength = 200;

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
        return !this.readOnly && (this.canPayOrder || this.canPayDelivery);
    }

    /** Editar y cancelar solo aplican a una venta activa y fuera del modo consulta. */
    get canManageSale(): boolean {
        return !this.readOnly && this.shopResume?.status?.id == 52;
    }

    get nonCreditPaymentTypes(): PaymentType[] {
        return this.paymentTypeOptions?.filter(pt => pt.identifier !== 'Crédito') ?? [];
    }

    constructor(private dataService: DataService, private alertService: AlertService,
        private route: ActivatedRoute, private pdfService: PdfService, private router: Router) {
    }

    ngOnInit(): void {
        this.id = this.route.snapshot.params['id'];
        this.readOnly = !!this.route.snapshot.data['readOnly'];
        this.loading = true;
        this.paymentForm = this.createPaymentFormGroup();

        if (this.id) {
            forkJoin([
                this.dataService.getShopHistoryById({id: this.id}),
                this.dataService.getAnyComponent({}, 'getPaymentTypes'),
                this.dataService.getShopSalePayments(this.id)
            ]).subscribe({
                next: (result: any) => {
                    const shopRes = this.dataService.findJsonValue(result[0], 'json_result') || {};
                    this.shopResume = shopRes;
                    this.paymentTypeOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];
                    this.shopSalePayments = this.dataService.findJsonValue(result[2], 'json_result') || [];
                },
                error: () => { this.loading = false; },
                complete: () => {
                    if (this.shopResume?.status?.id === 3) {
                        this.deleteOption = true;
                    }
                    this.buildTimeline();
                    this.activityLogName = this.activityLogName + "|||" + this.shopResume?.establecimiento?.id;
                    this.orderPendingAmount = Number(this.shopResume?.pendingAmount);
                    this.deliveryPendingAmount = Number(this.shopResume?.deliveryPendingAmount);
                    this.loading = false;
                }
            });
        }
    }

    goBack() {
        if (this.readOnly) {
            // El listado de consultas recuerda la tienda, así que no hace falta pasarla en la ruta
            this.router.navigateByUrl('/consultas/ventas');
            return;
        }
        this.router.navigateByUrl('/store/sales/history/' + (this.shopResume?.establecimiento?.id ?? this.shopResume?.establishment?.id ?? ''));
    }

    /** Builds the activity timeline from the sale creation and registered payments. */
    buildTimeline() {
        const userName = this.shopResume?.creatorUser?.name ?? 'Sistema';
        const place = this.shopResume?.establecimiento?.name;
        const at = place ? ` en ${place}` : '';
        const events: any[] = [];

        (this.shopSalePayments || []).forEach(p => {
            const amount = this.dataService.getFormatedPrice(Number(p.amount));
            const type = p.paymentType?.identifier ?? '--';
            events.push({
                // El depósito se registra junto con la venta; el resto son abonos
                icon: p.isSalePayment ? 'account_balance' : 'payments',
                title: p.isSalePayment
                    ? `Pago de ${amount} al registrar la venta (${type})`
                    : `Cobro de ${amount} (${type})`,
                subtitle: `${userName}${at}`,
                tag: this.getPaymentTargetLabel(p.paymentTarget),
                date: p.date,
                comment: p.comment
            });
        });

        if (this.shopResume?.creationDate) {
            events.push({
                icon: 'add_circle',
                title: 'Venta Registrada',
                subtitle: `${userName}${at}`,
                date: this.shopResume.creationDate
            });
        }

        this.timeline = events.sort((a, b) => this.parseDate(b.date) - this.parseDate(a.date));
    }

    private parseDate(dateStr?: string): number {
        if (!dateStr) return 0;
        let s = dateStr.replaceAll('"', '');
        s = s.includes('Z') ? s : s + 'Z';
        const t = new Date(s).getTime();
        return Number.isNaN(t) ? 0 : t;
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

    dataPrice(value?: string | number): string {
        return this.dataService.getFormatedPrice(Number(value || 0));
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
            orderComment: new FormControl('', [Validators.maxLength(this.commentMaxLength)]),
            orderDate: new FormControl(this.dataService.getLocalDateTimeInputValue()),
            deliveryAmount: new FormControl('', [Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
            deliveryPaymentType: new FormControl(''),
            deliveryComment: new FormControl('', [Validators.maxLength(this.commentMaxLength)]),
            deliveryDate: new FormControl(this.dataService.getLocalDateTimeInputValue())
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

    private buildPaymentEntry(amount: any, paymentType: any, comment: any, date: any): PaymentEntry | null {
        const amt = Number(amount);
        if (!amount || Number.isNaN(amt) || amt <= 0 || !paymentType) return null;
        return {
            amount: String(amount),
            paymentType: String(paymentType),
            comment: (comment ?? '').toString().trim(),
            // El input entrega hora local; la BD guarda UTC. Si viene vacío se
            // manda cadena vacía y la procedure aplica su now().
            date: this.dataService.getUTCTimeFromLocalDateTime(date)
        };
    }

    get canSubmitPayment(): boolean {
        if (this.paymentForm.invalid) return false;
        const v = this.paymentForm.value;
        const order = this.canPayOrder ? this.buildPaymentEntry(v.orderAmount, v.orderPaymentType, v.orderComment, v.orderDate) : null;
        const delivery = this.canPayDelivery ? this.buildPaymentEntry(v.deliveryAmount, v.deliveryPaymentType, v.deliveryComment, v.deliveryDate) : null;
        return !!(order || delivery);
    }

    submitPayment() {
        if (!this.shopResume?.id) return;

        // Capture values BEFORE closing the modal — clicking the X triggers
        // closePaymentModal() which resets the form, nullifying the values.
        const v = this.paymentForm.value;
        const calls = [];
        if (this.canPayOrder) {
            const order = this.buildPaymentEntry(v.orderAmount, v.orderPaymentType, v.orderComment, v.orderDate);
            if (order) calls.push(this.dataService.addShopSalePayment(this.shopResume.id, order.amount, order.paymentType, 'ORDER',
                order.comment, order.date));
        }
        if (this.canPayDelivery) {
            const delivery = this.buildPaymentEntry(v.deliveryAmount, v.deliveryPaymentType, v.deliveryComment, v.deliveryDate);
            if (delivery) calls.push(this.dataService.addShopSalePayment(this.shopResume.id, delivery.amount, delivery.paymentType, 'DELIVERY',
                delivery.comment, delivery.date));
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
        // reset() a secas dejaría las fechas vacías; se re-siembran con "ahora"
        // para que al reabrir el modal el input ya venga con la hora actual.
        const now = this.dataService.getLocalDateTimeInputValue();
        this.paymentForm.reset({
            orderAmount: '', orderPaymentType: '', orderComment: '', orderDate: now,
            deliveryAmount: '', deliveryPaymentType: '', deliveryComment: '', deliveryDate: now
        });
        this.paymentError = undefined;
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
