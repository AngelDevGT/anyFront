import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, QueryList, SimpleChanges, ViewChildren } from '@angular/core';

/** Medida en la que se puede registrar un elemento (Libra, Quintal, Unidad, Caja...). */
export interface QuantityPickerMeasure {
    id?: string;
    identifier?: string;
}

/** Elemento seleccionable: un producto terminado, un abarrote, una materia prima. */
export interface QuantityPickerItem {
    id?: string;
    title?: string;
    /** Texto secundario bajo el nombre (descripción). Opcional. */
    subtitle?: string;
    /** Medidas compatibles con el elemento. Con una sola, queda preseleccionada. */
    measures?: QuantityPickerMeasure[];
}

/** Fila con cantidad válida: es lo único que sale del componente. */
export interface QuantityPickerSelection {
    id?: string;
    title?: string;
    measure?: QuantityPickerMeasure;
    quantity: number;
}

/** Fila de trabajo interna: el estado editable vive acá, no en el host. */
interface PickerRow {
    id?: string;
    title: string;
    subtitle?: string;
    measures: QuantityPickerMeasure[];
    measureId: string;
    /** Texto de la casilla de cantidad. */
    input: string;
    /**
     * Turno en que el usuario empezó a llenar la fila. Ordena el panel de resumen
     * por orden de selección y no por el orden de la tabla de la izquierda.
     * Se asigna al escribir la primera vez y solo se suelta al dejar la fila en
     * blanco: así corregir una cantidad no manda la fila al final de la lista.
     */
    order?: number;
}

/**
 * Selector de elementos con cantidad en línea, en dos paneles.
 *
 * Izquierda: todos los elementos, con su medida y una casilla de cantidad por fila.
 * Derecha: resumen en vivo de las filas con cantidad, para revisar antes de guardar.
 *
 * Reemplaza el patrón de "un modal por elemento": cargar quince productos eran
 * quince aperturas de modal. Además, al no mover elementos entre arreglos no hay
 * modo edición ni índices que sincronizar — se corrige escribiendo en la fila.
 *
 * Uso:
 *   <app-element-quantity-picker #picker
 *       [items]="pickerItems"
 *       [availableTitle]="'Abarrotes'"
 *       [selectedTitle]="'Abarrotes a registrar'"
 *       (selectionChange)="selection = $event">
 *   </app-element-quantity-picker>
 *
 * El host guarda `selection` y deshabilita su botón con
 * `!selection.length || picker.hasInvalid`.
 */
@Component({
    selector: 'app-element-quantity-picker',
    templateUrl: './element-quantity-picker.component.html',
    styleUrls: ['./element-quantity-picker.component.scss']
})
export class ElementQuantityPickerComponent implements OnChanges {

    @Input() items: QuantityPickerItem[] = [];
    @Input() availableTitle = 'Disponibles';
    @Input() selectedTitle = 'Seleccionados';
    @Input() searchPlaceholder = 'Buscar';
    @Input() emptyAvailableText = 'No hay elementos disponibles.';
    @Input() emptySelectedText = 'Escribe una cantidad para agregar elementos.';
    @Input() quantityLabel = 'Cantidad';
    @Input() disabled = false;

    @Output() selectionChange = new EventEmitter<QuantityPickerSelection[]>();

    /** Casillas de cantidad pintadas, en el mismo orden que `filtered`. */
    @ViewChildren('quantityInput') quantityInputs!: QueryList<ElementRef<HTMLInputElement>>;

    // Mismo patrón de cantidad que el resto de la app.
    private readonly quantityPattern = /^\d+(\.\d{1,2})?$/;

    /** Contador para `PickerRow.order`. */
    private orderSeq = 0;

    rows: PickerRow[] = [];

    /**
     * Campos, no getters: un getter que filtra devuelve un arreglo nuevo en cada
     * ciclo de detección de cambios y, con `trackBy` o sin él, hace trabajo de más
     * en cada tecleo. Se recalculan solo cuando cambia lo que los afecta.
     */
    filtered: PickerRow[] = [];
    selected: PickerRow[] = [];

    searchTerm = '';

    ngOnChanges(changes: SimpleChanges) {
        if (changes['items']) {
            this.reset();
        }
    }

    /** Reconstruye las filas a partir de los items y limpia lo escrito. */
    reset() {
        this.searchTerm = '';
        this.orderSeq = 0;
        this.rows = (this.items || [])
            .map(item => {
                const measures = item.measures || [];
                return {
                    id: item.id,
                    title: item.title || '',
                    subtitle: item.subtitle,
                    measures,
                    // Con una sola medida compatible no hay nada que elegir.
                    measureId: measures.length === 1 ? String(measures[0].id) : '',
                    input: ''
                };
            })
            .sort((a, b) => a.title.localeCompare(b.title, 'es'));
        this.applyFilter();
        // Sin emitir: la selección recién reconstruida siempre está vacía, y emitir
        // desde ngOnChanges escribiría en el host a mitad de su propio ciclo de
        // detección de cambios.
        this.refreshSelection(false);
    }

