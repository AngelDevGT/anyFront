import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import {
    AccountService,
    AlertService,
    DataService,
    DateRangeState,
    DateRangeStateService,
    pfsStoreOrderStatusValues
} from '@app/services';
import { getStoreColorByIndex, getStoreTextColorByIndex } from '@app/helpers';
import { Establishment } from '@app/models/establishment.model';
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';

/**
 * Un estado de pedido tal como se muestra en la tarjeta. Los ids salen del catalogo compartido;
 * etiqueta, icono y color viven aca porque son decisiones de presentacion.
 *
 * "En camino" y "Devuelto" llevan iconos distintos a proposito: antes compartian `local_shipping`
 * y solo cambiaba el color, con lo que eran indistinguibles para quien no distingue rojo y amarillo.
 */
interface OrderStatusView {
    key: string;
    id: number;
    label: string;
    icon: string;
    color: string;
}

/** Un tramo de la barra de proporcion de la tarjeta. */
interface StoreCardSegment {
    key: string;
    label: string;
    color: string;
    count: number;
    percent: number;
}

interface StoreCard {
    id: string;
    name: string;
    color: string;
    /** Variante del color apta para texto, la que se usa en el nombre de la tienda. */
    textColor: string;
    total: number;
    /** Cantidad por `key` de OrderStatusView. */
    counts: { [key: string]: number };
    /** Pedidos en un estado fuera del catalogo; se muestran solo si existen, para que el total cuadre. */
    otherCount: number;
    segments: StoreCardSegment[];
    /** `conic-gradient` ya armado con el reparto por estado; es la gráfica de pie. */
    pieGradient: string;
    /** Resumen en texto del reparto, para el tooltip de la gráfica. */
    pieTitle: string;
    lastMovementLabel?: string;
    lastMovementTime: number;
}

@Component({
    templateUrl: 'dashboard-pfs-order.component.html',
    styleUrls: ['dashboard-pfs-order.component.scss'],
    providers: [DatePipe]
})
export class DashboardFinishedProductOrderComponent implements OnInit {

    /** Orden de aparicion en la tarjeta y en el resumen global. */
    readonly statusViews: OrderStatusView[] = [
        { key: 'pendiente', id: pfsStoreOrderStatusValues.pendiente.status.id, label: 'Pendiente', icon: 'schedule',       color: '#64748b' },
        { key: 'en_camino', id: pfsStoreOrderStatusValues.en_camino.status.id, label: 'En camino', icon: 'local_shipping', color: '#d97706' },
        { key: 'listo',     id: pfsStoreOrderStatusValues.listo.status.id,     label: 'Listo',     icon: 'inventory_2',    color: '#2563eb' },
        { key: 'recibido',  id: pfsStoreOrderStatusValues.recibido.status.id,  label: 'Recibido',  icon: 'task_alt',       color: '#059669' },
        { key: 'devuelto',  id: pfsStoreOrderStatusValues.devuelto.status.id,  label: 'Devuelto',  icon: 'undo',           color: '#dc2626' },
    ];

    cards: StoreCard[] = [];
    visibleCards: StoreCard[] = [];
    totals: { [key: string]: number } = {};
    totalOrders = 0;

    loadingOrders = false;
    /** Placeholders del esqueleto de carga. */
    readonly skeletons = [1, 2, 3, 4];

    searchTerm = '';

    maxDate = new Date();
    appliedStartDate?: Date;
    appliedEndDate?: Date;
    private dateRange!: DateRangeState;

    private readOnly = false;
    private ordersRoute = '/consultas/pedidos';

    constructor(
        private readonly dataService: DataService,
        private readonly accountService: AccountService,
        private readonly alertService: AlertService,
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly datePipe: DatePipe,
        private readonly dateRangeState: DateRangeStateService
    ) {}

    ngOnInit() {
        this.readOnly = !!this.route.snapshot.data['readOnly'];
        this.ordersRoute = this.readOnly ? '/consultas/pedidos' : '/productsForSale/order';

        // Rango guardado en la pestaña o, si no hay, los últimos 15 días desde la fecha actual
        this.dateRange = this.dateRangeState.createRange(14);
        this.appliedStartDate = this.dateRange.start;
        this.appliedEndDate = this.dateRange.end;

        this.retrieveOrders();
    }

