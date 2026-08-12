import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { DateRange } from '@angular/material/datepicker';

/**
 * Filtro de rango de fechas de los listados: boton con el rango aplicado y un panel con calendario
 * que no busca hasta que se presiona "Buscar".
 *
 * El mismo bloque estaba repetido en cuatro pantallas (listados de pedidos de fabrica y tienda,
 * tablero y ventas). Acá vive una sola vez; el contenedor solo recibe el rango ya validado.
 */
@Component({
    selector: 'date-range-filter',
    templateUrl: './date-range-filter.component.html',
    styleUrls: ['./date-range-filter.component.scss']
})
export class DateRangeFilterComponent implements OnChanges {
    /** Rango actualmente aplicado por el contenedor; el panel siempre parte de aca. */
    @Input() start?: Date;
    @Input() end?: Date;
    @Input() maxDate = new Date();
    /** Dias hacia atras del rango por defecto, el mismo valor que se le pasa a DateRangeState. */
    @Input() defaultDays = 14;
    @Input() label = 'Fecha';

    @Output() rangeApply = new EventEmitter<{ start: Date, end: Date }>();

    panelOpen = false;
    selectedRange: DateRange<Date> | null = null;
    validationError = '';

    ngOnChanges(changes: SimpleChanges) {
        if (changes['start'] || changes['end']) {
            this.selectedRange = new DateRange<Date>(this.start ?? null, this.end ?? null);
        }
    }

    get rangeLabel(): string {
        if (!this.start || !this.end) return '';
        return `${this.start.toLocaleDateString('es-GT')} - ${this.end.toLocaleDateString('es-GT')}`;
    }

    get resetLabel(): string {
        return `Últimos ${this.defaultDays + 1} días`;
    }

    /** Los clics de adentro no deben llegar al document, que es quien cierra el panel. */
    @HostListener('click', ['$event'])
    onHostClick(event: Event) {
        event.stopPropagation();
    }

    @HostListener('document:click')
    onDocumentClick() {
        this.panelOpen = false;
    }

    @HostListener('document:keydown.escape')
    onEscape() {
        this.panelOpen = false;
    }

    togglePanel() {
        this.panelOpen = !this.panelOpen;
        if (this.panelOpen) {
            this.validationError = '';
            this.selectedRange = new DateRange<Date>(this.start ?? null, this.end ?? null);
        }
    }

    closePanel() {
        this.panelOpen = false;
    }

    /** Primer clic fija el inicio; el segundo cierra el rango salvo que sea anterior al inicio. */
    onDateChange(date: Date | null) {
        if (!date) return;
        this.validationError = '';
        const start = this.selectedRange?.start ?? null;
        const end = this.selectedRange?.end ?? null;
        if (!start || end || date < start) {
            this.selectedRange = new DateRange<Date>(date, null);
        } else {
            this.selectedRange = new DateRange<Date>(start, date);
        }
    }

    resetRange() {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - this.defaultDays);
        this.validationError = '';
        this.selectedRange = new DateRange<Date>(start, end);
    }

    applyRange() {
        if (!this.selectedRange?.start || !this.selectedRange?.end) {
            this.validationError = 'Selecciona una fecha de inicio y una de fin';
            return;
        }
        this.validationError = '';
        this.panelOpen = false;
        this.rangeApply.emit({ start: this.selectedRange.start, end: this.selectedRange.end });
    }
}
