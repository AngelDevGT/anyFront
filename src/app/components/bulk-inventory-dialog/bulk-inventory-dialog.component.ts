import { Component, EventEmitter, Input, Output } from '@angular/core';

/** Producto del inventario que se puede mover desde el diálogo. */
export interface InventoryActionItem {
    id: string;
    title?: string;
    /** Medida del elemento de inventario. La cantidad se envía al backend en esta unidad. */
    measureId?: string;
    /** Nombre de la unidad base (Unidad / Libra). Solo se usa para etiquetar las cantidades. */
    unitName?: string;
    /** Cantidad actual en inventario, en la unidad de `measureId`. */
    quantity: number;
}

export type InventoryActionKey = 'add' | 'remove' | 'return';

/** Lo que se emite al guardar: una sola acción y un solo comentario para todas las filas tocadas. */
export interface BulkInventoryAction {
    action: InventoryActionKey;
    comment: string;
    items: { id: string, measureId?: string, quantity: number }[];
}

/** Fila de trabajo interna: conserva la cantidad original para calcular la nueva. */
interface InventoryActionRow {
    id: string;
    title?: string;
    measureId?: string;
    unitName?: string;
    original: number;
    /** Texto de la casilla: cantidad a agregar, eliminar o devolver. */
    input: string;
}

/**
 * Diálogo reutilizable de acciones masivas de inventario.
 *
 * Uso:
 *   <app-bulk-inventory-dialog
 *       [items]="inventoryActionItems"          // { id, title, measureId, unitName, quantity }
 *       [title]="'Acciones de inventario'"
 *       [modalId]="'bulkInventoryStorePFS'"     // único por instancia en la vista
 *       [saving]="savingInventoryActions"
 *       (save)="onSaveInventoryActions($event)"> // { action, comment, items } solo con lo modificado
 *   </app-bulk-inventory-dialog>
 *
 * El host traduce la acción al endpoint que corresponda y recarga el listado.
 */
@Component({
    selector: 'app-bulk-inventory-dialog',
    templateUrl: './bulk-inventory-dialog.component.html',
    styleUrls: ['./bulk-inventory-dialog.component.scss']
})
export class BulkInventoryDialogComponent {
    @Input() items: InventoryActionItem[] = [];
    @Input() title = 'Acciones de inventario';
    @Input() modalId = 'bulkInventoryModal';
    @Input() saving = false;
    @Input() disabled = false;
    /**
     * Acciones que ofrece el diálogo. Los inventarios de fábrica y bodega solo agregan y
     * eliminan; devolver a bodega únicamente tiene sentido desde el inventario de tienda.
     */
    @Input() availableActions: InventoryActionKey[] = ['add', 'remove', 'return'];
    @Output() save = new EventEmitter<BulkInventoryAction>();

    // Mismo patrón de validación que el resto de campos de cantidad de la app.
    private readonly quantityPattern = /^\d+(\.\d{1,2})?$/;
    readonly commentMaxLength = 200;

    private readonly allActions: { key: InventoryActionKey, label: string, icon: string, verb: string }[] = [
        { key: 'add', label: 'Agregar', icon: 'add_circle', verb: 'agregar' },
        { key: 'remove', label: 'Eliminar', icon: 'remove_circle', verb: 'eliminar' },
        { key: 'return', label: 'Devolver', icon: 'undo', verb: 'devolver' }
    ];

    get actions() {
        return this.allActions.filter(action => this.availableActions.includes(action.key));
    }

    selectedAction: InventoryActionKey = 'add';
    // Copia de trabajo: permite cancelar sin afectar el inventario mostrado en la tabla.
    working: InventoryActionRow[] = [];
    searchTerm = '';
    comment = '';

    open() {
        this.searchTerm = '';
        this.comment = '';
        this.selectedAction = this.actions[0]?.key ?? 'add';
        this.working = (this.items || []).map(item => ({
            id: item.id,
            title: item.title,
            measureId: item.measureId,
            unitName: item.unitName,
            original: Number(item.quantity) || 0,
            input: ''
        }));
    }

    /**
     * Cambiar de acción borra todas las cantidades escritas: lo que era válido para agregar
     * puede pasarse del disponible al eliminar, y mezclar ambas cosas se presta a errores.
     */
    setAction(action: InventoryActionKey) {
        if (this.selectedAction === action) return;
        this.selectedAction = action;
        this.working.forEach(row => row.input = '');
    }

    get currentAction() {
        return this.allActions.find(action => action.key === this.selectedAction)!;
    }

    /** Eliminar y devolver restan del inventario; agregar suma. */
    get isSubtraction(): boolean {
        return this.selectedAction !== 'add';
    }

    get filtered(): InventoryActionRow[] {
        const term = this.searchTerm?.trim().toLowerCase();
        if (!term) return this.working;
        return this.working.filter(row => (row.title || '').toLowerCase().includes(term));
    }

    quantityOf(row: InventoryActionRow): number {
        const value = (row.input || '').trim();
        if (!value || !this.quantityPattern.test(value)) return 0;
        return Number(value);
    }

    /** Cantidad con la que queda el inventario si se guarda tal como está la fila. */
    newQuantity(row: InventoryActionRow): number {
        const quantity = this.quantityOf(row);
        return this.isSubtraction ? row.original - quantity : row.original + quantity;
    }

    /** Pinta la cantidad nueva con el color de la acción, y solo si la fila tiene algo escrito. */
    newQuantityClass(row: InventoryActionRow): string {
        return this.quantityOf(row) > 0 ? 'bulk-inv__quantity--' + this.selectedAction : '';
    }

    isInvalid(row: InventoryActionRow): boolean {
        const value = (row.input || '').trim();
        if (!value) return false;
        if (!this.quantityPattern.test(value)) return true;
        // No se puede sacar del inventario más de lo que hay.
        return this.isSubtraction && Number(value) > row.original;
    }

    errorFor(row: InventoryActionRow): string {
        const value = (row.input || '').trim();
        if (!this.quantityPattern.test(value)) {
            return 'Solo números positivos, máximo dos decimales';
        }
        return 'No hay suficiente cantidad disponible';
    }

    get hasInvalid(): boolean {
        return this.working.some(row => this.isInvalid(row));
    }

    /** Filas con una cantidad válida mayor a cero: son las únicas que se mandan. */
    get changed(): InventoryActionRow[] {
        return this.working.filter(row => !this.isInvalid(row) && this.quantityOf(row) > 0);
    }

    get commentInvalid(): boolean {
        return !this.comment.trim();
    }

    get canSave(): boolean {
        return !this.saving && !this.hasInvalid && !this.commentInvalid && !!this.changed.length;
    }

    trackById(index: number, row: InventoryActionRow) {
        return row.id;
    }

    onSave() {
        if (!this.canSave) return;
        this.save.emit({
            action: this.selectedAction,
            comment: this.comment.trim(),
            items: this.changed.map(row => ({
                id: row.id,
                measureId: row.measureId,
                quantity: this.quantityOf(row)
            }))
        });
    }
}
