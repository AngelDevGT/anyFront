import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Filtros aplicados en un listado (texto de búsqueda, estados marcados...). Se guardan en
 * sessionStorage para que al volver desde un detalle la tabla se vea igual que se dejó, igual que
 * ya hacen la página (PaginationStateService) y el rango de fechas (DateRangeStateService). Al
 * abrir una pestaña nueva se parte sin filtros.
 *
 * Es genérico a propósito: cada listado guarda el objeto que necesite. Sin llave explícita se usa
 * la ruta actual (sin query params), así cada listado —y cada tienda, que va en la ruta— recuerda
 * los suyos.
 */
@Injectable({ providedIn: 'root' })
export class ListFilterStateService {
    private readonly prefix = 'listFilters:';

    constructor(private readonly router: Router) {}

    get<T>(key?: string): T | undefined {
        try {
            const raw = sessionStorage.getItem(this.prefix + this.keyOf(key));
            return raw ? JSON.parse(raw) as T : undefined;
        } catch {
            return undefined;
        }
    }

    set<T>(value: T, key?: string) {
        try {
            sessionStorage.setItem(this.prefix + this.keyOf(key), JSON.stringify(value));
        } catch {}
    }

    private keyOf(key?: string): string {
        return key || this.router.url.split('?')[0];
    }
}
