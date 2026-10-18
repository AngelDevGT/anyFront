import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

/** Fila desde la que se salió del listado, para volver a ella. */
export interface ScrollAnchor {
    /** Identificador de la fila (ver DataTableComponent.rowId). */
    rowId?: string;
    /** Distancia de la fila al borde superior de la ventana cuando se hizo click. */
    offset?: number;
}

/** Lo que se guarda al salir de un listado hacia un detalle. */
export interface SavedScroll extends ScrollAnchor {
    /** Posición vertical de la ventana al salir. Respaldo si la fila ya no está. */
    y: number;
    /** Ruta (sin query params) a la que se salió: solo se restaura al volver DESDE ella. */
    to: string;
}

/**
 * Recuerda en qué parte de un listado estaba el usuario al abrir un detalle, para volver a ese
 * mismo lugar. Sin esto, regresar de la venta 20 recarga la tabla y deja el scroll arriba.
 *
 * Se recuerda la FILA, no solo los píxeles: al volver se busca esa fila y se deja a la misma
 * altura de la pantalla en que estaba. Así, si mientras tanto entró un registro nuevo arriba y la
 * fila bajó un lugar, se sigue viendo la misma fila en el mismo sitio. La posición en píxeles queda
 * como respaldo para cuando la fila ya no está (se eliminó o quedó fuera del filtro).
 *
 * La posición se restaura solo si la pantalla inmediatamente anterior es aquella a la que se salió
 * (el detalle). Si el usuario llega al listado desde el menú, o desde otro lado, empieza arriba
 * como siempre: sin esta condición, una posición vieja reaparecería días después en una visita
 * que no tiene nada que ver con aquella.
 *
 * Vive en sessionStorage, igual que la página y el rango de fechas de los listados: se pierde al
 * cerrar la pestaña. La página de la tabla ya la recuerda PaginationStateService; esto agrega el
 * scroll dentro de ella.
 *
 * Hay que instanciarlo al arrancar (AppComponent lo inyecta) para que alcance a ver las
 * navegaciones desde la primera.
 */
@Injectable({ providedIn: 'root' })
export class ScrollMemoryService {
    private readonly prefix = 'scroll:';
    private previousPath = '';
    private currentPath = '';

    constructor(private readonly router: Router) {
        this.router.events.subscribe(event => {
            if (event instanceof NavigationEnd) {
                this.previousPath = this.currentPath;
                this.currentPath = this.pathOf(event.urlAfterRedirects);
            }
        });
    }

    /**
     * Guarda dónde estaba el usuario en el listado `key` antes de salir hacia `to` (con o sin
     * query), con la fila desde la que salió si se conoce.
     */
    save(key: string, to: string, anchor: ScrollAnchor = {}) {
        try {
            const saved: SavedScroll = {
                y: Math.round(window.scrollY),
                to: this.pathOf(to),
                rowId: anchor.rowId,
                offset: anchor.offset !== undefined ? Math.round(anchor.offset) : undefined
            };
            sessionStorage.setItem(this.prefix + key, JSON.stringify(saved));
        } catch {}
    }

    /**
     * Lo guardado del listado `key`, o undefined si no corresponde restaurarlo. Se consume: una
     * segunda lectura ya no lo devuelve, así que un recargo posterior no vuelve a moverse.
     */
    consume(key: string): SavedScroll | undefined {
        try {
            const raw = sessionStorage.getItem(this.prefix + key);
            if (!raw) return undefined;
            sessionStorage.removeItem(this.prefix + key);

            const saved: SavedScroll = JSON.parse(raw);
            const cameBack = !!saved.to && saved.to === this.previousPath;
            if (!cameBack) return undefined;
            // Arriba de todo y sin fila no hay nada que restaurar
            if (!saved.rowId && !(Number.isFinite(saved.y) && saved.y > 0)) return undefined;
            return saved;
        } catch {
            return undefined;
        }
    }

    private pathOf(url: string): string {
        return (url || '').split('?')[0].split('#')[0];
    }
}
