import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Rango de fechas aplicado en un listado. Se guarda en sessionStorage para que al volver desde un
 * detalle (o al recargar) se consulte el mismo rango; al abrir una pestana nueva se parte del
 * rango por defecto.
 */
export class DateRangeState {
    private _start: Date;
    private _end: Date;

    constructor(
        private readonly store: DateRangeStateService,
        private readonly key: string,
        private readonly defaultDays: number
    ) {
        const saved = this.store.get(this.key);
        const fallback = this.defaultRange();
        this._start = saved?.start ?? fallback.start;
        this._end = saved?.end ?? fallback.end;
    }

    get start(): Date {
        return this._start;
    }

    get end(): Date {
        return this._end;
    }

    /** Rango inicial del listado: los ultimos `defaultDays` dias hasta hoy. */
    defaultRange(): { start: Date, end: Date } {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - this.defaultDays);
        return { start, end };
    }

    /** Debe llamarse cuando el usuario aplica un rango, para recordarlo en la pestana actual. */
    apply(start: Date, end: Date) {
        this._start = start;
        this._end = end;
        this.store.set(this.key, start, end);
    }
}

@Injectable({ providedIn: 'root' })
export class DateRangeStateService {
    private readonly prefix = 'dateRange:';

    constructor(private readonly router: Router) {}

    /**
     * Crea el estado del filtro de fechas de un listado. Sin llave explicita se usa la ruta actual
     * (sin query params) como identificador, asi cada listado recuerda su propio rango.
     */
    createRange(defaultDays: number, key?: string): DateRangeState {
        return new DateRangeState(this, key || this.router.url.split('?')[0], defaultDays);
    }

    get(key: string): { start: Date, end: Date } | undefined {
        try {
            const raw = sessionStorage.getItem(this.prefix + key);
            if (!raw) return undefined;
            const value = JSON.parse(raw);
            const start = this.parseDate(value?.start);
            const end = this.parseDate(value?.end);
            return start && end ? { start, end } : undefined;
        } catch {
            return undefined;
        }
    }

    set(key: string, start: Date, end: Date) {
        try {
            const value = { start: this.formatDate(start), end: this.formatDate(end) };
            sessionStorage.setItem(this.prefix + key, JSON.stringify(value));
        } catch {}
    }

    /**
     * Se guarda solo la fecha (sin hora) y se reconstruye en horario local, porque parsear un ISO
     * completo correria un dia en zonas horarias negativas como la de Guatemala.
     */
    private formatDate(date: Date): string {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${date.getFullYear()}-${month}-${day}`;
    }

    private parseDate(value: any): Date | undefined {
        if (typeof value !== 'string') return undefined;
        const parts = value.split('-').map(Number);
        if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return undefined;
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        return Number.isNaN(date.getTime()) ? undefined : date;
    }
}
