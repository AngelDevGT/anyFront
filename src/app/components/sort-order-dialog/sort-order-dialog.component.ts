import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

export interface SortableItem {
    id: string;
    title?: string;
    subtitle?: string;
}

/**
 * Diálogo reutilizable de reordenamiento por drag & drop.
 *
 * Uso:
 *   <app-sort-order-dialog
 *       [items]="items"           // arreglo de { id, title, subtitle }
 *       [title]="'Ordenar Productos'"
 *       [modalId]="'sortFinishedProduct'"   // único por instancia en la vista
 *       [saving]="savingOrder"
 *       (save)="onSaveOrder($event)">        // emite el arreglo ya reordenado
 *   </app-sort-order-dialog>
 *
 * El host persiste el nuevo orden (índice del arreglo -> sort_order) y recarga.
 */
@Component({
    selector: 'app-sort-order-dialog',
    templateUrl: './sort-order-dialog.component.html',
    styleUrls: ['./sort-order-dialog.component.scss']
})
export class SortOrderDialogComponent {
    @Input() items: SortableItem[] = [];
    @Input() title = 'Ordenar';
    @Input() modalId = 'sortOrderModal';
    @Input() saving = false;
    @Input() disabled = false;
    @Output() save = new EventEmitter<SortableItem[]>();

    // Copia de trabajo: permite cancelar sin afectar el listado original.
    working: SortableItem[] = [];
    sortMenuOpen = false;

    open() {
        this.working = [...(this.items || [])];
        this.sortMenuOpen = false;
    }

    drop(event: CdkDragDrop<SortableItem[]>) {
        moveItemInArray(this.working, event.previousIndex, event.currentIndex);
    }

    /**
     * Aplica un orden alfabético por nombre como punto de partida.
     * El resultado sigue siendo editable a mano (arrastrando).
     */
    applyAlphabetical(direction: 'asc' | 'desc') {
        const dir = direction === 'asc' ? 1 : -1;
        this.working = [...this.working].sort((a, b) =>
            dir * (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base', numeric: true })
        );
        this.sortMenuOpen = false;
    }

    onSave() {
        this.save.emit(this.working);
    }
}
