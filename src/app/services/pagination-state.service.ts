import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Estado de paginacion de un listado. Guarda la pagina y el tamano de pagina en sessionStorage
 * para que al volver desde un detalle (o al recargar) se muestre la misma pagina y no la primera.
 */
export class PagerState {
    private _page = 1;
    private _pageSize: number;
    private restored = false;
    private readonly storedPage?: number;

    constructor(
        private readonly store: PaginationStateService,
        private readonly key: string,
        defaultPageSize: number
    ) {
        this._pageSize = this.store.getPageSize(this.key) ?? defaultPageSize;
        this.storedPage = this.store.getPage(this.key);
    }

    get page(): number {
        return this._page;
    }

    set page(value: number) {
        this._page = value;
        this.store.setPage(this.key, value);
    }

    get pageSize(): number {
        return this._pageSize;
    }

    set pageSize(value: number) {
        this._pageSize = value;
        this.store.setPageSize(this.key, value);
    }

    /**
     * Debe llamarse cada vez que cambia el listado. La primera vez que llegan registros restaura la
     * pagina guardada; los cambios posteriores vienen de una busqueda o filtro, asi que vuelven al inicio.
     *
     * La restauracion se difiere hasta tener registros porque ngb-pagination reinicia la pagina
     * mientras el listado esta vacio, lo que borraria el valor guardado.
     */
    onDataChange(totalItems: number) {
        if (this.restored) {
            this.page = 1;
            return;
        }
        if (!totalItems) return;
        this.restored = true;
        this._page = this.store.clampPage(this.storedPage ?? 1, totalItems, this._pageSize);
    }
}

@Injectable({ providedIn: 'root' })
export class PaginationStateService {
    private readonly prefix = 'pager:';

    constructor(private readonly router: Router) {}

    /**
     * Crea el estado de paginacion de un listado. Sin llave explicita se usa la ruta actual
     * (sin query params) como identificador, asi cada listado recuerda su propia pagina.
     */
    createPager(defaultPageSize: number, key?: string): PagerState {
        return new PagerState(this, key || this.router.url.split('?')[0], defaultPageSize);
    }

    getPage(key: string): number | undefined {
        return this.read(key, 'page');
    }

    setPage(key: string, page: number) {
        this.write(key, 'page', page);
    }

    getPageSize(key: string): number | undefined {
        return this.read(key, 'size');
    }

    setPageSize(key: string, pageSize: number) {
        this.write(key, 'size', pageSize);
    }

    /** La pagina guardada puede quedar fuera de rango si cambio la cantidad de registros. */
    clampPage(page: number, totalItems: number, pageSize: number): number {
        const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize)));
        return Math.min(Math.max(1, page), totalPages);
    }

    private read(key: string, suffix: string): number | undefined {
        try {
            const raw = sessionStorage.getItem(`${this.prefix}${key}:${suffix}`);
            const value = Number(raw);
            return raw && Number.isFinite(value) && value > 0 ? value : undefined;
        } catch {
            return undefined;
        }
    }

    private write(key: string, suffix: string, value: number) {
        try {
            sessionStorage.setItem(`${this.prefix}${key}:${suffix}`, String(value));
        } catch {}
    }
}
