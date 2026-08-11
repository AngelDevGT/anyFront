import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { first } from 'rxjs/operators';

import { AccountService, DataService, StoreSelectionStateService } from '@app/services';
import { Establishment } from '@app/models/establishment.model';

/**
 * Selector de tienda para los listados que se consultan por tienda. Solo ofrece las tiendas
 * asignadas al usuario (todas si es admin) y recuerda la seleccion en la pestana actual.
 *
 * Emite la tienda elegida —o undefined mientras no haya ninguna— para que el listado contenedor
 * decida cuando pedir sus datos.
 */
@Component({
    selector: 'store-picker',
    templateUrl: './store-picker.component.html',
    styleUrls: ['./store-picker.component.scss']
})
export class StorePickerComponent implements OnInit {
    /** Llave con la que se recuerda la tienda en sessionStorage; normalmente la ruta del listado. */
    @Input() storageKey = '';
    @Input() label = 'Tienda';
    @Output() storeChange = new EventEmitter<Establishment | undefined>();

    stores?: Establishment[];
    selectedId = '';
    loading = false;

    constructor(
        private readonly dataService: DataService,
        private readonly accountService: AccountService,
        private readonly storeSelection: StoreSelectionStateService
    ) {}

    ngOnInit() {
        this.loading = true;
        this.dataService.getAllEstablishmentsByFilter({ status_id: 28 })
            .pipe(first())
            .subscribe({
                next: (response: any) => {
                    const all: Establishment[] = this.dataService.findJsonValue(response, 'json_result') || [];
                    this.stores = this.accountService.filterAssignedEstablishments(all);
                    this.restoreSelection();
                    this.loading = false;
                },
                error: () => {
                    this.stores = [];
                    this.loading = false;
                    this.storeChange.emit(undefined);
                }
            });
    }

    /**
     * La tienda guardada puede haber dejado de estar asignada (o de existir), asi que solo se
     * restaura si sigue estando entre las opciones; si el usuario tiene una sola, se elige sola.
     */
    private restoreSelection() {
        const saved = this.storageKey ? this.storeSelection.get(this.storageKey) : undefined;
        const savedStore = saved ? this.stores?.find(store => store.id === saved) : undefined;
        const store = savedStore ?? (this.stores?.length === 1 ? this.stores[0] : undefined);

        if (!savedStore && saved && this.storageKey) {
            this.storeSelection.clear(this.storageKey);
        }
        this.selectedId = store?.id ?? '';
        if (store && this.storageKey) {
            this.storeSelection.set(this.storageKey, this.selectedId);
        }
        this.storeChange.emit(store);
    }

    onSelectionChange(storeId: string) {
        this.selectedId = storeId;
        const store = this.stores?.find(current => current.id === storeId);
        if (this.storageKey) {
            if (store) {
                this.storeSelection.set(this.storageKey, storeId);
            } else {
                this.storeSelection.clear(this.storageKey);
            }
        }
        this.storeChange.emit(store);
    }
}
