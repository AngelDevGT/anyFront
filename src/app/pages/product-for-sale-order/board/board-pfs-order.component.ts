import { Component, HostListener, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { first } from 'rxjs/operators';
import { CdkDrag, CdkDragDrop, CdkDropList, transferArrayItem } from '@angular/cdk/drag-drop';
import { DateRange } from '@angular/material/datepicker';

import { AccountService, AlertService, CAPABILITIES, DataService, pfsFactoryOrderStatusValues } from '@app/services';
import { getStoreColor, OPERATOR_CHIP_COLOR, parseOperators, serializeOperators } from '@app/helpers';
import { OperatorCustomer } from '@app/components';
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { ProductForSaleStoreOrderElement } from '@app/models/product-for-sale/product-for-sale-store-order-element.model';

/** Un listado del tablero. `statusId` es el factory_status_id que representa. */
interface BoardColumn {
    statusId: number;
    title: string;
    color: string;
    orders: ProductForSaleStoreOrder[];
}

/**
 * Movimiento a la espera de confirmación del usuario.
 *
 * `kind` distingue las ventanas que puede abrir un movimiento:
 *  - 'operators'    el modal que pide los operadores al pasar a En curso;
 *  - 'ready'        la confirmación de "Listo", que mueve inventario y además
 *                   firma la verificación si el pedido no la traía;
 *  - 'unprepare'    la confirmación de volver a En curso, solo cuando hay una
 *                   verificación que se va a perder.
 *
 * Sin `kind` el movimiento se aplica directo, sin ventana. Todas usan el mismo
 * campo pendingMove, así que autoRefreshTick() las respeta sin saber de esta
 * diferencia.
 */
interface PendingMove {
    order: ProductForSaleStoreOrder;
    from: BoardColumn;
    to: BoardColumn;
    fromIndex: number;
    toIndex: number;
    kind?: 'ready' | 'operators' | 'unprepare';
}

/** Una tarjeta del panel de productos: el detalle de un pedido abierto. */
interface ProductPanel {
    orderId: string;
    orderNumber?: number;
    orderName?: string;
    establishmentId?: string;
    establishmentName?: string;
    elements?: ProductForSaleStoreOrderElement[];
    /** Notas del pedido ya saneadas; cadena vacía si no tiene. */
    comment: string;
    loading: boolean;
    failed: boolean;
    /**
     * Cómo venían marcados los productos del servidor, por id de elemento. Los
     * clicks modifican `elements` y esto queda fijo hasta que se guarda, así que
     * la diferencia entre los dos es lo que hay sin guardar.
     *
     * Es un snapshot y no una bandera "sucio" a propósito: marcar y desmarcar un
     * producto vuelve a dejar el pedido como estaba, y ahí el botón de guardar
     * tiene que desaparecer igual que si nunca se hubiera tocado.
     */
    savedChecks: Map<number, boolean>;
    savingChecks: boolean;
}

/**
 * Tablero tipo Kanban de los pedidos de producto terminado en bodega.
 *
 *   Pendiente(11) -> En curso(12) <-> Preparado(64) -> Listo(13)
 *        ^______________|     |___________________________^
 *
 * Reglas:
 *  - En curso es obligatorio: desde el tablero no se salta de Pendiente a Listo.
 *    (La vista de detalle sí hace Pendiente -> Listo directo; es su flujo.)
 *  - Preparado no mueve inventario ni cambia el estado que ve la tienda, pero es
 *    el único lugar donde se firma la verificación, y sin firma no hay Listo
 *    (ver más abajo), así que en el tablero es un paso obligatorio.
 *  - Devolver a Pendiente: el permiso orders.release o ser el encargado.
 *  - Preparar, deshacer la preparación y marcar Listo: solo el encargado (o quien
 *    pueda pasar por encima).
 *  - Volver de Preparado a En curso conserva encargado y operadores —el pedido no
 *    vuelve al pool— pero borra la verificación: los productos se pueden editar
 *    En curso, así que una firma vieja certificaría otro pedido.
 *  - Marcar Listo es la única transición que mueve inventario, y la única que
 *    pide confirmación.
 *
 * Verificación: es una marca de control, NO una columna del tablero. Un pedido
 * puede estar Preparado y verificado o Preparado y sin verificar, y en las dos
 * situaciones vive en la misma columna. Se firma con el botón "Verificar" de una
 * tarjeta en Preparado, que pide la capacidad orders.verify.
 *
 * En el tablero la firma es REQUISITO para marcar Listo: un pedido sin verificar
 * no se puede soltar en esa columna. Es una regla solo de esta pantalla —la base
 * sigue firmando sola al cerrar el pedido y la vista de detalle mantiene su
 * flujo—, para que en bodega nadie cierre un pedido que nadie revisó. Como el
 * endpoint de verificación solo acepta pedidos Preparados, en la práctica esto
 * también convierte a Preparado en paso obligatorio dentro del tablero: el
 * camino corto En curso -> Listo queda sin forma de conseguir la firma.
 *
 * "En camino"(1) ya no se usa: el tablero dejó de tener esa columna y nadie
 * puede llevar un pedido ahí. El estado sigue existiendo y los pedidos que
 * quedaron en él se reciben o devuelven con normalidad desde la tienda.
 *
 * La validación real vive en la base (procedure v4 y guards de los UPDATE);
 * acá solo se deshabilita el arrastre para que la UI no ofrezca lo imposible.
 */
@Component({
    templateUrl: 'board-pfs-order.component.html',
    styleUrls: ['board-pfs-order.component.scss'],
    providers: [DatePipe]
})
export class BoardFinishedProductOrderComponent implements OnInit {

    columns: BoardColumn[] = [
        { statusId: pfsFactoryOrderStatusValues.pendiente.status.id, title: 'PENDIENTE',  color: '#5d6d7e', orders: [] },
        { statusId: pfsFactoryOrderStatusValues.en_curso.status.id,  title: 'EN CURSO',   color: '#17ad99', orders: [] },
        { statusId: pfsFactoryOrderStatusValues.preparado.status.id, title: 'PREPARADO',  color: '#9b59b6', orders: [] },
        { statusId: pfsFactoryOrderStatusValues.listo.status.id,     title: 'LISTO',      color: '#3498db', orders: [] },
    ];

    /** Ids de los cdkDropList, para conectarlos todos entre sí. */
    dropListIds = this.columns.map(c => 'board-col-' + c.statusId);

    loadingOrders = false;
    submitting = false;

    /**
     * Todos los pedidos del rango de fechas, sin filtrar. El buscador es local:
     * filtra sobre esta lista y reparte de nuevo, sin volver a consultar.
     */
    private allOrders: ProductForSaleStoreOrder[] = [];
    searchTerm = '';

    /** Movimiento esperando confirmación del usuario ("Listo" u operadores). */
    pendingMove?: PendingMove;

    /**
     * Catálogo de clientes marcados como Operador. Se pide una sola vez al
     * cargar el tablero y se cachea: es una lista corta y estable, y consultarla
     * en cada drop metería latencia justo en el gesto de arrastrar.
     */
    operatorCustomers: OperatorCustomer[] = [];
    loadingOperatorCustomers = false;

    /**
     * Pedido que se está verificando con el botón "Verificar", fuera de todo
     * movimiento. Va aparte de pendingMove porque no hay tarjeta que mover ni
     * nada que revertir: solo se firma el pedido donde está.
     */
    verifyingOrder?: ProductForSaleStoreOrder;

    /**
     * Pedidos abiertos en el panel de productos. Se acumulan: cada click en una
     * tarjeta suma una en vez de reemplazar la anterior, que es el punto de
     * tener un panel y no un modal —bodega prepara varios pedidos a la vez y
     * necesita las listas juntas a la vista—.
     */
    productPanels: ProductPanel[] = [];

    /**
     * Clave con la que app-auto-refresh recuerda la preferencia de recarga. Es
     * propia del tablero: tenerlo refrescando cada minuto no significa querer lo
     * mismo en la vista de pedidos preparados.
     */
    readonly autoRefreshStorageKey = 'board_pfs_auto_refresh';

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
        private datePipe: DatePipe,
        private router: Router
    ) {}

    ngOnInit() {
        const today = new Date();
        const start = new Date();
        start.setDate(today.getDate() - 15);
        this.appliedStartDate = start;
        this.appliedEndDate = today;
        this.selectedDateRange = new DateRange<Date>(start, today);

        this.retrieveOrders();
        this.retrieveOperatorCustomers();
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
                    this.allOrders = this.dataService.findJsonValue(result, 'json_result') || [];
                    this.distribute();
                },
                error: (e) => {
                    console.error('Error al cargar los pedidos del tablero', e);
                    this.alertService.error('Error al cargar los pedidos');
                },
                complete: () => { this.loadingOrders = false; }
            });
    }

    /**
     * El catálogo del modal de operadores. Un fallo acá no bloquea el tablero:
     * el modal se abre igual y quedan los operadores manuales, que es mejor que
     * impedir tomar el pedido.
     */
    private retrieveOperatorCustomers() {
        this.loadingOperatorCustomers = true;
        this.dataService.getOperatorCustomers()
            .pipe(first())
            .subscribe({
                next: (result: any) => {
                    this.operatorCustomers = this.dataService.findJsonValue(result, 'json_result') || [];
                },
                error: (e) => {
                    console.error('Error al cargar los operadores', e);
                    this.operatorCustomers = [];
                },
                complete: () => { this.loadingOperatorCustomers = false; }
            });
    }

    /**
     * Reparte los pedidos en los 4 listados; el resto de estados no se muestra.
     * Aplica también el buscador, así que se llama tanto al cargar como al escribir.
     */
    private distribute() {
        this.columns.forEach(col => col.orders = []);
        this.allOrders.forEach(order => {
            if (!this.matchesSearch(order)) return;
            const column = this.columns.find(c => c.statusId === order.factoryStatus?.id);
            if (column) column.orders.push(order);
        });
    }

    // ── Recarga automática ───────────────────────────────────────────────────

    /**
     * Vencimiento del intervalo de app-auto-refresh. El componente solo avisa; si
     * se recarga o no lo decide el tablero.
     *
     * Recarga con spinner, la misma del filtro de fechas: que se note que el
     * tablero se está actualizando. Se saltea el turno si hay algo a medio
     * hacer: con el diálogo de confirmación abierto o un movimiento en vuelo,
     * refrescar cambiaría los datos debajo de una decisión ya tomada. El
     * siguiente turno llega igual.
     */
    autoRefreshTick() {
        if (this.submitting || this.pendingMove || this.verifyingOrder || this.loadingOrders) return;
        this.retrieveOrders();
    }

    // ── Buscador ─────────────────────────────────────────────────────────────

    /**
     * Minúsculas y sin tildes, para que "peten" encuentre a "Petén".
     * NFD separa la letra de su tilde y el reemplazo borra la tilde suelta.
     */
    private normalize(value?: string): string {
        return (value ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    }

    private matchesSearch(order: ProductForSaleStoreOrder): boolean {
        const term = this.normalize(this.searchTerm).trim();
        if (!term) return true;
        // El "#" se descarta para que "#12" y "12" busquen lo mismo. Si el término
        // era solo "#" no queda nada que buscar y no debe devolver todo el tablero.
        const numberTerm = term.replace('#', '');
        return this.normalize(order.name).includes(term)
            || this.normalize(order.establishment?.name).includes(term)
            || (!!numberTerm && String(order.orderNumber ?? '').includes(numberTerm));
    }

    onSearchChange() {
        this.distribute();
    }

    clearSearch() {
        if (!this.searchTerm) return;
        this.searchTerm = '';
        this.distribute();
    }

    /** El tablero quedó vacío por el buscador, no por falta de pedidos. */
    get noSearchResults(): boolean {
        return !!this.searchTerm.trim()
            && this.allOrders.length > 0
            && this.columns.every(col => !col.orders.length);
    }

    // ── Reglas de transición ─────────────────────────────────────────────────

    /** ¿El usuario actual es el encargado del pedido, o puede pasar por encima del encargado? */
    isOwner(order: ProductForSaleStoreOrder): boolean {
        if (this.accountService.can(CAPABILITIES.ordersBoardOverrideOwner)) return true;
        // Un pedido sin encargado (tomado antes del tablero) no bloquea a nadie.
        if (!order.assignedUser?.id) return true;
        return order.assignedUser.id === this.accountService.userValue.uuid;
    }

    /**
     * ¿Puede devolver el pedido de En curso a Pendiente? El permiso orders.release
     * —que el rol Sistema tiene siempre— o ser el encargado que lo tomó.
     *
     * A diferencia de isOwner, un pedido sin encargado NO queda abierto a todos:
     * devolver un pedido es la acción que se quiso restringir, y el tablero
     * siempre asigna encargado al pasar a En curso.
     */
    canRelease(order: ProductForSaleStoreOrder): boolean {
        if (this.accountService.can(CAPABILITIES.ordersRelease)) return true;
        return !!order.assignedUser?.id
            && order.assignedUser.id === this.accountService.userValue.uuid;
    }

    /** ¿El pedido ya tiene firma de verificación? */
    isVerified(order: ProductForSaleStoreOrder): boolean {
        return !!order.verifiedUser?.id;
    }

    /**
     * ¿Se le ofrece el botón "Verificar" a este pedido? Solo en Preparado, solo si
     * no está verificado todavía —la firma no se reemplaza— y solo a quien tenga
     * la capacidad orders.verify.
     *
     * Acá sí bloquea: en el tablero un pedido sin firma no pasa a Listo, así que
     * quien no tenga la capacidad necesita que otro lo verifique. La vista de
     * detalle sigue teniendo su propio camino.
     */
    canVerify(order: ProductForSaleStoreOrder): boolean {
        return order.factoryStatus?.id === pfsFactoryOrderStatusValues.preparado.status.id
            && !this.isVerified(order)
            && this.accountService.can(CAPABILITIES.ordersVerify);
    }

    isTransitionAllowed(order: ProductForSaleStoreOrder, targetStatusId: number): boolean {
        const from = order.factoryStatus?.id;
        if (from === undefined || from === targetStatusId) return false;

        const S = pfsFactoryOrderStatusValues;

        // Pendiente -> En curso: cualquiera de bodega.
        if (from === S.pendiente.status.id && targetStatusId === S.en_curso.status.id) return true;

        // En curso -> Pendiente: devolver el pedido, restringido por permiso.
        if (from === S.en_curso.status.id && targetStatusId === S.pendiente.status.id) {
            return this.canRelease(order);
        }

        // En curso -> Preparado (paso opcional) y En curso -> Listo (camino
        // corto): solo el encargado. Es la misma regla que validan el procedure y
        // el guard del UPDATE, así que aflojarla acá solo daría un error del
        // servidor.
        if (from === S.en_curso.status.id &&
            (targetStatusId === S.preparado.status.id || targetStatusId === S.listo.status.id)) {
            return this.isOwner(order);
        }

        // Preparado -> Listo: misma regla.
        if (from === S.preparado.status.id && targetStatusId === S.listo.status.id) {
            return this.isOwner(order);
        }

        // Preparado -> En curso: deshacer el paso para corregir el pedido. Es el
        // reverso de prepararlo, así que lleva su misma regla —el encargado— y no
        // la de liberar: el pedido no vuelve al pool, se queda con quien lo tiene.
        if (from === S.preparado.status.id && targetStatusId === S.en_curso.status.id) {
            return this.isOwner(order);
        }

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

        // Listo exige verificación previa. Se comprueba acá y no en
        // isTransitionAllowed a propósito: así la tarjeta sigue pudiendo entrar a
        // la columna y el usuario recibe el motivo, en vez de un arrastre que no
        // hace nada. Nada que revertir todavía —el traslado aún no ocurrió—.
        if (to.statusId === pfsFactoryOrderStatusValues.listo.status.id && !this.isVerified(order)) {
            this.alertService.warn('El pedido debe estar verificado antes de marcarlo como listo');
            return;
        }

        // Movimiento optimista: la tarjeta se queda donde la soltaron mientras
        // responde la API. Si algo falla, revertMove() la devuelve.
        transferArrayItem(from.orders, to.orders, event.previousIndex, event.currentIndex);

        const move: PendingMove = {
            order, from, to,
            fromIndex: event.previousIndex,
            toIndex: event.currentIndex,
            kind: this.windowFor(order, from, to)
        };

        if (move.kind) {
            this.pendingMove = move;
            return;
        }

        this.applyMove(move);
    }

    /**
     * Qué ventana abre este movimiento antes de aplicarse, o undefined si va
     * directo. Solo se interrumpe al usuario cuando hace falta pedirle algo o
     * cuando la acción pierde información que no se recupera sola.
     */
    private windowFor(order: ProductForSaleStoreOrder, from: BoardColumn, to: BoardColumn): PendingMove['kind'] {
        const S = pfsFactoryOrderStatusValues;

        if (to.statusId === S.en_curso.status.id) {
            // Tomar el pedido es la única puerta por la que se registran los
            // operadores: la vista de detalle va de Pendiente a Listo directo.
            if (from.statusId === S.pendiente.status.id) return 'operators';

            // Volver de Preparado no los vuelve a pedir —el pedido nunca los
            // soltó—, pero sí avisa cuando hay una verificación que se pierde.
            return this.isVerified(order) ? 'unprepare' : undefined;
        }

        // Listo descuenta producto terminado de bodega, así que siempre se
        // confirma. Acá el pedido ya viene verificado: drop() no deja llegar de
        // otra forma.
        if (to.statusId === S.listo.status.id) return 'ready';

        return undefined;
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

    // ── Modal de operadores ──────────────────────────────────────────────────

    /** ¿Está abierto el modal de operadores? Lo decide el movimiento pendiente. */
    get operatorsDialogOpen(): boolean {
        return this.pendingMove?.kind === 'operators';
    }

    /** ¿Está abierta la confirmación de "Listo"? */
    get readyDialogOpen(): boolean {
        return this.pendingMove?.kind === 'ready';
    }

    /** ¿Está abierta la confirmación de volver a En curso? Solo si hay firma que perder. */
    get unprepareDialogOpen(): boolean {
        return this.pendingMove?.kind === 'unprepare';
    }

    get pendingOrderName(): string {
        return this.pendingMove?.order.name ?? '';
    }

    /**
     * Un pedido que ya venía con operadores —se tomó, se liberó y se vuelve a
     * tomar— no debería existir: liberar los borra. Se rehidratan igual por si
     * la columna quedó escrita por otra vía.
     */
    get pendingOperators(): string[] {
        return parseOperators(this.pendingMove?.order.operators);
    }

    /** Confirmar con la lista vacía está permitido: la columna queda en NULL. */
    onOperatorsConfirmed(names: string[]) {
        if (!this.pendingMove) return;
        const move = this.pendingMove;
        this.pendingMove = undefined;
        this.applyMove(move, serializeOperators(names));
    }

    onOperatorsCancelled() {
        this.cancelPendingMove();
    }

    // ── Modal de verificación ────────────────────────────────────────────────

    /** ¿Está abierta la confirmación del botón "Verificar"? */
    get verifyDialogOpen(): boolean {
        return !!this.verifyingOrder;
    }

    /**
     * Abre la confirmación para un pedido Preparado, sin moverlo. El click no debe
     * llegar a la tarjeta, que abriría además sus productos.
     */
    openVerifyDialog(order: ProductForSaleStoreOrder, event: Event) {
        event.stopPropagation();
        if (!order.id || !this.canVerify(order)) return;
        this.verifyingOrder = order;
    }

    /** Firma el pedido a nombre del usuario actual, sin sacarlo de Preparado. */
    confirmVerify() {
        const order = this.verifyingOrder;
        if (!order?.id) return;
        this.verifyingOrder = undefined;

        this.submitting = true;
        this.dataService.verifyPreparedProductForSaleOrder(order.id)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Pedido verificado');
                    // Silenciosa, como en applyMove: el UPDATE trae guards por
                    // estado y por firma previa, así que si no cambió nada el
                    // tablero se corrige solo con los datos del servidor.
                    this.retrieveOrders(true);
                },
                error: (error) => {
                    this.alertService.error(
                        this.dataService.getErrorMessageResponse(error, 'No se pudo verificar el pedido')
                    );
                }
            }).add(() => { this.submitting = false; });
    }

    cancelVerify() {
        this.verifyingOrder = undefined;
    }

    private applyMove(move: PendingMove, operators = '') {
        const S = pfsFactoryOrderStatusValues;
        const orderId = move.order.id!;
        let request;
        let successMessage: string;

        if (move.to.statusId === S.en_curso.status.id) {
            // A En curso se llega por dos caminos opuestos: tomando el pedido desde
            // Pendiente o deshaciendo su preparación. Son endpoints distintos, así
            // que acá no alcanza con mirar el destino.
            if (move.from.statusId === S.preparado.status.id) {
                request = this.dataService.unprepareProductForSaleOrder(orderId);
                successMessage = 'Pedido devuelto a En curso';
            } else {
                request = this.dataService.startProductForSaleOrder(orderId, operators);
                successMessage = 'Pedido tomado';
            }
        } else if (move.to.statusId === S.pendiente.status.id) {
            request = this.dataService.releaseProductForSaleOrder(orderId);
            successMessage = 'Pedido liberado';
        } else if (move.to.statusId === S.preparado.status.id) {
            request = this.dataService.prepareProductForSaleOrder(orderId);
            successMessage = 'Pedido marcado como preparado';
        } else if (move.to.statusId === S.listo.status.id) {
            // El pedido llega siempre firmado —drop() lo exige— y la base conserva
            // la firma que ya traía.
            request = this.dataService.manageProductForSaleOrderStateReady(orderId);
            successMessage = 'Pedido marcado como listo';
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

    // ── Panel de productos ───────────────────────────────────────────────────

    /**
     * Un arrastre termina en un `click` sobre la tarjeta, así que sin esto mover
     * un pedido de columna abriría además sus productos. El CDK emite
     * cdkDragEnded en el mouseup, antes de que el navegador despache el click;
     * el setTimeout deja la bandera puesta durante ese click y la limpia después.
     */
    private dragJustEnded = false;

    onDragStarted() {
        this.dragJustEnded = true;
    }

    onDragEnded() {
        setTimeout(() => { this.dragJustEnded = false; });
    }

    onCardClick(order: ProductForSaleStoreOrder) {
        if (this.dragJustEnded) return;
        this.openProducts(order);
    }

    /**
     * Abre el detalle de un pedido en el panel de productos. Las tarjetas se
     * acumulan: bodega prepara varios pedidos a la vez y necesita las listas
     * juntas a la vista, que es justo lo que un modal no permite.
     *
     * Siempre se consulta al servidor, sin caché: los productos de un pedido se
     * pueden editar mientras esté en Pendiente o En curso
     * (update_product_for_sale_order_with_elements valida factory_status_id in
     * (11, 12)). Cachear haría que bodega prepare un pedido con la lista vieja.
     * Por eso volver a tocar un pedido ya abierto lo recarga en su lugar en vez
     * de duplicar la tarjeta. La única excepción son las marcas sin guardar: ahí
     * la recarga se cancela, porque las pisaría.
     */
    openProducts(order: ProductForSaleStoreOrder) {
        if (!order.id) return;

        const existing = this.productPanels.findIndex(p => p.orderId === order.id);

        // Volver a tocar la tarjeta recarga el pedido, y eso pisaría los productos
        // que se marcaron y todavía no se guardaron. Se avisa y no se hace nada:
        // recargar es un efecto secundario del click, perder el trabajo no.
        if (existing >= 0 && this.hasCheckChanges(this.productPanels[existing])) {
            this.alertService.warn('Guarda los productos marcados antes de recargar el pedido');
            return;
        }

        const panel: ProductPanel = {
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderName: order.name,
            establishmentId: order.establishment?.id ?? order.establishmentID,
            establishmentName: order.establishment?.name,
            elements: undefined,
            // El comentario de la tarjeta sirve mientras carga, pero puede tener
            // hasta un intervalo de autorefresh de antigüedad: manda el del servidor.
            comment: this.cleanComment(order.comment),
            loading: true,
            failed: false,
            savedChecks: new Map<number, boolean>(),
            savingChecks: false
        };

        // Las nuevas van arriba: es lo último que se pidió y lo que se está por leer.
        if (existing >= 0) this.productPanels[existing] = panel;
        else this.productPanels.unshift(panel);

        this.dataService.getProductForSaleOrderElementsById(order.id)
            .pipe(first())
            .subscribe({
                next: (response: any) => {
                    const detail = this.dataService.findJsonValue(response, 'json_result') || {};
                    panel.elements = detail.productForSaleStoreOrderElements || [];
                    panel.comment = this.cleanComment(detail.comment);
                    this.snapshotChecks(panel);
                },
                error: () => {
                    panel.failed = true;
                    panel.elements = [];
                    this.alertService.error('Error al cargar los productos del pedido');
                },
                complete: () => { panel.loading = false; }
            });
    }

    /**
     * La pantalla de creación guarda '--' cuando las notas se dejan en blanco,
     * así que ese valor cuenta como "sin notas" y no se pinta.
     */
    private cleanComment(comment?: string): string {
        const clean = comment?.trim();
        return !clean || clean === '--' ? '' : clean;
    }

    /**
     * Cierre pendiente de confirmar porque hay productos marcados sin guardar.
     * `orderId` undefined significa "cerrar todos".
     */
    pendingDiscard?: { orderId?: string };

    closePanel(orderId: string) {
        const panel = this.productPanels.find(p => p.orderId === orderId);
        if (panel && this.hasCheckChanges(panel)) {
            this.pendingDiscard = { orderId };
            return;
        }
        this.removePanel(orderId);
    }

    clearPanels() {
        if (this.productPanels.some(p => this.hasCheckChanges(p))) {
            this.pendingDiscard = {};
            return;
        }
        this.productPanels = [];
    }

    private removePanel(orderId: string) {
        this.productPanels = this.productPanels.filter(p => p.orderId !== orderId);
    }

    confirmDiscard() {
        if (!this.pendingDiscard) return;
        const orderId = this.pendingDiscard.orderId;
        this.pendingDiscard = undefined;
        if (orderId) this.removePanel(orderId);
        else this.productPanels = [];
    }

    cancelDiscard() {
        this.pendingDiscard = undefined;
    }

    /** ¿El pedido ya está abierto en el panel? Marca la tarjeta del tablero. */
    isPanelOpen(order: ProductForSaleStoreOrder): boolean {
        return this.productPanels.some(p => p.orderId === order.id);
    }

    trackByPanel(_index: number, panel: ProductPanel) {
        return panel.orderId;
    }

    // ── Productos marcados ───────────────────────────────────────────────────
    //
    // Bodega va tildando lo que ya alistó, para no perder la cuenta en pedidos
    // largos. Es una ayuda de control y NADA más: no es un estado del pedido, no
    // condiciona ninguna transición del tablero y no mueve inventario. Un pedido
    // se puede marcar como Listo con cero productos tildados.
    //
    // Los clicks son locales y la tanda entera se guarda con un botón. Es lo que
    // evita una llamada por click: un pedido de 20 productos son 20 clicks y una
    // sola llamada.
    //
    // Ver src/database/migrations/2026-08-30-check-productos-pedido.sql

    /**
     * El pedido del tablero al que corresponde el panel. Se busca en allOrders en
     * vez de copiar el estado dentro del panel: así el autorefresh lo mantiene al
     * día solo, y un pedido que se movió a Listo deja de aceptar marcas sin que
     * haya que tocar nada acá.
     */
    private orderOf(panel: ProductPanel): ProductForSaleStoreOrder | undefined {
        return this.allOrders.find(o => o.id === panel.orderId);
    }

    /**
     * ¿Se pueden marcar los productos de este pedido? Solo En curso y Preparado,
     * que es cuando bodega lo está alistando. En Pendiente todavía no lo tomó
     * nadie —y es el estado donde el pedido se edita, lo que borra las marcas—; de
     * Listo en adelante ya salió de bodega.
     *
     * Es la misma regla que valida el WHERE del endpoint. Acá solo se esconde la
     * casilla para no ofrecer lo que la base va a ignorar.
     */
    canCheck(panel: ProductPanel): boolean {
        const statusId = this.orderOf(panel)?.factoryStatus?.id;
        return statusId === pfsFactoryOrderStatusValues.en_curso.status.id
            || statusId === pfsFactoryOrderStatusValues.preparado.status.id;
    }

    /** Congela cómo vinieron las marcas del servidor; contra esto se compara después. */
    private snapshotChecks(panel: ProductPanel) {
        panel.savedChecks = new Map<number, boolean>(
            (panel.elements ?? [])
                .filter(element => element.id != null)
                .map(element => [element.id!, !!element.isCheck] as [number, boolean])
        );
    }

    /** Los productos cuya marca difiere de la que trajo el servidor. */
    private changedChecks(panel: ProductPanel): ProductForSaleStoreOrderElement[] {
        return (panel.elements ?? []).filter(element =>
            element.id != null && !!element.isCheck !== !!panel.savedChecks.get(element.id)
        );
    }

    /** ¿Hay marcas sin guardar? Es lo que decide si se muestra el botón. */
    hasCheckChanges(panel: ProductPanel): boolean {
        return this.changedChecks(panel).length > 0;
    }

    /** Cuántos productos van marcados. Alimenta el contador del encabezado. */
    checkedCount(panel: ProductPanel): number {
        return (panel.elements ?? []).filter(element => element.isCheck).length;
    }

    /**
     * ¿La tabla lleva columna de casillas? Es una decisión del pedido entero y no
     * de cada fila: quitarla fila por fila dejaría las columnas corridas entre
     * unas y otras. Un pedido ya cerrado la conserva si tiene algo marcado, como
     * registro de lo que se revisó.
     */
    showCheckColumn(panel: ProductPanel): boolean {
        return this.canCheck(panel) || this.checkedCount(panel) > 0;
    }

    /** Sin id no hay a qué dirigir la marca; pasa con lecturas viejas cacheadas. */
    isCheckable(panel: ProductPanel, element: ProductForSaleStoreOrderElement): boolean {
        return this.canCheck(panel) && element.id != null && !panel.savingChecks;
    }

    toggleCheck(panel: ProductPanel, element: ProductForSaleStoreOrderElement) {
        if (!this.isCheckable(panel, element)) return;
        element.isCheck = !element.isCheck;
    }

    /**
     * Manda solo lo que cambió. El estado local NO se toca si falla: lo que el
     * usuario marcó sigue ahí y el botón sigue ofreciendo reintentar, que es mejor
     * que hacerle recorrer el pedido de nuevo.
     */
    saveChecks(panel: ProductPanel) {
        if (panel.savingChecks) return;

        const changed = this.changedChecks(panel);
        if (!changed.length) return;

        // El pedido pudo moverse desde la última recarga del tablero. La base
        // ignora la llamada igual —el guard por estado está en el WHERE—, pero sin
        // esto el usuario vería un "guardado" que no guardó nada.
        if (!this.canCheck(panel)) {
            this.alertService.warn('El pedido ya no está En curso ni Preparado: no se pueden guardar las marcas');
            return;
        }

        const payload = changed.map(element => ({ id: element.id!, is_check: !!element.isCheck }));

        panel.savingChecks = true;
        this.dataService.updateProductForSaleOrderElementsCheck(panel.orderId, payload)
            .pipe(first())
            .subscribe({
                next: () => {
                    changed.forEach(element => panel.savedChecks.set(element.id!, !!element.isCheck));
                    this.alertService.success('Pedido actualizado');
                },
                error: (error) => {
                    this.alertService.error(
                        this.dataService.getErrorMessageResponse(error, 'No se pudo actualizar el pedido')
                    );
                }
            }).add(() => { panel.savingChecks = false; });
    }

    /**
     * El tablero solo mueve pedidos; para editarlos está la vista completa, que
     * es la que tiene las validaciones por estado. `opt=factory` es lo que hace
     * que la vista trabaje contra factory_status_id (la secuencia de bodega) y
     * no contra la de tienda.
     */
    goToOrderDetail(panel: ProductPanel) {
        this.router.navigate(['/productsForSale/order/view/' + panel.orderId], {
            queryParams: {
                opt: 'factory',
                store: panel.establishmentId,
                name: panel.establishmentName
            }
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

    /**
     * Operadores del pedido para la tarjeta. Todos del mismo color: una vez
     * guardados no se distingue el que salió del catálogo del escrito a mano.
     */
    readonly operatorChipColor = OPERATOR_CHIP_COLOR;

    getOperators(order: ProductForSaleStoreOrder): string[] {
        return parseOperators(order.operators);
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
