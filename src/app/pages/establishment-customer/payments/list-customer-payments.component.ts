import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { first } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';

import { AlertService, DataService } from '@app/services';
import { SALE_TYPE_COLORS, DEFAULT_SALE_TYPE_COLOR, formatPaymentDetail } from '@app/helpers';
import { EstablishmentCustomer } from '@app/models/system/establishment-customer.model';
import { Establishment } from '@app/models/establishment.model';
import { CustomerSaleHistory } from '@app/models/store/customer-sale-history.model';
import { ShopSalePayment } from '@app/models/store/shop-sale-payment.model';

/** Estado de shop_sale con el que la venta sigue vigente; el resto es cancelada o eliminada. */
const ACTIVE_SALE_STATUS_ID = 52;

/** Nombre del payment_type de crédito, tal como está en la tabla. */
const CREDIT_PAYMENT_TYPE = 'Crédito';

/**
 * Historial de ventas de un cliente en una tienda: Tienda > Listado de tiendas >
 * Clientes > Historial de ventas.
 *
 * /store/customers/payments?store=<tienda>&customer=<cliente>
 *
 * La ruta conserva el nombre "payments" de cuando la pantalla listaba solo
 * abonos: cambiarla obligaría a actualizar los role.paths de producción y no
 * aporta nada. Hoy la unidad de la tabla es LA VENTA, no el abono, e incluye
 * las ventas en efectivo, cheque y depósito. El detalle abono por abono está
 * en "Ver venta".
 *
 * La tienda y el cliente viajan como query params, no por estado del router,
 * para que la vista se pueda recargar y compartir por URL.
 */
@Component({
    templateUrl: 'list-customer-payments.component.html',
    styleUrls: ['list-customer-payments.component.scss']
})
export class ListCustomerPaymentsComponent implements OnInit {

    establishmentId!: string;
    customerId!: string;
    establishment?: Establishment;
    customer?: EstablishmentCustomer;
    sales?: CustomerSaleHistory[];
    allSales?: CustomerSaleHistory[];
    searchTerm?: string;
    pageSize = this.dataService.defaultPageSize;
    tableElementsValues?: any;

    // ── Modal: historial de una venta ──────────────────────────
    // Los pagos NO vienen con el historial: la tabla solo trae el acumulado.
    // Se piden al abrir el modal, así la lista se mantiene liviana y el detalle
    // siempre sale al día aunque alguien haya abonado desde otra pantalla.
    selectedSale?: CustomerSaleHistory;
    salePayments?: ShopSalePayment[];
    paymentsError?: string;
    /** Mismos eventos que el "Historial" de la vista de la venta. */
    timeline: any[] = [];

    constructor(
        private dataService: DataService,
        private alertService: AlertService,
        private route: ActivatedRoute,
        private router: Router
    ) {}

    ngOnInit() {
        this.establishmentId = this.route.snapshot.queryParams['store'];
        this.customerId = this.route.snapshot.queryParams['customer'];

        // Sin tienda o sin cliente no hay historial que pedir, y tampoco se sabe
        // a qué pantalla de saldos volver: se regresa al listado de tiendas.
        if (!this.establishmentId || !this.customerId) {
            this.alertService.error('No se recibió la tienda o el cliente del historial de ventas');
            this.router.navigateByUrl('/store');
            return;
        }

        forkJoin([
            this.dataService.getEstablishmentById(this.establishmentId),
            // El saldo pendiente sale de la misma consulta que alimenta "Saldos de
            // clientes", para que ambas pantallas nunca muestren cifras distintas.
            this.dataService.getEstablishmentCustomers(this.establishmentId),
            this.dataService.getCustomerSalesHistory(this.establishmentId, this.customerId)
        ]).subscribe({
            next: (result: any) => {
                this.establishment = this.dataService.findJsonValue(result[0], 'json_result') || {};
                const customers: EstablishmentCustomer[] = this.dataService.findJsonValue(result[1], 'json_result') || [];
                this.customer = customers.find(customer => customer.id === this.customerId);
                this.allSales = this.dataService.findJsonValue(result[2], 'json_result') || [];
            },
            error: error => {
                this.allSales = [];
                this.sales = [];
                this.setTableElements([]);
                this.alertService.error(this.dataService.getErrorMessageResponse(error, 'Error al cargar el historial de ventas del cliente'));
            },
            complete: () => this.search()
        });
    }

    goBack() {
        this.router.navigateByUrl('/store/customers/' + this.establishmentId);
    }

    formatPrice(value?: number | string): string {
        return this.dataService.getFormatedPriceWithSeparators(Number(value ?? 0));
    }

    /** Las fechas de json_agg a veces llegan entrecomilladas; se limpian antes de convertir. */
    formatDateTime(value?: string): string {
        return value ? this.dataService.getLocalDateTimeFromUTCTime(value.replaceAll('"', '')) : '--';
    }