    get dateRangeLabel(): string {
        if (!this.appliedStartDate || !this.appliedEndDate) return '';
        return `${this.appliedStartDate.toLocaleDateString('es-GT')} - ${this.appliedEndDate.toLocaleDateString('es-GT')}`;
    }

    get hasStores(): boolean {
        return this.cards.length > 0;
    }

    onRangeApply(range: { start: Date, end: Date }) {
        this.appliedStartDate = range.start;
        this.appliedEndDate = range.end;
        this.dateRange.apply(range.start, range.end);
        this.retrieveOrders();
    }

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

    retrieveOrders() {
        this.loadingOrders = true;

        forkJoin([
            this.dataService.getAllProductForSaleOrderByFilter(this.buildOrderParams()),
            this.dataService.getAllEstablishmentsByFilter({ status_id: 28 })
        ]).subscribe({
            next: (result: any) => {
                const orders: ProductForSaleStoreOrder[] = this.dataService.findJsonValue(result[0], 'json_result') || [];
                const establishments: Establishment[] = this.dataService.findJsonValue(result[1], 'json_result') || [];
                // Solo las tiendas asignadas al usuario, la misma regla que aplica el selector de tienda
                this.buildCards(this.accountService.filterAssignedEstablishments(establishments), orders);
                this.loadingOrders = false;
            },
            // Sin este else el spinner se quedaba girando para siempre: `complete` no corre tras un error
            error: (e) => {
                console.error('Se ha producido un error al consultar los pedidos', e);
                this.alertService.error('No se pudieron cargar los pedidos. Intenta de nuevo.');
                this.cards = [];
                this.visibleCards = [];
                this.loadingOrders = false;
            }
        });
    }

    /**
     * Arma las tarjetas en una sola pasada sobre los pedidos. Antes se recorrian todos los pedidos
     * una vez por tienda; con un indice por establecimiento alcanza con recorrerlos una vez.
     */
    private buildCards(establishments: Establishment[], orders: ProductForSaleStoreOrder[]) {
        const statusByStoreId = new Map<number, OrderStatusView>();
        this.statusViews.forEach(status => statusByStoreId.set(status.id, status));

        const cardsById = new Map<string, StoreCard>();
        establishments.forEach(establishment => {
            if (!establishment.id) return;
            cardsById.set(establishment.id, {
                id: establishment.id,
                name: establishment.name || 'Sin nombre',
                // Los colores se asignan por posición al final, en `applyFilters`
                color: '',
                textColor: '',
                total: 0,
                counts: {},
                otherCount: 0,
                segments: [],
                pieGradient: '',
                pieTitle: '',
                lastMovementTime: 0
            });
        });

        const eliminadoId = pfsStoreOrderStatusValues.eliminado.status.id;

        orders.forEach(order => {
            const storeId = order.establishment?.id;
            if (!storeId) return;
            const card = cardsById.get(storeId);
            if (!card) return;

            const statusId = order.storeStatus?.id;
            // Un pedido eliminado no existe para el usuario: no suma en ningun contador ni en el total
            if (statusId === eliminadoId) return;

            card.total++;

            const status = statusId !== undefined ? statusByStoreId.get(statusId) : undefined;
            if (status) {
                card.counts[status.key] = (card.counts[status.key] || 0) + 1;
            } else {
                card.otherCount++;
            }

            const movedAt = Date.parse(this.asUtc(order.updatedDate || order.creationDate));
            if (!Number.isNaN(movedAt) && movedAt > card.lastMovementTime) {
                card.lastMovementTime = movedAt;
            }
        });

        this.cards = Array.from(cardsById.values());
        this.cards.forEach(card => this.finishCard(card));
        this.computeTotals();
        this.applyFilters();
    }

