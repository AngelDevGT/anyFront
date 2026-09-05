import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { first } from 'rxjs/operators';

import { AccountService, AlertService, CAPABILITIES, DataService } from '@app/services';
import { getStoreColor, OPERATOR_CHIP_COLOR, parseOperators } from '@app/helpers';
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { ProductForSaleStoreOrderElement } from '@app/models/product-for-sale/product-for-sale-store-order-element.model';

/**
 * Vista "Pedidos preparados" de bodega: todos los pedidos en Preparado(64), cada
 * uno con su lista de productos a la vista, en tarjetas que se acumulan a lo
 * largo de la página.
 *
 * POR QUÉ EXISTE, TENIENDO EL TABLERO
 * En el tablero un pedido Preparado es una tarjeta de tres líneas, y para ver lo
 * que lleva hay que abrirlo en el panel de la derecha, de a uno. Quien verifica
 * necesita lo contrario: todas las listas desplegadas al mismo tiempo, para
 * recorrer la mesa comparando contra la pantalla. Esta pantalla es esa vuelta:
 * misma tarjeta de productos del tablero, pero abierta sola y para todos.
 *
 * QUÉ NO HACE
 * No mueve pedidos. No hay arrastre y no se pasa a Listo ni se vuelve a En curso
 * —para eso está el tablero—. Lo único que escribe es la verificación y la
 * revisión de los productos.
 *
 * LA REVISIÓN DE PRODUCTOS
 * Es la SEGUNDA pasada de control, sobre prepared_check. El tablero marca
 * is_check mientras bodega alista; acá se marca mientras alguien revisa contra la
 * mesa. Son columnas distintas: heredar los tildes del tablero haría que la
 * revisión arranque con todo marcado por otra persona, que es justo lo que una
 * revisión no puede hacer. El contador arranca en 0/N aunque bodega haya
 * alistado el pedido entero.
 * Ver src/database/migrations/2026-09-03-check-preparado-productos.sql
 *
 * LA LISTA SE MANTIENE SOLA
 * El endpoint filtra por estado, así que un pedido que alguien mueva a Listo (o
 * devuelva a En curso) desde el tablero desaparece en la siguiente recarga, sin
 * que haya nada que sincronizar acá. Verificar, en cambio, NO saca al pedido de
 * la lista: la firma no es un estado, el pedido sigue Preparado y la tarjeta se
 * queda con su sello.
 *
 * FILTROS
 * El buscador y el rango de fechas son los dos LOCALES: el endpoint trae todos
 * los pedidos preparados —son pocos, es un estado de paso— así que filtrar acá
 * sale gratis, se ve al instante y ampliar el rango no cuesta una consulta.
 */
@Component({
    templateUrl: 'prepared-pfs-order.component.html',
    styleUrls: ['prepared-pfs-order.component.scss']
})
export class PreparedFinishedProductOrderComponent implements OnInit {

    loadingOrders = false;
    submitting = false;

    /**
     * Todos los pedidos preparados, sin filtrar. El buscador es local: filtra
     * sobre esta lista y rearma `orders`, sin volver a consultar. La plantilla la
     * lee para el contador del encabezado, que cuenta lo que hay y no lo que dejó
     * ver la búsqueda.
     */
    allOrders: ProductForSaleStoreOrder[] = [];

    /** Lo que se pinta: `allOrders` pasado por el buscador y el filtro de fechas. */
    orders: ProductForSaleStoreOrder[] = [];

    searchTerm = '';

    /**
     * Filtro de rango de fechas, el mismo control del tablero: arranca en los
     * últimos 15 días y se cambia desde el panel del calendario.
     *
     * Filtra por fecha de PREPARADO, no de creación: es la que ordena la lista y
     * la única que le importa a esta pantalla. Un pedido creado la semana pasada
     * y preparado hoy es un pedido de hoy.
     *
     * OJO con el rango por defecto: un pedido preparado hace un mes y nunca
     * cerrado queda FUERA de la primera pantalla. Sigue estando —el endpoint trae
     * todos los preparados y el filtro es local— así que se ve con solo abrir el
     * calendario y ampliar el rango, sin volver a consultar.
     */
    appliedStartDate?: Date;
    appliedEndDate?: Date;
    maxDate = new Date();

    /** Días hacia atrás del rango de arranque, y los que repone el botón del panel. */
    readonly defaultRangeDays = 14;

    /** Clave propia: la preferencia de recarga no se comparte con el tablero. */
    readonly autoRefreshStorageKey = 'prepared_pfs_auto_refresh';

    /** Pedido que se está verificando. Es lo que abre la confirmación. */
    verifyingOrder?: ProductForSaleStoreOrder;