    onSearchChange(term: string) {
        this.searchTerm = term || '';
        this.applyFilter();
    }

    private applyFilter() {
        const term = this.searchTerm.trim().toLowerCase();
        if (!term) {
            this.filtered = this.rows;
            return;
        }
        this.filtered = this.rows.filter(row =>
            row.title.toLowerCase().includes(term) ||
            (row.subtitle || '').toLowerCase().includes(term)
        );
    }

    /** Cantidad escrita en la fila, o 0 si está vacía o mal escrita. */
    quantityOf(row: PickerRow): number {
        const value = (row.input || '').trim();
        if (!value || !this.quantityPattern.test(value)) return 0;
        return Number(value);
    }

    measureOf(row: PickerRow): QuantityPickerMeasure | undefined {
        return row.measures.find(measure => String(measure.id) === row.measureId);
    }

    measureLabel(row: PickerRow): string {
        return this.measureOf(row)?.identifier || '';
    }

    isInvalid(row: PickerRow): boolean {
        const value = (row.input || '').trim();
        if (!value) return false;
        if (!this.quantityPattern.test(value)) return true;
        // Una cantidad sin medida no se puede mandar al backend.
        return Number(value) > 0 && !row.measureId;
    }

    errorFor(row: PickerRow): string {
        const value = (row.input || '').trim();
        if (!this.quantityPattern.test(value)) {
            return 'Solo números positivos, máximo dos decimales';
        }
        return 'Selecciona la medida';
    }

    /** Lo consulta el host para no dejar guardar con filas a medias. */
    get hasInvalid(): boolean {
        return this.rows.some(row => this.isInvalid(row));
    }

    /** Quita una fila del resumen dejándola en blanco. */
    remove(row: PickerRow) {
        row.input = '';
        this.refreshSelection();
    }

    /**
     * Lleva al usuario a la casilla de cantidad de la fila, desde el resumen.
     * Si la búsqueda dejó la fila fuera de la tabla, primero la limpia: el input no
     * existe en el DOM mientras la fila esté filtrada.
     */
    focusRow(row: PickerRow) {
        if (!this.filtered.includes(row)) {
            this.onSearchChange('');
        }
        // Esperar a que *ngFor pinte la fila antes de buscar su casilla.
        setTimeout(() => {
            const input = this.quantityInputs.get(this.filtered.indexOf(row))?.nativeElement;
            if (!input) return;
            input.focus({ preventScroll: true });
            input.select();
            this.scrollIntoViewBelowHeader(input);
        });
    }

    /**
     * Deja la fila visible sin que el encabezado la tape. El `thead` es sticky y
     * flota sobre el contenido, así que `scrollIntoView` la dejaba justo debajo:
     * `scroll-margin-top` reserva ese alto al calcular el destino del scroll.
     *
     * El alto se mide en vez de codificarse para que se ajuste solo si cambia el
     * estilo del encabezado, y para que en móvil —donde `thead` va oculto y la fila
     * pasa a ser tarjeta— quede en 0 sin ningún caso especial.
     */
    private scrollIntoViewBelowHeader(input: HTMLInputElement) {
        const target = (input.closest('tr') as HTMLElement) || input;
        const head = input.closest('.eqp__scroll')?.querySelector('thead') as HTMLElement | null;
        target.style.scrollMarginTop = (head?.offsetHeight || 0) + 'px';
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    refreshSelection(emit = true) {
        this.rows.forEach(row => {
            // El turno se toma al escribir, no al quedar válida: mientras la fila
            // tenga algo escrito conserva su lugar en el resumen.
            const hasInput = (row.input || '').trim().length > 0;
            if (!hasInput) {
                row.order = undefined;
            } else if (row.order == null) {
                row.order = ++this.orderSeq;
            }
        });
        this.selected = this.rows
            .filter(row => !this.isInvalid(row) && this.quantityOf(row) > 0)
            .sort((a, b) => a.order! - b.order!);
        if (!emit) return;
        this.selectionChange.emit(this.selected.map(row => ({
            id: row.id,
            title: row.title,
            measure: this.measureOf(row),
            quantity: this.quantityOf(row)
        })));
    }

    trackById(index: number, row: PickerRow) {
        return row.id;
    }
}