    /** Saldo del cliente en esta tienda: pedido + envío de sus ventas activas. */
    get pendingBalance(): number {
        return Number(this.customer?.pendingBalance ?? 0);
    }

    get hasPendingBalance(): boolean {
        return this.pendingBalance > 0;
    }

    /** Solo las ventas vigentes: una venta cancelada se sigue listando pero no se vendió. */
    private get activeSales(): CustomerSaleHistory[] {
        return (this.allSales ?? []).filter(sale => sale.status?.id === ACTIVE_SALE_STATUS_ID);
    }

    get totalSold(): number {
        return this.activeSales.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0);
    }

    /** Suma de los abonos de todas las ventas listadas, sin el filtro de búsqueda. */
    get totalPaid(): number {
        return (this.allSales ?? []).reduce((sum, sale) => sum + this.getCreditPaid(sale), 0);
    }

    get salesCount(): number {
        return (this.allSales ?? []).length;
    }

    search(): void {
        const term = this.searchTerm?.trim().toLowerCase();
        this.sales = (this.allSales ?? []).filter(sale => {
            if (!term) return true;
            return String(sale.saleNumber ?? '').includes(term)
                || this.getSaleTypeLabel(sale).toLowerCase().includes(term)
                || String(sale.total ?? '').includes(term)
                || sale.nota?.toLowerCase().includes(term)
                || sale.status?.identifier?.toLowerCase().includes(term)
                || sale.creatorUser?.name?.toLowerCase().includes(term);
        });
        this.setTableElements(this.sales);
    }

    /**
     * El pedido y el envío se cobran por separado y pueden llevar tipos de pago
     * distintos. Basta con que uno de los dos sea crédito para que la venta deje
     * saldo por cobrar, así que ese caso manda sobre el otro.
     */
    private isCreditSale(sale: CustomerSaleHistory): boolean {
        return sale.paymentType?.identifier === CREDIT_PAYMENT_TYPE
            || (sale.deliveryPaymentType?.identifier === CREDIT_PAYMENT_TYPE && Number(sale.delivery ?? 0) > 0);
    }

    /** Efectivo | Cheque | Depósito | Al crédito, o "pedido / envío" si difieren. */
    getSaleTypeLabel(sale: CustomerSaleHistory): string {
        const orderType = sale.paymentType?.identifier;
        const deliveryType = sale.deliveryPaymentType?.identifier;
        if (orderType && deliveryType && deliveryType !== orderType && Number(sale.delivery ?? 0) > 0) {
            return orderType + ' / ' + deliveryType;
        }
        return orderType || deliveryType || '--';
    }

    /** Abonos acumulados de la venta; el depósito de la venta no cuenta (lo excluye la query). */
    private getCreditPaid(sale: CustomerSaleHistory): number {
        return Number(sale.creditPaidAmount ?? 0);
    }

    /** Lo que falta cobrar de la venta: pedido + envío. */
    private getPendingAmount(sale: CustomerSaleHistory): number {
        return Number(sale.pendingAmount ?? 0) + Number(sale.deliveryPendingAmount ?? 0);
    }

    // ── Modal: historial de una venta ──────────────────────────

    /**
     * Lo dispara el botón "Ver historial" de la fila, vía (modalAction) del
     * data-table. Bootstrap abre el modal en el mismo click, así que el timeline
     * arranca vacío y se llena cuando responde el endpoint.
     */
    receiveData(sale: CustomerSaleHistory) {
        this.selectedSale = sale;
        this.salePayments = undefined;
        this.paymentsError = undefined;
        this.timeline = [];
        if (!sale?.id) return;

        this.dataService.getShopSalePayments(sale.id)
            .pipe(first())
            .subscribe({
                next: (result: any) => {
                    this.salePayments = this.dataService.findJsonValue(result, 'json_result') || [];
                },
                error: error => {
                    this.salePayments = [];
                    this.paymentsError = this.dataService.getErrorMessageResponse(error, 'Error al cargar el historial de la venta');
                },
                complete: () => this.buildTimeline()
            });
    }

    /**
     * Mismos eventos y mismos textos que el bloque "Historial" de la vista de la
     * venta (view-store-sales-pfs), para que el usuario lea lo mismo en las dos
     * pantallas: los pagos y el registro de la venta, del más reciente al más
     * antiguo.
     */
    private buildTimeline() {
        const events: any[] = [];

        (this.salePayments ?? []).forEach(payment => {
            const amount = this.dataService.getFormatedPrice(Number(payment.amount ?? 0));
            const type = payment.paymentType?.identifier ?? '--';
            events.push({
                // El depósito se registra junto con la venta; el resto son abonos
                icon: payment.isSalePayment ? 'account_balance' : 'payments',
                title: payment.isSalePayment
                    ? `Pago de ${amount} al registrar la venta (${type})`
                    : `Cobro de ${amount} (${type})`,
                // Solo el usuario que quedó guardado con el pago: quien cobra no
                // siempre es quien vendió.
                subtitle: payment.creatorUser?.name ?? '',
                tag: this.getPaymentTargetLabel(payment.paymentTarget),
                date: payment.date,
                // Banco y referencia del pago, encima del comentario. Vacío en los pagos en
                // efectivo y en los anteriores a 2026-09-01.
                detail: formatPaymentDetail(payment),
                comment: payment.comment
            });
        });

        if (this.selectedSale?.creationDate) {
            events.push({
                icon: 'add_circle',
                title: 'Venta Registrada',
                subtitle: this.selectedSale.creatorUser?.name ?? 'Sistema',
                date: this.selectedSale.creationDate
            });
        }

        this.timeline = events.sort((a, b) => this.parseDate(b.date) - this.parseDate(a.date));
    }

    /** Las fechas vienen en UTC sin sufijo; sin la Z el navegador las lee como locales. */
    private parseDate(dateStr?: string): number {
        if (!dateStr) return 0;
        let value = dateStr.replaceAll('"', '');
        value = value.includes('Z') ? value : value + 'Z';
        const time = new Date(value).getTime();
        return Number.isNaN(time) ? 0 : time;
    }

    /** El pedido y el envío se cobran por separado: cada pago dice a cuál fue. */
    getPaymentTargetLabel(target?: string): string {
        if (target === 'DELIVERY') return 'Envío';
        if (target === 'ORDER') return 'Pedido';
        return '--';
    }

    /**
     * Si la venta ya no está activa ese es el dato relevante (cancelada). Si
     * sigue activa, el estado de pago de la parte que todavía debe; sin nada
     * pendiente, el del pedido, que es el que dice "Pagado".
     */
    private getStatusCell(sale: CustomerSaleHistory) {
        let status = sale.status;
        if (sale.status?.id === ACTIVE_SALE_STATUS_ID) {
            status = Number(sale.pendingAmount ?? 0) > 0 ? sale.paymentStatus
                : Number(sale.deliveryPendingAmount ?? 0) > 0 ? sale.deliveryPaymentStatus
                : sale.paymentStatus;
        }
        return {
            type: 'badge',
            value: (status?.text || status?.identifier) ?? '--',
            identifier: status?.identifier?.toLowerCase(),
            bg_color: status?.bg_color,
            color: status?.color,
            header_name: 'Estado'
        };
    }

    setTableElements(elements: CustomerSaleHistory[]) {
        this.tableElementsValues = [];
        elements?.forEach((sale: CustomerSaleHistory) => {
            const saleId = sale.id;
            const isCredit = this.isCreditSale(sale);
            const typeLabel = this.getSaleTypeLabel(sale);
            const typeColors = SALE_TYPE_COLORS[typeLabel] ?? DEFAULT_SALE_TYPE_COLOR;
            const curr_row: any = [
                {
                    type: 'text',
                    value: this.formatDateTime(sale.creationDate),
                    header_name: 'Fecha venta'
                },
                {
                    // Link a la venta
                    type: saleId ? 'link' : 'text',
                    value: sale.saleNumber != null ? '#' + sale.saleNumber : (saleId ? 'Ver venta' : '--'),
                    routerLink: saleId ? '/store/sales/history/view/' + saleId : undefined,
                    is_absolute: true,
                    header_name: 'Venta'
                },
                {
                    type: 'badge',
                    value: typeLabel,
                    identifier: typeLabel.toLowerCase(),
                    bg_color: typeColors.bg_color,
                    color: typeColors.color,
                    header_name: 'Tipo de venta'
                },
                {
                    type: 'text',
                    value: this.dataService.getFormatedPrice(Number(sale.total ?? 0)),
                    header_name: 'Monto'
                },
                {
                    // Las que no son al crédito nacen pagadas y nunca reciben abonos:
                    // poner ahí el total las haría ver como si se hubieran abonado.
                    type: 'text',
                    value: isCredit ? this.dataService.getFormatedPrice(this.getCreditPaid(sale)) : '--',
                    header_name: 'Abonado'
                },
                {
                    type: 'text',
                    value: this.dataService.getFormatedPrice(this.getPendingAmount(sale)),
                    header_name: 'Pendiente'
                },
                {
                    type: 'text',
                    value: this.formatDateTime(sale.lastCreditPaymentDate),
                    header_name: 'Último abono'
                },
                this.getStatusCell(sale),
                {
                    // Va en todas las filas: el timeline incluye el registro de la
                    // venta, así que siempre tiene al menos un evento que mostrar.
                    type: 'modal_button',
                    header_name: 'Acciones',
                    data: sale,
                    button: [
                        {
                            type: 'button',
                            data_bs_target: '#saleHistoryModal',
                            colorClass: 'dt-btn-view',
                            icon: { class: 'material-icons', icon: 'history' },
                            title: 'Ver historial'
                        }
                    ]
                }
            ];
            // La fila NO navega: el único acceso a la venta es el link del número,
            // así no compite con el botón que abre el historial.
            this.tableElementsValues.push(curr_row);
        });
    }
}
