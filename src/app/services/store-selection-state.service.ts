import { Injectable } from '@angular/core';

/**
 * Tienda seleccionada en un listado que se consulta por tienda. Se guarda en sessionStorage para
 * que al volver desde un detalle (o al recargar) siga la misma tienda; al abrir una pestana nueva
 * se parte sin seleccion. Cada pestana puede estar viendo una tienda distinta.
 */
@Injectable({ providedIn: 'root' })
export class StoreSelectionStateService {
    private readonly prefix = 'store:';

    get(key: string): string | undefined {
        try {
            return sessionStorage.getItem(this.prefix + key) || undefined;
        } catch {
            return undefined;
        }
    }

    set(key: string, storeId: string) {
        try {
            sessionStorage.setItem(this.prefix + key, storeId);
        } catch {}
    }

    clear(key: string) {
        try {
            sessionStorage.removeItem(this.prefix + key);
        } catch {}
    }
}
