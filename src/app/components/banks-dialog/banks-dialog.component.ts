import { Component, EventEmitter, Input, Output, SimpleChanges, OnChanges } from '@angular/core';

import { normalizeBank, BANK_MAX_LENGTH } from '@app/helpers';

/**
 * Modal para armar la lista de bancos de una tienda.
 *
 * Se usa en el listado de Sistema > Tiendas, con la accion "Bancos".
 *
 *   <app-banks-dialog
 *       [open]="banksDialogOpen"
 *       [storeName]="banksTarget?.name"
 *       [initial]="initialBanks"
 *       [loading]="loadingBanks"
 *       [saving]="savingBanks"
 *       (confirm)="onBanksConfirmed($event)"
 *       (cancel)="onBanksCancelled()">
 *   </app-banks-dialog>
 *
 * Es un overlay con *ngIf y NO un modal de Bootstrap, igual que app-operators-dialog: se abre
 * desde un boton de la tabla, no con un data-bs-toggle.
 *
 * A diferencia del de operadores no tiene catalogo: un banco no es una entidad del sistema, se
 * escribe a mano. Emite solo los nombres; serializarlos al texto con saltos de linea es cosa del
 * host, que es quien llama al endpoint.
 */
@Component({
    selector: 'app-banks-dialog',
    templateUrl: './banks-dialog.component.html',
    styleUrls: ['./banks-dialog.component.scss']
})
export class BanksDialogComponent implements OnChanges {

    @Input() open = false;
    /** Nombre de la tienda, para el subtitulo. */
    @Input() storeName?: string;
    /** Bancos ya guardados en la tienda, para abrir el modal con la lista puesta. */
    @Input() initial: string[] = [];
    /** El host pide los bancos al abrir, asi que llegan despues que [open]. */
    @Input() loading = false;
    @Input() saving = false;

    @Output() confirm = new EventEmitter<string[]>();
    @Output() cancel = new EventEmitter<void>();

    readonly maxLength = BANK_MAX_LENGTH;

    /** Lista en edicion. Copia de trabajo: cancelar no deja rastro en el host. */
    chips: string[] = [];
    newBank = '';

    /**
     * El host controla la apertura con [open], asi que el reset va acá: cada vez que pasa de
     * cerrado a abierto se limpia la lista. Sin esto, cerrar y reabrir para otra tienda
     * arrastraria las capsulas de la anterior.
     *
     * [initial] llega DESPUES, cuando responde la lectura de la tienda: por eso se rearma tambien
     * al cambiar, y no solo al abrir. Se ignora si el usuario ya agrego algo mientras cargaba,
     * para no pisarle lo escrito.
     */
    ngOnChanges(changes: SimpleChanges) {
        if (changes['open'] && changes['open'].currentValue && !changes['open'].previousValue) {
            this.newBank = '';
            this.chips = [...(this.initial || [])];
            return;
        }

        if (changes['initial'] && this.open && !this.chips.length) {
            this.chips = [...(this.initial || [])];
        }
    }

    /** Repetido respecto de lo que ya esta en la lista. */
    get isDuplicate(): boolean {
        const key = normalizeBank(this.newBank);
        return !!key && this.chips.some(name => normalizeBank(name) === key);
    }

    get canAdd(): boolean {
        return !!this.newBank.trim() && !this.isDuplicate;
    }

    add() {
        if (!this.canAdd) return;
        // El salto de linea es el separador de la columna: si se cuela dentro de un nombre pegado
        // desde afuera, parte el banco en dos al volver a leerlo.
        const name = this.newBank.replace(/[\r\n]+/g, ' ').trim().slice(0, BANK_MAX_LENGTH).trim();
        this.chips.push(name);
        this.newBank = '';
    }

    remove(index: number) {
        this.chips.splice(index, 1);
    }

    trackByChip(index: number, name: string) {
        return name + '|' + index;
    }

    /** Guardar sin ningun banco esta permitido: el endpoint deja la columna en NULL. */
    onConfirm() {
        this.confirm.emit([...this.chips]);
    }

    onCancel() {
        this.cancel.emit();
    }
}
