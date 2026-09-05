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
import {
    bankOptions, formatPaymentDetail, requiresPaymentDetailById,
    BANK_NAME_MAX_LENGTH, REFERENCE_NO_MAX_LENGTH
} from '@app/helpers';

/**
 * Abono listo para mandarse: monto, tipo de pago, comentario, fecha ya en UTC y —cuando el pago es
 * con Depósito o Cheque— el banco y el número de transferencia o de cheque.
 */
interface PaymentEntry {
    amount: string;
    paymentType: string;
    comment: string;
    date: string;
    bank: string;
    referenceNo: string;
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
    /** Topes de shop_sale_payment.bank y .reference_no */
    readonly bankMaxLength = BANK_NAME_MAX_LENGTH;
    readonly referenceMaxLength = REFERENCE_NO_MAX_LENGTH;
    /**
     * Bancos de la tienda, para el select del abono. Salen de establishment.banks; la venta no los
     * trae, así que la pantalla pide la tienda aparte. Sin bancos cargados no se puede cobrar con
     * Depósito ni con Cheque.
     */
    bankOptionsList: string[] = [];

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
                    this.loadBanks();
                    this.loading = false;
                }
            });
        }
    }

    /**
     * Los bancos de la tienda para el select del abono. Va aparte del forkJoin del ngOnInit porque
     * el id de la tienda recién se conoce cuando llega la venta. No bloquea la pantalla: el modal
     * de cobro se abre por acción del usuario, mucho después de que esto resuelva.
     */
    private loadBanks() {
        const establishmentId = this.shopResume?.establecimiento?.id ?? this.shopResume?.establishment?.id;
        if (!establishmentId || this.readOnly) return;

        this.dataService.getEstablishmentById(establishmentId)
            .pipe(first())
            .subscribe({
                next: (response: any) => {
                    const establishment = this.dataService.findJsonValue(response, 'json_result');
                    this.bankOptionsList = bankOptions(establishment?.banks);
                },
                // Sin bancos el formulario ya avisa que no se puede cobrar con Depósito ni Cheque;
                // no hace falta un error aparte que tape la venta que sí se está viendo
                error: () => { this.bankOptionsList = []; }
            });
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
        const saleUserName = this.shopResume?.creatorUser?.name ?? 'Sistema';
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
                // Solo el usuario que quedó guardado con el pago. Quien cobra no
                // siempre es quien vendió, así que no se deriva de la venta: los
                // pagos sin usuario (abonos anteriores a 2026-08-11 y el depósito
                // registrado con la venta) no muestran ninguno.
                subtitle: p.creatorUser?.name ?? '',
                tag: this.getPaymentTargetLabel(p.paymentTarget),
                date: p.date,
                // Banco y referencia van en su propia línea, encima del comentario: son el dato
                // duro con el que se cuadra contra el banco. Vacío en los pagos en efectivo y en
                // los anteriores a 2026-09-01.
                detail: formatPaymentDetail(p),
                comment: p.comment
            });
        });

        if (this.shopResume?.creationDate) {
            events.push({
                icon: 'add_circle',
                title: 'Venta Registrada',
                subtitle: saleUserName,
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
            // Banco y referencia: obligatorios cuando el tipo elegido es Depósito o Cheque. La
            // regla vive en canSubmitPayment y no en un Validators.required, porque depende del
            // tipo de pago que el usuario elija en el mismo formulario.
            orderBank: new FormControl('', [Validators.maxLength(this.bankMaxLength)]),
            orderReferenceNo: new FormControl('', [Validators.maxLength(this.referenceMaxLength)]),
            orderComment: new FormControl('', [Validators.maxLength(this.commentMaxLength)]),
            orderDate: new FormControl(this.dataService.getLocalDateTimeInputValue()),
            deliveryAmount: new FormControl('', [Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
            deliveryPaymentType: new FormControl(''),
            deliveryBank: new FormControl('', [Validators.maxLength(this.bankMaxLength)]),
            deliveryReferenceNo: new FormControl('', [Validators.maxLength(this.referenceMaxLength)]),
            deliveryComment: new FormControl('', [Validators.maxLength(this.commentMaxLength)]),
            deliveryDate: new FormControl(this.dataService.getLocalDateTimeInputValue())
        });
    }

    /** La tienda no tiene bancos cargados: no se puede cobrar con Depósito ni con Cheque. */
    get hasNoBanks(): boolean {
        return !this.bankOptionsList.length;
    }

    /** El tipo de pago elegido para el pedido exige banco y referencia. */
    get orderNeedsDetail(): boolean {
        return requiresPaymentDetailById(this.paymentForm?.get('orderPaymentType')?.value, this.paymentTypeOptions);
    }

    get deliveryNeedsDetail(): boolean {
        return requiresPaymentDetailById(this.paymentForm?.get('deliveryPaymentType')?.value, this.paymentTypeOptions);
    }

    /**
     * Los datos bancarios del pedido ya están completos y el envío también los pide, así que se
     * pueden copiar: es normal cobrar las dos cosas con una sola transferencia.
     *
     * Exige canPayOrder porque si la venta solo debe el envío el bloque del pedido ni se muestra y
     * no hay nada de dónde copiar; y exige deliveryNeedsDetail porque con el envío en efectivo no
     * hay campos donde pegar.
     */
    get canCopyOrderPaymentDetail(): boolean {
        if (!this.canPayOrder || !this.canPayDelivery) return false;
        if (!this.orderNeedsDetail || !this.deliveryNeedsDetail) return false;
        if (this.hasNoBanks) return false;
        const value = this.paymentForm?.value;
        return !!(value?.orderBank && value?.orderReferenceNo);
    }

    /** Copia banco, referencia y fecha del pago del pedido al del envío. */
    copyOrderPaymentDetailToDelivery() {
        if (!this.canCopyOrderPaymentDetail) return;
        const value = this.paymentForm.value;
        this.paymentForm.patchValue({
            deliveryBank: value.orderBank,
            deliveryReferenceNo: value.orderReferenceNo,
            deliveryDate: value.orderDate
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

    private buildPaymentEntry(amount: any, paymentType: any, comment: any, date: any,
        bank: any, referenceNo: any): PaymentEntry | null {
        const amt = Number(amount);
        if (!amount || Number.isNaN(amt) || amt <= 0 || !paymentType) return null;

        // Solo se mandan cuando el tipo los pide: si el usuario cambió de método después de
        // escribirlos, quedarían pegados a un pago en efectivo
        const needsDetail = requiresPaymentDetailById(paymentType, this.paymentTypeOptions);
        return {
            amount: String(amount),
            paymentType: String(paymentType),
            comment: (comment ?? '').toString().trim(),
            // El input entrega hora local; la BD guarda UTC. Si viene vacío se
            // manda cadena vacía y la procedure aplica su now().
            date: this.dataService.getUTCTimeFromLocalDateTime(date),
            bank: needsDetail ? (bank ?? '').toString().trim() : '',
            referenceNo: needsDetail ? (referenceNo ?? '').toString().trim() : ''
        };
    }

    /** El abono está completo: si su tipo pide banco y referencia, los dos tienen que estar. */
    private isPaymentEntryComplete(entry: PaymentEntry | null): boolean {
        if (!entry) return false;
        if (!requiresPaymentDetailById(entry.paymentType, this.paymentTypeOptions)) return true;
        return !!entry.bank && !!entry.referenceNo;
    }

    get canSubmitPayment(): boolean {
        if (this.paymentForm.invalid) return false;
        const v = this.paymentForm.value;
        const order = this.canPayOrder ? this.buildPaymentEntry(v.orderAmount, v.orderPaymentType, v.orderComment, v.orderDate, v.orderBank, v.orderReferenceNo) : null;
        const delivery = this.canPayDelivery ? this.buildPaymentEntry(v.deliveryAmount, v.deliveryPaymentType, v.deliveryComment, v.deliveryDate, v.deliveryBank, v.deliveryReferenceNo) : null;
        if (!order && !delivery) return false;
        // Un abono a medias bloquea el envío completo: mandar el otro y perder este sería peor,
        // porque el usuario ya no vería lo que le faltó
        if (order && !this.isPaymentEntryComplete(order)) return false;
        if (delivery && !this.isPaymentEntryComplete(delivery)) return false;
        return true;
    }

    submitPayment() {
        if (!this.shopResume?.id) return;

        // Capture values BEFORE closing the modal — clicking the X triggers
        // closePaymentModal() which resets the form, nullifying the values.
        const v = this.paymentForm.value;
        const calls = [];
        if (this.canPayOrder) {
            const order = this.buildPaymentEntry(v.orderAmount, v.orderPaymentType, v.orderComment, v.orderDate, v.orderBank, v.orderReferenceNo);
            if (order) calls.push(this.dataService.addShopSalePayment(this.shopResume.id, order.amount, order.paymentType, 'ORDER',
                order.comment, order.date, order.bank, order.referenceNo));
        }
        if (this.canPayDelivery) {
            const delivery = this.buildPaymentEntry(v.deliveryAmount, v.deliveryPaymentType, v.deliveryComment, v.deliveryDate, v.deliveryBank, v.deliveryReferenceNo);
            if (delivery) calls.push(this.dataService.addShopSalePayment(this.shopResume.id, delivery.amount, delivery.paymentType, 'DELIVERY',
                delivery.comment, delivery.date, delivery.bank, delivery.referenceNo));
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
        // Banco y referencia se siembran con '' y no se dejan en el null de reset(): con null el
        // select no marca su opción vacía y queda en blanco sin placeholder.
        this.paymentForm.reset({
            orderAmount: '', orderPaymentType: '', orderComment: '', orderDate: now,
            orderBank: '', orderReferenceNo: '',
            deliveryAmount: '', deliveryPaymentType: '', deliveryComment: '', deliveryDate: now,
            deliveryBank: '', deliveryReferenceNo: ''
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
