import { Component, HostListener, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { first } from 'rxjs/operators';
import { CdkDrag, CdkDragDrop, CdkDropList, transferArrayItem } from '@angular/cdk/drag-drop';
import { DateRange } from '@angular/material/datepicker';

import { AccountService, AlertService, DataService, pfsFactoryOrderStatusValues } from '@app/services';
import { getStoreColor } from '@app/helpers';
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { ProductForSaleStoreOrderElement } from '@app/models/product-for-sale/product-for-sale-store-order-element.model';

/** Un listado del tablero. `statusId` es el factory_status_id que representa. */
interface BoardColumn {
    statusId: number;
    title: string;
    color: string;
    orders: ProductForSaleStoreOrder[];
}

/** Movimiento a la espera de confirmación del usuario. */
interface PendingMove {
    order: ProductForSaleStoreOrder;
    from: BoardColumn;
    to: BoardColumn;
    fromIndex: number;
    toIndex: number;
}

/**
 * Tablero tipo Kanban de los pedidos de producto terminado en bodega.
 *
 *   Pendiente(11) -> En curso(12) -> Listo(13) -> En camino(1)
 *        ^______________|
 *
 * Reglas:
 *  - En curso es obligatorio: desde el tablero no se salta de Pendiente a Listo.
 *  - Solo el encargado que tomó el pedido (o un admin) puede sacarlo de En curso.
 *  - En curso -> Listo es la única transición que mueve inventario, y es la
 *    única que pide confirmación.
 *
 * La validación real vive en la base (procedure v2 y guards de los UPDATE);
 * acá solo se deshabilita el arrastre para que la UI no ofrezca lo imposible.
 */
@Component({
    templateUrl: 'board-pfs-order.component.html',
    styleUrls: ['board-pfs-order.component.scss'],
    providers: [DatePipe]
})
export class BoardFinishedProductOrderComponent implements OnInit {

    columns: BoardColumn[] = [
        { statusId: pfsFactoryOrderStatusValues.pendiente.status.id, title: 'Pendiente',  color: '#5d6d7e', orders: [] },
        { statusId: pfsFactoryOrderStatusValues.en_curso.status.id,  title: 'En curso',   color: '#8e44ad', orders: [] },
        { statusId: pfsFactoryOrderStatusValues.listo.status.id,     title: 'Listo',      color: '#3498db', orders: [] },
        { statusId: pfsFactoryOrderStatusValues.en_camino.status.id, title: 'En camino',  color: '#f1c40f', orders: [] },
    ];

    /** Ids de los cdkDropList, para conectarlos todos entre sí. */
    dropListIds = this.columns.map(c => 'board-col-' + c.statusId);

    loadingOrders = false;
    submitting = false;

    /** Movimiento esperando confirmación (solo aplica a "Listo"). */
    pendingMove?: PendingMove;

    /** Pedido cuyo detalle se muestra en el modal "Ver productos". */
    selectedOrder?: ProductForSaleStoreOrder;
    selectedElements?: ProductForSaleStoreOrderElement[];
    loadingElements = false;

    // Filtro de fechas (15 días por defecto)
    datePanelOpen = false;
    maxDate = new Date();
    appliedStartDate?: Date;
    appliedEndDate?: Date;
    selectedDateRange: DateRange<Date> | null = null;

    private readonly avatarPalette = [
        '#4361ee', '#3a86ff', '#7b2d8b', '#2ec4b6',
        '#e76f51', '#06d6a0', '#f72585', '#4cc9f0'
    ];


    constructor(
        private dataService: DataService,
        private accountService: AccountService,
        private alertService: AlertService,
        private datePipe: DatePipe
    ) {}

    ngOnInit() {
        const today = new Date();
        const start = new Date();
        start.setDate(today.getDate() - 15);
        this.appliedStartDate = start;
        this.appliedEndDate = today;
        this.selectedDateRange = new DateRange<Date>(start, today);

        this.retrieveOrders();
    }

    // ── Carga ────────────────────────────────────────────────────────────────

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

    /**
     * @param silent recarga sin spinner, para refrescar después de un movimiento
     *               sin que el tablero parpadee.
     */
    retrieveOrders(silent = false) {
        if (!silent) this.loadingOrders = true;

        this.dataService.getAllProductForSaleOrderForBoard(this.buildOrderParams())
            .pipe(first())
            .subscribe({
                next: (result: any) => {
                    const orders: ProductForSaleStoreOrder[] = this.dataService.findJsonValue(result, 'json_result') || [];
                    this.distribute(orders);
                },
                error: (e) => {
                    console.error('Error al cargar los pedidos del tablero', e);
                    this.alertService.error('Error al cargar los pedidos');
                },
                complete: () => { this.loadingOrders = false; }
            });
    }

    /** Reparte los pedidos en los 4 listados; el resto de estados no se muestra. */
    private distribute(orders: ProductForSaleStoreOrder[]) {
        this.columns.forEach(col => col.orders = []);
        orders.forEach(order => {
            const column = this.columns.find(c => c.statusId === order.factoryStatus?.id);
            if (column) column.orders.push(order);
        });
    }

    // ── Reglas de transición ─────────────────────────────────────────────────

    /** ¿El usuario actual es el encargado del pedido, o un admin? */
    isOwner(order: ProductForSaleStoreOrder): boolean {
        if (this.accountService.isAdminUser()) return true;
        // Un pedido sin encargado (tomado antes del tablero) no bloquea a nadie.
        if (!order.assignedUser?.id) return true;
        return order.assignedUser.id === this.accountService.userValue.uuid;
    }

    isTransitionAllowed(order: ProductForSaleStoreOrder, targetStatusId: number): boolean {
        const from = order.factoryStatus?.id;
        if (from === undefined || from === targetStatusId) return false;

        const S = pfsFactoryOrderStatusValues;

        // Pendiente -> En curso: cualquiera de bodega.
        if (from === S.pendiente.status.id && targetStatusId === S.en_curso.status.id) return true;

        // En curso -> Pendiente (liberar) y En curso -> Listo: solo el encargado.
        if (from === S.en_curso.status.id &&
            (targetStatusId === S.pendiente.status.id || targetStatusId === S.listo.status.id)) {
            return this.isOwner(order);
        }

        // Listo -> En camino: cualquiera.
        if (from === S.listo.status.id && targetStatusId === S.en_camino.status.id) return true;

        return false;
    }

    /**
     * Predicate del CDK. Se define como propiedad flecha para que la referencia
     * sea estable entre ciclos de detección de cambios.
     *
     * El listado propio siempre acepta la tarjeta: si no, al arrastrar hacia
     * otra columna y arrepentirse, la tarjeta no podría volver a la suya. El
     * movimiento nulo lo descarta drop().
     */
    canDrop = (drag: CdkDrag<ProductForSaleStoreOrder>, drop: CdkDropList<BoardColumn>): boolean => {
        if (drag.data?.factoryStatus?.id === drop.data.statusId) return true;
        return this.isTransitionAllowed(drag.data, drop.data.statusId);
    };

    /** Una tarjeta solo se puede arrastrar si tiene al menos un destino válido. */
    isDraggable(order: ProductForSaleStoreOrder): boolean {
        return this.columns.some(col => this.isTransitionAllowed(order, col.statusId));
    }

    // ── Drag & drop ──────────────────────────────────────────────────────────

    drop(event: CdkDragDrop<BoardColumn>) {
        // Reordenar dentro del mismo listado no significa nada acá.
        if (event.previousContainer === event.container) return;

        const from = event.previousContainer.data;
        const to = event.container.data;
        const order = event.item.data as ProductForSaleStoreOrder;

        if (!this.isTransitionAllowed(order, to.statusId)) return;

        // Movimiento optimista: la tarjeta se queda donde la soltaron mientras
        // responde la API. Si algo falla, revertMove() la devuelve.
        transferArrayItem(from.orders, to.orders, event.previousIndex, event.currentIndex);

        const move: PendingMove = {
            order, from, to,
            fromIndex: event.previousIndex,
            toIndex: event.currentIndex
        };

        // Pasar a Listo descuenta producto terminado de bodega: se confirma.
        if (to.statusId === pfsFactoryOrderStatusValues.listo.status.id) {
            this.pendingMove = move;
            return;
        }

        this.applyMove(move);
    }

    /** Devuelve la tarjeta a su listado original. */
    private revertMove(move: PendingMove) {
        const currentIndex = move.to.orders.indexOf(move.order);
        if (currentIndex === -1) return;
        transferArrayItem(move.to.orders, move.from.orders, currentIndex, move.fromIndex);
    }

    confirmPendingMove() {
        if (!this.pendingMove) return;
        const move = this.pendingMove;
        this.pendingMove = undefined;
        this.applyMove(move);
    }

    cancelPendingMove() {
        if (!this.pendingMove) return;
        this.revertMove(this.pendingMove);
        this.pendingMove = undefined;
    }

    private applyMove(move: PendingMove) {
        const S = pfsFactoryOrderStatusValues;
        const orderId = move.order.id!;
        let request;
        let successMessage: string;

        if (move.to.statusId === S.en_curso.status.id) {
            request = this.dataService.startProductForSaleOrder(orderId);
            successMessage = 'Pedido tomado';
        } else if (move.to.statusId === S.pendiente.status.id) {
            request = this.dataService.releaseProductForSaleOrder(orderId);
            successMessage = 'Pedido liberado';
        } else if (move.to.statusId === S.listo.status.id) {
            request = this.dataService.manageProductForSaleOrderStateReadyV2(orderId);
            successMessage = 'Pedido marcado como listo';
        } else if (move.to.statusId === S.en_camino.status.id) {
            request = this.dataService.updateProductForSaleOrderEnCamino(orderId);
            successMessage = 'Pedido marcado como en camino';
        } else {
            this.revertMove(move);
            return;
        }

        this.submitting = true;
        request.pipe(first()).subscribe({
            next: () => {
                this.alertService.success(successMessage);
                // Recarga silenciosa: los UPDATE traen guards por estado, así que
                // si la fila no cambió (otro usuario se adelantó) el tablero se
                // corrige solo con los datos reales del servidor.
                this.retrieveOrders(true);
            },
            error: (error) => {
                this.revertMove(move);
                this.alertService.error(
                    this.dataService.getErrorMessageResponse(error, 'No se pudo mover el pedido')
                );
            }
        }).add(() => { this.submitting = false; });
    }

    // ── Modal "Ver productos" ────────────────────────────────────────────────

    /**
     * Siempre se consulta al servidor, sin caché: los productos de un pedido se
     * pueden editar mientras esté en Pendiente o En curso
     * (update_product_for_sale_order_with_elements valida factory_status_id in
     * (11, 12)), que son justo las dos primeras columnas del tablero. Cachear
     * haría que bodega prepare un pedido con la lista vieja.
     */
    openProducts(order: ProductForSaleStoreOrder) {
        this.selectedOrder = order;
        this.selectedElements = undefined;

        this.loadingElements = true;
        this.dataService.getProductForSaleOrderById(order.id!)
            .pipe(first())
            .subscribe({
                next: (response: any) => {
                    const detail = this.dataService.findJsonValue(response, 'json_result') || {};
                    this.selectedElements = detail.productForSaleStoreOrderElements || [];
                },
                error: () => {
                    this.alertService.error('Error al cargar los productos del pedido');
                    this.selectedElements = [];
                },
                complete: () => { this.loadingElements = false; }
            });
    }

    // ── Presentación ─────────────────────────────────────────────────────────

    /** Fecha corta para las tarjetas: DD/MM HH:mm. */
    formatShortDateTime(utcTime?: string): string {
        if (!utcTime) return '';
        let clean = utcTime.replaceAll('"', '');
        clean = clean.includes('Z') ? clean : clean + 'Z';
        const date = new Date(clean);
        if (isNaN(date.getTime())) return '';
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    getInitials(name?: string): string {
        if (!name) return '?';
        return name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
    }

    getAvatarColor(name?: string): string {
        if (!name) return this.avatarPalette[0];
        return this.avatarPalette[name.charCodeAt(0) % this.avatarPalette.length];
    }

    /**
     * Color de la cápsula de tienda. Vive en un helper compartido para que el tablero y el
     * dashboard de pedidos pinten la misma tienda del mismo color.
     */
    getStoreColor(establishmentId?: string): string {
        return getStoreColor(establishmentId);
    }

    trackByOrderId(_index: number, order: ProductForSaleStoreOrder) {
        return order.id;
    }

    // ── Filtro de fechas ─────────────────────────────────────────────────────

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
        const today = new Date();
        const start = new Date();
        start.setDate(today.getDate() - 15);
        this.selectedDateRange = new DateRange<Date>(start, today);
    }

    applyDateRange() {
        if (!this.selectedDateRange?.start || !this.selectedDateRange?.end) {
            this.alertService.warn('Selecciona una fecha de inicio y una de fin');
            return;
        }
        this.appliedStartDate = this.selectedDateRange.start;
        this.appliedEndDate = this.selectedDateRange.end;
        this.datePanelOpen = false;
        this.retrieveOrders();
    }
}
