import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, QueryList, SimpleChanges, ViewChildren } from '@angular/core';

/** Medida en la que se puede registrar un elemento (Libra, Quintal, Unidad, Caja...). */
export interface QuantityPickerMeasure {
    id?: string;
    identifier?: string;
    /**
     * Cuántas unidades base trae esta medida (una docena = 12 unidades). Solo hace falta cuando el
     * elemento tiene `maxBase`: con él se pasa el tope de la existencia a la medida elegida.
     */
    unitBaseQuantity?: number;
}

/** Elemento seleccionable: un producto terminado, un abarrote, una materia prima. */
export interface QuantityPickerItem {
    id?: string;
    title?: string;
    /** Texto secundario bajo el nombre (descripción). Opcional. */
    subtitle?: string;
    /** Medidas compatibles con el elemento. Con una sola, queda preseleccionada. */
    measures?: QuantityPickerMeasure[];
    /**
     * Existencia disponible, en UNIDAD BASE. Con ella la cantidad no puede pasar de lo que hay
     * (ver `limitMode`) y una existencia de 0 o menos deshabilita la fila. Sin ella no hay tope.
     */
    maxBase?: number;
    /** Existencia para mostrar bajo el nombre ("12 Unidad"). Opcional. */
    stockText?: string;
    /** En qué se cuenta el descuento de esta fila ("docena", "libra"). Se muestra bajo la casilla. */
    discountUnit?: string;
}

/** Fila con cantidad válida: es lo único que sale del componente. */
export interface QuantityPickerSelection {
    id?: string;
    title?: string;
    measure?: QuantityPickerMeasure;
    quantity: number;
    /** Solo con `showDiscount`. 0 si la casilla está vacía. */
    discount?: number;
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
    /** Texto de la casilla de descuento (solo con `showDiscount`). */
    discountInput: string;
    maxBase?: number;
    stockText?: string;
    discountUnit?: string;
    /** La cantidad escrita pasó de la existencia y se recortó (solo con `limitMode = 'clamp'`). */
    clamped?: boolean;
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
 * Uso básico:
 *   <app-element-quantity-picker #picker
 *       [items]="pickerItems"
 *       [availableTitle]="'Abarrotes'"
 *       [selectedTitle]="'Abarrotes a registrar'"
 *       (selectionChange)="selection = $event">
 *   </app-element-quantity-picker>
 *
 * El host guarda `selection` y deshabilita su botón con
 * `!selection.length || picker.hasInvalid`.
 *
 * Opciones (todas apagadas por defecto, así que las pantallas que ya lo usan no cambian):
 *   - `showDiscount`: columna de descuento por fila.
 *   - `maxBase` en el elemento + `limitMode`: tope de existencia. 'flag' marca la fila en rojo y
 *     bloquea el guardado; 'clamp' recorta la cantidad a lo disponible al escribir.
 *   - `initial`: filas ya llenas al abrir (editar un pedido, vender un pedido).
 *   - `showSummary = false`: oculta el panel derecho cuando el host muestra la selección a su
 *     manera (el carrito de Registrar venta). La tabla ocupa todo el ancho.
 *   - `rowValidator`: regla propia del host por fila (ej. descuento mayor al total).
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

