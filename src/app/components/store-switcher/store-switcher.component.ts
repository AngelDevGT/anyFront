import { Component, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { Establishment } from '@app/models/establishment.model';
import { StoreContextService } from '@app/services';

/** Hasta cuantas tiendas se muestran como chips antes de pasar al menu con buscador. */
const CHIP_LIMIT = 4;

type SwitcherMode = 'loading' | 'empty' | 'single' | 'chips' | 'dropdown' | 'list';

/**
 * Selector de la tienda con la que se esta trabajando. Se adapta a cuantas tiendas tiene asignadas
 * el usuario, que en la practica suelen ser una o dos:
 *
 *   - una sola: no hay nada que elegir, solo se muestra el nombre;
 *   - hasta cuatro: chips, cambiar de tienda es un clic;
 *   - mas: boton con menu y buscador.
 *
 * En la variante "card" (el estado vacio de una seccion sin tienda) los chips van en grande y el
 * menu se muestra desplegado, porque ahi elegir tienda es la unica accion de la pantalla.
 */
@Component({
    selector: 'store-switcher',
    templateUrl: './store-switcher.component.html',
    styleUrls: ['./store-switcher.component.scss']
})
export class StoreSwitcherComponent implements OnInit, OnDestroy {
    @Input() variant: 'bar' | 'card' = 'bar';

    stores?: Establishment[];
    current?: Establishment;
    panelOpen = false;
    filterTerm = '';

    private subs: Subscription[] = [];

    constructor(private readonly storeContext: StoreContextService) {}

    ngOnInit() {
        this.subs.push(this.storeContext.stores$.subscribe(stores => this.stores = stores));
        this.subs.push(this.storeContext.current$.subscribe(store => this.current = store));
        // Dispara la carga la primera vez; las siguientes pantallas reutilizan la misma respuesta
        this.storeContext.stores().subscribe();
    }

    ngOnDestroy() {
        this.subs.forEach(sub => sub.unsubscribe());
    }

    get mode(): SwitcherMode {
        if (!this.stores) {
            return 'loading';
        }
        if (!this.stores.length) {
            return 'empty';
        }
        if (this.stores.length === 1) {
            return 'single';
        }
        if (this.stores.length <= CHIP_LIMIT) {
            return 'chips';
        }
        return this.variant === 'card' ? 'list' : 'dropdown';
    }

    /** Con una sola tienda asignada puede que el contexto aun no la haya adoptado. */
    get singleStoreName(): string {
        return this.current?.name ?? this.stores?.[0]?.name ?? '';
    }

    get filteredStores(): Establishment[] {
        const term = this.filterTerm.trim().toLowerCase();
        if (!term) {
            return this.stores ?? [];
        }
        return (this.stores ?? []).filter(store =>
            store.name?.toLowerCase().includes(term) || store.address?.toLowerCase().includes(term)
        );
    }

    togglePanel(event: Event) {
        event.stopPropagation();
        this.panelOpen = !this.panelOpen;
        if (this.panelOpen) {
            this.filterTerm = '';
        }
    }

    @HostListener('document:click')
    onDocumentClick() {
        this.panelOpen = false;
    }

    pick(store: Establishment) {
        this.panelOpen = false;
        if (store.id !== this.current?.id) {
            this.storeContext.select(store);
        }
    }
}