    private readonly avatarPalette = [
        '#4361ee', '#3a86ff', '#7b2d8b', '#2ec4b6',
        '#e76f51', '#06d6a0', '#f72585', '#4cc9f0'
    ];

    constructor(
        private dataService: DataService,
        private accountService: AccountService,
        private alertService: AlertService,
        private router: Router
    ) {}

    ngOnInit() {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - this.defaultRangeDays);
        this.appliedStartDate = start;
        this.appliedEndDate = end;

        this.retrieveOrders();
    }

    // ── Carga ────────────────────────────────────────────────────────────────

    /**
     * @param silent recarga sin spinner, para refrescar después de verificar sin
     *               que la pantalla parpadee.
     */
    retrieveOrders(silent = false) {
        if (!silent) this.loadingOrders = true;

        this.dataService.getPreparedProductForSaleOrders()
            .pipe(first())
            .subscribe({
                next: (result: any) => {
                    // Sin pedidos preparados json_agg devuelve NULL, no un arreglo.
                    this.allOrders = this.dataService.findJsonValue(result, 'json_result') || [];
                    this.snapshotPreparedChecks();
                    this.applyFilters();
                },
                error: (e) => {
                    console.error('Error al cargar los pedidos preparados', e);
                    this.alertService.error('Error al cargar los pedidos preparados');
                },
                complete: () => { this.loadingOrders = false; }
            });
    }

    /**
     * Recarga con spinner: que se note que la pantalla se está actualizando. Se
     * saltea el turno si hay algo a medio hacer —el modal abierto, una firma en
     * vuelo o una revisión sin guardar—, porque refrescar cambiaría los datos
     * debajo de una decisión ya tomada. Lo de la revisión es lo más literal:
     * recargar reemplaza `allOrders` entero y se llevaría los tildes puestos. El
     * siguiente turno llega igual.
     */
    autoRefreshTick() {
        if (this.submitting || this.verifyingOrder || this.loadingOrders) return;
        if (this.allOrders.some(order => this.hasPreparedChanges(order))) return;
        this.retrieveOrders();
    }

    // ── Filtros ──────────────────────────────────────────────────────────────
    //
    // Los dos son LOCALES, al revés que en el tablero, que manda su rango de
    // fechas al servidor. Acá el endpoint ya trae todos los pedidos preparados
    // —son pocos por definición— así que filtrar en el front sale gratis, se ve
    // al instante y los dos filtros se componen sin pensar en cómo se combinan
    // del lado de la base.

    /**
     * Minúsculas y sin tildes, para que "peten" encuentre a "Petén".
     * NFD separa la letra de su tilde y el reemplazo borra la tilde suelta.
     */
    private normalize(value?: string): string {
        return (value ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    }

    /**
     * Busca por tienda, que es como se agrupa el trabajo en la mesa de bodega.
     * El nombre y el número del pedido entran también: no cuestan nada y evitan
     * tener que recordar de qué tienda era el #48 que alguien está preguntando.
     */
    private matchesSearch(order: ProductForSaleStoreOrder): boolean {
        const term = this.normalize(this.searchTerm).trim();
        if (!term) return true;
        // El "#" se descarta para que "#12" y "12" busquen lo mismo. Si el término
        // era solo "#" no queda nada que buscar y no debe devolver todo.
        const numberTerm = term.replace('#', '');
        return this.normalize(order.establishment?.name).includes(term)
            || this.normalize(order.name).includes(term)
            || (!!numberTerm && String(order.orderNumber ?? '').includes(numberTerm));
    }

    /**
     * ¿El pedido cae en el rango elegido? Se compara contra el DÍA local del
     * usuario: quien elige "1 de septiembre" quiere su 1 de septiembre, no el del
     * UTC en el que la base guarda las fechas.
     *
     * Un pedido sin fecha de preparado no entra en ningún rango. No debería
     * existir —prepare_product_for_sale_order la escribe siempre— pero si alguno
     * quedó así, con el filtro puesto no se puede afirmar que corresponda, y con
     * el filtro quitado se ve igual.
     */
    private matchesDateRange(order: ProductForSaleStoreOrder): boolean {
        if (!this.appliedStartDate || !this.appliedEndDate) return true;

        const prepared = this.parseUtcDate(order.preparedDate);
        if (!prepared) return false;

        const from = new Date(this.appliedStartDate);
        from.setHours(0, 0, 0, 0);
        const to = new Date(this.appliedEndDate);
        to.setHours(23, 59, 59, 999);

        return prepared >= from && prepared <= to;
    }

    private applyFilters() {
        this.orders = this.allOrders.filter(order =>
            this.matchesSearch(order) && this.matchesDateRange(order));
    }

    onSearchChange() {
        this.applyFilters();
    }

    clearSearch() {
        if (!this.searchTerm) return;
        this.searchTerm = '';
        this.applyFilters();
    }

    /**
     * El rango nuevo se aplica en local, sin volver a consultar: los pedidos ya
     * están todos acá. Es la diferencia con el tablero, donde "Buscar" sí dispara
     * una consulta porque su rango viaja al servidor.
     */
    onDateRangeApply(range: { start: Date, end: Date }) {
        this.appliedStartDate = range.start;
        this.appliedEndDate = range.end;
        this.applyFilters();
    }

    /**
     * La pantalla quedó vacía por los filtros, no por falta de pedidos
     * preparados. Distinguirlo importa: con el rango por defecto puesto, "no hay
     * nada" y "no hay nada de los últimos 15 días" se ven igual, y solo el
     * segundo se arregla ampliando el rango.
     */
    get noResults(): boolean {
        return this.allOrders.length > 0 && !this.orders.length;
    }

    // ── Verificación ─────────────────────────────────────────────────────────

    /** ¿El pedido ya tiene firma de verificación? */
    isVerified(order: ProductForSaleStoreOrder): boolean {
        return !!order.verifiedUser?.id;
    }

    /**
     * ¿Se le ofrece el botón "Verificar" a este pedido? Solo si no está verificado
     * todavía —la firma no se reemplaza— y solo a quien tenga la capacidad
     * orders.verify. El estado no se mira: el endpoint solo trae Preparados.
     *
     * Sin la capacidad la pantalla se ve igual, en modo lectura: sirve para
     * recorrer los pedidos aunque no se pueda firmarlos.
     */
    canVerify(order: ProductForSaleStoreOrder): boolean {
        return !this.isVerified(order) && this.accountService.can(CAPABILITIES.ordersVerify);
    }

    get verifyDialogOpen(): boolean {
        return !!this.verifyingOrder;
    }

    openVerifyDialog(order: ProductForSaleStoreOrder) {
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
                    // Recarga silenciosa: el UPDATE trae guards por estado y por
                    // firma previa, así que si no cambió nada (alguien se
                    // adelantó) la pantalla se corrige sola con los datos reales
                    // del servidor.
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

    // ── Productos ────────────────────────────────────────────────────────────
    //
    // La SEGUNDA pasada de control. El tablero marca is_check mientras bodega
    // alista; acá se marca prepared_check mientras alguien revisa contra la mesa,
    // antes de cerrar el pedido.
    //
    // Son columnas distintas a propósito: si esta pantalla heredara los tildes
    // del tablero, la revisión arrancaría con todo marcado por otra persona, que
    // es justo lo que una revisión no puede hacer. Por eso el contador de acá
    // arranca en 0/N aunque bodega haya alistado el pedido entero.
    //
    // Los clicks son locales y la tanda se guarda con un botón, igual que en el
    // tablero: un pedido de 20 productos son 20 clicks y una sola llamada.

    /**
     * Cómo venían las marcas de revisión del servidor, por pedido y por elemento.
     * La diferencia contra lo que hay en pantalla es lo que falta guardar.
     *
     * Vive en un Map aparte y no dentro del pedido porque `allOrders` se
     * reemplaza entero en cada recarga; las entradas de pedidos que ya no están
     * quedan huérfanas y no molestan a nadie.
     */
    private savedPreparedChecks = new Map<string, Map<number, boolean>>();

    /** Pedidos con un guardado en vuelo. */
    private savingPrepared = new Set<string>();

    /** Congela cómo vinieron las marcas; contra esto se compara después. */
    private snapshotPreparedChecks() {
        this.savedPreparedChecks = new Map(
            this.allOrders
                .filter(order => !!order.id)
                .map(order => [
                    order.id!,
                    new Map((order.productForSaleStoreOrderElements ?? [])
                        .filter(element => element.id != null)
                        .map(element => [element.id!, !!element.preparedCheck] as [number, boolean]))
                ] as [string, Map<number, boolean>])
        );
    }

    /** Los productos cuya marca de revisión difiere de la que trajo el servidor. */
    private changedPreparedChecks(order: ProductForSaleStoreOrder) {
        const saved = this.savedPreparedChecks.get(order.id ?? '');
        return (order.productForSaleStoreOrderElements ?? []).filter(element =>
            element.id != null && !!element.preparedCheck !== !!saved?.get(element.id)
        );
    }

    /** ¿Hay marcas sin guardar? Es lo que decide si se muestra el botón. */
    hasPreparedChanges(order: ProductForSaleStoreOrder): boolean {
        return this.changedPreparedChecks(order).length > 0;
    }

    isSavingPrepared(order: ProductForSaleStoreOrder): boolean {
        return this.savingPrepared.has(order.id ?? '');
    }

    /** Sin id no hay a qué dirigir la marca; pasa con lecturas viejas cacheadas. */
    isCheckable(order: ProductForSaleStoreOrder, element: ProductForSaleStoreOrderElement): boolean {
        return element.id != null && !this.isSavingPrepared(order);
    }

    togglePreparedCheck(order: ProductForSaleStoreOrder, element: ProductForSaleStoreOrderElement) {
        if (!this.isCheckable(order, element)) return;
        element.preparedCheck = !element.preparedCheck;
    }

    /**
     * Manda solo lo que cambió. El estado local NO se toca si falla: lo que se
     * marcó sigue en pantalla y el botón sigue ofreciendo reintentar, que es mejor
     * que hacer recorrer el pedido de nuevo.
     */
    savePreparedChecks(order: ProductForSaleStoreOrder) {
        const orderId = order.id;
        if (!orderId || this.savingPrepared.has(orderId)) return;

        const changed = this.changedPreparedChecks(order);
        if (!changed.length) return;

        const payload = changed.map(element => ({ id: element.id!, prepared_check: !!element.preparedCheck }));

        this.savingPrepared.add(orderId);
        this.dataService.updateProductForSaleOrderElementsPreparedCheck(orderId, payload)
            .pipe(first())
            .subscribe({
                next: () => {
                    const saved = this.savedPreparedChecks.get(orderId);
                    changed.forEach(element => saved?.set(element.id!, !!element.preparedCheck));
                    this.alertService.success('Revisión guardada');
                },
                error: (error) => {
                    this.alertService.error(
                        this.dataService.getErrorMessageResponse(error, 'No se pudo guardar la revisión')
                    );
                }
            }).add(() => { this.savingPrepared.delete(orderId); });
    }

    /** Cuántos productos van revisados. Alimenta el contador del encabezado. */
    checkedCount(order: ProductForSaleStoreOrder): number {
        return (order.productForSaleStoreOrderElements ?? []).filter(element => element.preparedCheck).length;
    }

    elementCount(order: ProductForSaleStoreOrder): number {
        return (order.productForSaleStoreOrderElements ?? []).length;
    }

    /**
     * La pantalla de creación guarda '--' cuando las notas se dejan en blanco,
     * así que ese valor cuenta como "sin notas" y no se pinta.
     */
    cleanComment(comment?: string): string {
        const clean = comment?.trim();
        return !clean || clean === '--' ? '' : clean;
    }

    /**
     * El detalle completo del pedido. `opt=factory` es lo que hace que la vista
     * trabaje contra factory_status_id (la secuencia de bodega) y no contra la de
     * tienda.
     */
    goToOrderDetail(order: ProductForSaleStoreOrder) {
        this.router.navigate(['/productsForSale/order/view/' + order.id], {
            queryParams: {
                opt: 'factory',
                store: order.establishment?.id ?? order.establishmentID,
                name: order.establishment?.name
            }
        });
    }

    // ── Presentación ─────────────────────────────────────────────────────────

    /**
     * Las fechas vienen en UTC y sin marcarlo: sin la 'Z' el navegador las leería
     * como hora local y el pedido aparecería corrido varias horas. Devuelve
     * undefined si no hay fecha o no se puede leer, que es lo que distingue "no
     * tiene" de "es inválida" en quien llama.
     */
    private parseUtcDate(utcTime?: string): Date | undefined {
        if (!utcTime) return undefined;
        let clean = utcTime.replaceAll('"', '');
        clean = clean.includes('Z') ? clean : clean + 'Z';
        const date = new Date(clean);
        return isNaN(date.getTime()) ? undefined : date;
    }

    /** Fecha corta para las tarjetas: DD/MM HH:mm. */
    formatShortDateTime(utcTime?: string): string {
        const date = this.parseUtcDate(utcTime);
        if (!date) return '';
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
     * Color de la cápsula de tienda. Vive en un helper compartido para que todas
     * las pantallas de pedidos pinten la misma tienda del mismo color.
     */
    getStoreColor(establishmentId?: string): string {
        return getStoreColor(establishmentId);
    }

    readonly operatorChipColor = OPERATOR_CHIP_COLOR;

    getOperators(order: ProductForSaleStoreOrder): string[] {
        return parseOperators(order.operators);
    }

    trackByOrderId(_index: number, order: ProductForSaleStoreOrder) {
        return order.id;
    }
}
