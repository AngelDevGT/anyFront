import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface CostItem {
    id: string;
    title?: string;
    /** Texto de referencia bajo el nombre (se usa para el precio de venta). */
    subtitle?: string;
    cost?: string | number;
}

/** Fila de trabajo interna: conserva el costo original para detectar cambios. */
interface CostRow {
    id: string;
    title?: string;
    subtitle?: string;
    cost: string;
    originalCost: string;
}

/**
 * Diálogo reutilizable de edición masiva de costos.
 *
 * Uso:
 *   <app-bulk-cost-dialog
 *       [items]="items"                     // arreglo de { id, title, subtitle, cost }
 *       [title]="'Editar costos'"
 *       [modalId]="'bulkCostProductForSale'" // único por instancia en la vista
 *       [saving]="savingCosts"
 *       (save)="onSaveCosts($event)">        // emite SOLO las filas modificadas
 *   </app-bulk-cost-dialog>
 *
 * El host persiste los cambios en una sola operación y recarga el listado.
 */
@Component({
    selector: 'app-bulk-cost-dialog',
    templateUrl: './bulk-cost-dialog.component.html',
    styleUrls: ['./bulk-cost-dialog.component.scss']
})
export class BulkCostDialogComponent {
    @Input() items: CostItem[] = [];
    @Input() title = 'Editar costos';
    @Input() modalId = 'bulkCostModal';
    @Input() saving = false;
    @Input() disabled = false;
    @Output() save = new EventEmitter<{ id: string, cost: number }[]>();

    // Mismo patrón de validación que el resto de campos monetarios de la app.
    private readonly costPattern = /^\d+(\.\d{1,2})?$/;

    // Copia de trabajo: permite cancelar sin afectar el listado original.
    working: CostRow[] = [];
    searchTerm = '';

    open() {
        this.searchTerm = '';
        this.working = (this.items || []).map(item => {
            const cost = item.cost != null ? String(item.cost) : '';
            return {
                id: item.id,
                title: item.title,
                subtitle: item.subtitle,
                cost: cost,
                originalCost: cost
            };
        });
    }

    get filtered(): CostRow[] {
        const term = this.searchTerm?.trim().toLowerCase();
        if (!term) return this.working;
        return this.working.filter(row => (row.title || '').toLowerCase().includes(term));
    }

    isInvalid(row: CostRow): boolean {
        return !this.costPattern.test((row.cost || '').trim());
    }

    get hasInvalid(): boolean {
        return this.working.some(row => this.isInvalid(row));
    }

    /** Filas cuyo costo cambió respecto al valor precargado. */
    get changed(): CostRow[] {
        return this.working.filter(row => (row.cost || '').trim() !== row.originalCost);
    }

    trackById(index: number, row: CostRow) {
        return row.id;
    }

    onSave() {
        // Solo se mandan los costos que realmente cambiaron.
        this.save.emit(this.changed.map(row => ({ id: row.id, cost: Number(row.cost) })));
    }
}
