import { Component, EventEmitter, Input, Output, SimpleChanges, OnChanges } from '@angular/core';

import { normalizeOperator, OPERATOR_MAX_LENGTH } from '@app/helpers';

/** Cliente marcado como Operador. Solo id y nombre: es lo unico que devuelve el catalogo. */
export interface OperatorCustomer {
    id?: string;
    name?: string;
}

/** Una capsula de la lista en edicion. `source` solo define el color. */
interface OperatorChip {
    name: string;
    source: 'catalog' | 'manual';
}

/**
 * Modal para armar la lista de operadores de un pedido.
 *
 * Se usa en dos lados: el tablero, al arrastrar un pedido a En curso, y la vista de detalle, con
 * la accion "Editar operadores".
 *
 *   <app-operators-dialog
 *       [open]="operatorsDialogOpen"
 *       [orderName]="pendingMove?.order?.name"
 *       [operatorCustomers]="operatorCustomers"
 *       [loadingCustomers]="loadingOperatorCustomers"
 *       [initial]="initialOperators"
 *       [saving]="submitting"
 *       (confirm)="onOperatorsConfirmed($event)"
 *       (cancel)="onOperatorsCancelled()">
 *   </app-operators-dialog>
 *
 * Es un overlay con *ngIf y NO un modal de Bootstrap: en el tablero se abre al soltar una tarjeta,
 * no con un data-bs-toggle. Es el mismo patron que ya usa la confirmacion de "Listo".
 *
 * Emite solo los nombres; serializarlos al texto con pipes es cosa del host, que es quien llama al
 * endpoint.
 */
@Component({
    selector: 'app-operators-dialog',
    templateUrl: './operators-dialog.component.html',
    styleUrls: ['./operators-dialog.component.scss']
})
export class OperatorsDialogComponent implements OnChanges {

    @Input() open = false;
    /** Nombre del pedido, para el subtitulo. */
    @Input() orderName?: string;
    /** Clientes con el atributo Operador. */
    @Input() operatorCustomers: OperatorCustomer[] = [];
    @Input() loadingCustomers = false;
    /** Operadores ya guardados en el pedido, para reabrirlo con la lista puesta. */
    @Input() initial: string[] = [];
    @Input() saving = false;
    /**
     * Exige al menos un operador para poder guardar. Lo activan:
     *  - el tablero al tomar un pedido, siempre: ahi el dato es el punto de la ventana;
     *  - la vista de detalle solo al EDITAR, o sea cuando el pedido ya tiene operadores, para que
     *    no se vacie la lista sin querer. Al AGREGAR sobre un pedido que no tiene ninguno queda en
     *    false, porque cargarlos ahi es opcional.
     *
     * Es una validacion de pantalla, no de la base: el endpoint sigue aceptando la lista vacia y
     * guardando NULL, igual que hacen los pedidos que nunca pasan por el tablero.
     */
    @Input() required = false;

    @Output() confirm = new EventEmitter<string[]>();
    @Output() cancel = new EventEmitter<void>();

    readonly maxLength = OPERATOR_MAX_LENGTH;

    /** Lista en edicion. Copia de trabajo: cancelar no deja rastro en el host. */
    chips: OperatorChip[] = [];
    manualName = '';
    searchTerm = '';

    /**
     * El host controla la apertura con [open], asi que el reset va acá: cada vez que pasa de
     * cerrado a abierto se rearma la lista desde [initial]. Sin esto, cerrar y reabrir para otro
     * pedido arrastraria las capsulas del anterior.
     */
    ngOnChanges(changes: SimpleChanges) {
        if (changes['open'] && changes['open'].currentValue && !changes['open'].previousValue) {
            this.reset();
            return;
        }

        // La vista de detalle pide el catalogo al abrir el modal, asi que la primera vez llega
        // DESPUES del reset y las capsulas guardadas quedarian pintadas como manuales. Al llegar
        // se recalcula el origen de las que ya estan; la lista en si no se toca, para no pisar lo
        // que el usuario haya agregado mientras cargaba.
        if (changes['operatorCustomers'] && this.open) {
            this.chips = this.chips.map(chip => ({ ...chip, source: this.sourceOf(chip.name) }));
        }
    }

    private reset() {
        this.manualName = '';
        this.searchTerm = '';
        this.chips = (this.initial || []).map(name => ({ name, source: this.sourceOf(name) }));
    }

    /**
     * El origen de un operador guardado no se conserva —operators es texto suelto—, asi que se
     * deduce cruzando el nombre contra el catalogo. Es solo el color de la capsula: un nombre
     * escrito a mano identico a uno del catalogo se pinta como del catalogo, y da igual, porque el
     * texto que se vuelve a guardar es el mismo de cualquier forma.
     */
    private sourceOf(name: string): 'catalog' | 'manual' {
        const key = normalizeOperator(name);
        const inCatalog = this.operatorCustomers.some(c => normalizeOperator(c.name || '') === key);
        return inCatalog ? 'catalog' : 'manual';
    }

    // ── Catalogo ─────────────────────────────────────────────────────────────

    get filteredCustomers(): OperatorCustomer[] {
        const term = normalizeOperator(this.searchTerm);
        if (!term) return this.operatorCustomers;
        return this.operatorCustomers.filter(c => normalizeOperator(c.name || '').includes(term));
    }

    /** Ya esta en la lista: la fila del catalogo se marca y deja de responder al click. */
    isSelected(customer: OperatorCustomer): boolean {
        const key = normalizeOperator(customer.name || '');
        return this.chips.some(chip => normalizeOperator(chip.name) === key);
    }

    /** Un click agrega el operador, como al armar una lista de correos. */
    addFromCatalog(customer: OperatorCustomer) {
        const name = (customer.name || '').trim();
        if (!name || this.isSelected(customer)) return;
        this.chips.push({ name, source: 'catalog' });
    }

    // ── Manual ───────────────────────────────────────────────────────────────

    /** Repetido respecto de lo que ya esta en la lista, venga del catalogo o escrito antes. */
    get manualIsDuplicate(): boolean {
        const key = normalizeOperator(this.manualName);
        return !!key && this.chips.some(chip => normalizeOperator(chip.name) === key);
    }

    get canAddManual(): boolean {
        return !!this.manualName.trim() && !this.manualIsDuplicate;
    }

    addManual() {
        if (!this.canAddManual) return;
        // El pipe es el separador de la columna: si se cuela dentro de un nombre, parte el operador
        // en dos al volver a leerlo.
        const name = this.manualName.replace(/\|/g, ' ').trim().slice(0, OPERATOR_MAX_LENGTH);
        this.chips.push({ name, source: 'manual' });
        this.manualName = '';
    }

    // ── Lista ────────────────────────────────────────────────────────────────

    remove(index: number) {
        this.chips.splice(index, 1);
    }

    trackByChip(index: number, chip: OperatorChip) {
        return chip.name + '|' + index;
    }

    trackByCustomer(index: number, customer: OperatorCustomer) {
        return customer.id ?? index;
    }

    // ── Salida ───────────────────────────────────────────────────────────────

    /** Falta lo minimo para guardar. Solo puede pasar con `required`. */
    get missingRequired(): boolean {
        return this.required && !this.chips.length;
    }

    /**
     * Sin `required`, guardar con la lista vacia esta permitido y deja la columna en NULL: es como
     * se le quitan los operadores a un pedido al que se le cargaron por error.
     */
    onConfirm() {
        if (this.missingRequired) return;
        this.confirm.emit(this.chips.map(chip => chip.name));
    }

    onCancel() {
        this.cancel.emit();
    }
}