    /** Las fechas llegan en UTC sin sufijo; sin la Z el navegador las lee como hora local. */
    private asUtc(value?: string): string {
        if (!value) return '';
        const clean = value.replace(/"/g, '');
        return clean.includes('Z') ? clean : clean + 'Z';
    }

    private finishCard(card: StoreCard) {
        card.segments = this.statusViews
            .filter(status => (card.counts[status.key] || 0) > 0)
            .map(status => ({
                key: status.key,
                label: status.label,
                color: status.color,
                count: card.counts[status.key],
                percent: (card.counts[status.key] / card.total) * 100
            }));

        card.pieGradient = this.buildPieGradient(card.segments);
        card.pieTitle = card.segments.map(segment => `${segment.label}: ${segment.count}`).join(' · ');

        if (card.lastMovementTime) {
            card.lastMovementLabel = this.dataService.getLocalDateTimeFromUTCTime(new Date(card.lastMovementTime).toISOString());
        }
    }

    /**
     * La gráfica de pie es un `conic-gradient`: cada estado ocupa el arco que va de su porcentaje
     * acumulado anterior al siguiente. No hace falta librería ni canvas.
     *
     * El último tramo se cierra en 100% a mano porque la suma de porcentajes redondeados puede
     * quedar en 99.99 y dejar una rebanada de fondo a la vista.
     */
    private buildPieGradient(segments: StoreCardSegment[]): string {
        if (!segments.length) return '';

        let cursor = 0;
        const stops = segments.map((segment, index) => {
            const from = cursor;
            cursor = index === segments.length - 1 ? 100 : cursor + segment.percent;
            return `${segment.color} ${from}% ${cursor}%`;
        });
        return `conic-gradient(${stops.join(', ')})`;
    }

    private computeTotals() {
        this.totals = {};
        this.totalOrders = 0;
        this.cards.forEach(card => {
            this.totalOrders += card.total;
            this.statusViews.forEach(status => {
                this.totals[status.key] = (this.totals[status.key] || 0) + (card.counts[status.key] || 0);
            });
        });
    }

    // ── Filtros y orden ──────────────────────────────────────────────────────

    onSearchChange() {
        this.applyFilters();
    }

    clearSearch() {
        this.searchTerm = '';
        this.applyFilters();
    }

    /**
     * Las tiendas se muestran en el orden en que las devuelve la consulta, sin reordenar, igual
     * que el listado de fábrica.
     */
    private applyFilters() {
        const term = this.searchTerm.trim().toLowerCase();
        const filtered = term
            ? this.cards.filter(card => card.name.toLowerCase().includes(term))
            : [...this.cards];

        // El color va con el lugar en la rejilla, no con la tienda: así la paleta se recorre en
        // secuencia siempre, sin importar cómo hayan quedado ordenadas las tarjetas
        filtered.forEach((card, index) => {
            card.color = getStoreColorByIndex(index);
            card.textColor = getStoreTextColorByIndex(index);
        });

        this.visibleCards = filtered;
    }

    // ── Presentacion ─────────────────────────────────────────────────────────

    getCount(card: StoreCard, key: string): number {
        return card.counts[key] || 0;
    }

    trackByCardId(_index: number, card: StoreCard) {
        return card.id;
    }

    trackByStatusKey(_index: number, status: OrderStatusView) {
        return status.key;
    }

    /**
     * En modo consulta el listado destino elige la tienda con su propio selector y la recuerda en
     * sessionStorage, asi que basta con dejarla escrita antes de navegar: llega con la tienda puesta
     * sin tocar el listado ni sus query params.
     */
    /** La barra espaciadora activa la tarjeta; sin preventDefault ademas scrollearia la pagina. */
    onCardKey(event: Event, card: StoreCard) {
        event.preventDefault();
        this.goToOrders(card);
    }

    /**
     * La tienda viaja en los query params, igual que al llegar desde el listado de tiendas.
     * En consultas se manda `opt: 'store'` para que los pedidos se vean desde la tienda, con
     * precios y total, que es como los mostraba el selector que reemplaza esta pantalla.
     */
    goToOrders(card: StoreCard) {
        this.router.navigate([this.ordersRoute], {
            queryParams: {
                opt: this.readOnly ? 'store' : 'factory',
                store: card.id,
                name: card.name
            }
        });
    }
}