    /** Agrega la columna de descuento. */
    @Input() showDiscount = false;
    @Input() discountLabel = 'Descuento';
    /** Muestra el panel derecho con el resumen. */
    @Input() showSummary = true;
    /** Qué hacer cuando la cantidad pasa de la existencia (`maxBase`). */
    @Input() limitMode: 'flag' | 'clamp' = 'flag';
    /** Filas que arrancan llenas. Se aplican al recibir `items` o al cambiar este arreglo. */
    @Input() initial: QuantityPickerSelection[] = [];
    /**
     * Regla propia del host. Recibe la fila ya con cantidad válida y devuelve el mensaje de error,
     * o null si está bien. La fila con error bloquea el guardado igual que una mal escrita.
     */
    @Input() rowValidator?: (selection: QuantityPickerSelection) => string | null;

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
        if (changes['items'] || changes['initial']) {
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
                    input: '',
                    discountInput: '',
                    maxBase: item.maxBase,
                    stockText: item.stockText,
                    discountUnit: item.discountUnit
                } as PickerRow;
            })
            .sort((a, b) => a.title.localeCompare(b.title, 'es'));
        this.applyInitial();
        this.applyFilter();

        if (this.hasInitial) {
            // Con filas precargadas el host necesita enterarse, pero no se puede emitir desde
            // ngOnChanges: escribiría en el host a mitad de su propio ciclo de detección de
            // cambios. Se emite en el siguiente turno.
            this.refreshSelection(false);
            Promise.resolve().then(() => this.refreshSelection(true));
            return;
        }
        // Sin emitir: la selección recién reconstruida siempre está vacía, y emitir
        // desde ngOnChanges escribiría en el host a mitad de su propio ciclo de
        // detección de cambios.
        this.refreshSelection(false);
    }

    private get hasInitial(): boolean {
        return (this.initial || []).length > 0;
    }

    /** Llena las filas que coinciden con `initial`. Una medida que el elemento no admite se ignora. */
    private applyInitial() {
        for (const selection of this.initial || []) {
            const row = this.rows.find(r => r.id === selection.id);
            if (!row) continue;
            const measureId = selection.measure?.id != null ? String(selection.measure.id) : '';
            if (measureId && row.measures.some(m => String(m.id) === measureId)) {
                row.measureId = measureId;
            }
            row.input = selection.quantity ? String(selection.quantity) : '';
            row.discountInput = selection.discount ? String(selection.discount) : '';
            this.applyLimit(row);
        }
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

    /** Descuento escrito en la fila, o 0 si está vacío o mal escrito. */
    discountOf(row: PickerRow): number {
        const value = (row.discountInput || '').trim();
        if (!value || !this.quantityPattern.test(value)) return 0;
        return Number(value);
    }

    measureOf(row: PickerRow): QuantityPickerMeasure | undefined {
        return row.measures.find(measure => String(measure.id) === row.measureId);
    }

    measureLabel(row: PickerRow): string {
        return this.measureOf(row)?.identifier || '';
    }

    // ── Existencia ───────────────────────────────────────────────────────────

    /** Sin existencia: la fila no admite cantidad. Solo aplica a elementos con `maxBase`. */
    isOutOfStock(row: PickerRow): boolean {
        return row.maxBase !== undefined && row.maxBase !== null && row.maxBase <= 0;
    }

    /**
     * Lo máximo que se puede escribir en la medida elegida, redondeado hacia abajo a 2 decimales
     * (el máximo que acepta la cantidad). Infinity si el elemento no tiene tope o todavía no se
     * eligió medida con la que convertirlo.
     */
    maxQuantityOf(row: PickerRow): number {
        if (row.maxBase === undefined || row.maxBase === null) return Infinity;
        const base = Number(this.measureOf(row)?.unitBaseQuantity);
        if (!base || base <= 0) return Infinity;
        return Math.max(0, Math.floor((row.maxBase / base) * 100) / 100);
    }

    private exceedsMax(row: PickerRow): boolean {
        return this.quantityOf(row) > this.maxQuantityOf(row);
    }

    /** En modo 'clamp', baja la cantidad a lo disponible. Se llama al escribir y al cambiar la medida. */
    private applyLimit(row: PickerRow) {
        row.clamped = false;
        if (this.limitMode !== 'clamp' || !this.exceedsMax(row)) return;
        const max = this.maxQuantityOf(row);
        row.input = max > 0 ? String(max) : '';
        row.clamped = true;
    }

    // ── Validación ───────────────────────────────────────────────────────────

    isInvalid(row: PickerRow): boolean {
        return this.errorFor(row) !== '';
    }

    errorFor(row: PickerRow): string {
        const value = (row.input || '').trim();
        const discount = (row.discountInput || '').trim();

        if (value && !this.quantityPattern.test(value)) {
            return 'Solo números positivos, máximo dos decimales';
        }
        // Una cantidad sin medida no se puede mandar al backend.
        if (value && Number(value) > 0 && !row.measureId) {
            return 'Selecciona la medida';
        }
        if (this.limitMode === 'flag' && this.exceedsMax(row)) {
            return 'Máximo disponible: ' + this.maxQuantityOf(row);
        }
        if (discount && !this.quantityPattern.test(discount)) {
            return 'Descuento: solo números positivos, máximo dos decimales';
        }
        if (this.rowValidator && this.quantityOf(row) > 0) {
            return this.rowValidator(this.toSelection(row)) || '';
        }
        return '';
    }

    /** Lo consulta el host para no dejar guardar con filas a medias. */
    get hasInvalid(): boolean {
        return this.rows.some(row => this.isInvalid(row));
    }

    // ── Cambios en la fila ───────────────────────────────────────────────────

    onQuantityChange(row: PickerRow) {
        this.applyLimit(row);
        this.refreshSelection();
    }

    onMeasureChange(row: PickerRow) {
        // El tope depende de la medida: una docena admite menos que unidades
        this.applyLimit(row);
        this.refreshSelection();
    }

    onDiscountChange(row: PickerRow) {
        this.refreshSelection();
    }

    /** Quita una fila del resumen dejándola en blanco. */
    remove(row: PickerRow) {
        row.input = '';
        row.discountInput = '';
        row.clamped = false;
        this.refreshSelection();
    }

    /** Quita una fila por el id del elemento; para el host que muestra la selección por su cuenta. */
    removeById(id?: string) {
        const row = this.rows.find(r => r.id === id);
        if (row) this.remove(row);
    }

    /** Lleva al usuario a la casilla de una fila por el id del elemento. */
    focusById(id?: string) {
        const row = this.rows.find(r => r.id === id);
        if (row) this.focusRow(row);
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

    private toSelection(row: PickerRow): QuantityPickerSelection {
        return {
            id: row.id,
            title: row.title,
            measure: this.measureOf(row),
            quantity: this.quantityOf(row),
            ...(this.showDiscount ? { discount: this.discountOf(row) } : {})
        };
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
        this.selectionChange.emit(this.selected.map(row => this.toSelection(row)));
    }

    trackById(index: number, row: PickerRow) {
        return row.id;
    }
}
