import { Component, EventEmitter, Input, Output } from '@angular/core';

import { normalizeTag, TAG_LIST_MAX_ITEMS, TAG_MAX_LENGTH } from '@app/helpers';

/**
 * Selector de etiquetas dentro de un formulario: las elegidas arriba como cápsulas, las del
 * catálogo para agregar con un click y un campo para escribir una nueva.
 *
 *   <app-tag-picker
 *       label="Etiquetas del gasto"
 *       [catalog]="expenseTagOptions"
 *       [(selected)]="expenseTags">
 *   </app-tag-picker>
 *
 * Es el mismo patrón que el modal de operadores (elegir de las existentes o crear una nueva), pero
 * en línea: un gasto se llena en un formulario, no en una ventana aparte.
 *
 * Una etiqueta nueva queda solo en la lista seleccionada: el catálogo de la tienda no cambia. Se
 * administra desde el botón Gastos en Sistema > Tiendas.
 *
 * Emite solo los nombres; guardarlos como texto (una etiqueta por línea) es cosa del host, con
 * serializeExpenseTags.
 */
@Component({
    selector: 'app-tag-picker',
    templateUrl: './tag-picker.component.html',
    styleUrls: ['./tag-picker.component.scss']
})
export class TagPickerComponent {

    @Input() label = 'Etiquetas';
    /** Etiquetas disponibles para elegir (las de la tienda). */
    @Input() catalog: string[] = [];
    @Input() selected: string[] = [];
    @Input() disabled = false;
    @Input() placeholder = 'Escribe una etiqueta nueva';
    @Input() emptyText = 'Ninguna etiqueta seleccionada.';
    /** Exige al menos una; solo cambia el mensaje, el host decide si bloquea el guardado. */
    @Input() required = false;
    /** Color de las cápsulas: { bg_color, color }. */
    @Input() chipColor?: { bg_color?: string, color?: string };

    @Output() selectedChange = new EventEmitter<string[]>();

    readonly maxLength = TAG_MAX_LENGTH;
    readonly maxItems = TAG_LIST_MAX_ITEMS;

    newTag = '';

    /** Las del catálogo que todavía no se eligieron. */
    get available(): string[] {
        return this.catalog.filter(tag => !this.isSelected(tag));
    }

    get isFull(): boolean {
        return this.selected.length >= this.maxItems;
    }

    get isDuplicate(): boolean {
        const key = normalizeTag(this.newTag);
        return !!key && this.selected.some(tag => normalizeTag(tag) === key);
    }

    get canAdd(): boolean {
        return !this.disabled && !!this.newTag.trim() && !this.isDuplicate && !this.isFull;
    }

    isSelected(tag: string): boolean {
        const key = normalizeTag(tag);
        return this.selected.some(selected => normalizeTag(selected) === key);
    }

    addFromCatalog(tag: string) {
        if (this.disabled || this.isFull || this.isSelected(tag)) return;
        this.emit([...this.selected, tag]);
    }

    addNew() {
        if (!this.canAdd) return;
        // El salto de línea es el separador del texto guardado: dentro de un nombre pegado partiría
        // la etiqueta en dos al volver a leerla.
        const name = this.newTag.replace(/[\r\n]+/g, ' ').trim().slice(0, this.maxLength).trim();
        this.emit([...this.selected, name]);
        this.newTag = '';
    }

    remove(index: number) {
        if (this.disabled) return;
        this.emit(this.selected.filter((_, i) => i !== index));
    }

    trackByTag(index: number, tag: string) {
        return tag + '|' + index;
    }

    private emit(tags: string[]) {
        this.selected = tags;
        this.selectedChange.emit(tags);
    }
}
