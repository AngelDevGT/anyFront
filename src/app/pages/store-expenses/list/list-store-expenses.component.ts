import { Component, OnInit } from '@angular/core';

import { AlertService, DataService } from '@app/services';
import { first } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { StoreExpense } from '@app/models/store/store-expense.model';
import { OPERATOR_CHIP_COLOR, parseExpenseTags } from '@app/helpers';

@Component({
    templateUrl: 'list-store-expenses.component.html',
    styleUrls: ['list-store-expenses.component.scss']
})
export class ListStoreExpensesComponent implements OnInit {

    establishmentId?: string;
    /** Sin tienda en la ruta no se consulta nada. */
    storeSelected = false;
    expenses?: StoreExpense[];
    allExpenses?: StoreExpense[];
    searchTerm?: string;
    pageSize = this.dataService.defaultPageSize;
    tableElementsValues?: any;

    constructor(
        private readonly dataService: DataService,
        private readonly route: ActivatedRoute,
        private readonly alertService: AlertService,
        private readonly router: Router
    ) {}

    ngOnInit() {
        // La tienda viaja en la ruta y ya viene filtrada por el listado de tiendas
        this.route.paramMap.subscribe(params => this.onStoreChange(params.get('id') ?? undefined));
    }

    private onStoreChange(establishmentId?: string) {
        this.storeSelected = !!establishmentId;
        this.establishmentId = establishmentId;

        if (!establishmentId) {
            this.expenses = undefined;
            this.allExpenses = undefined;
            this.tableElementsValues = [];
            return;
        }
        this.loadExpenses(establishmentId);
    }

    private loadExpenses(establishmentId: string) {
        this.expenses = undefined;
        this.allExpenses = undefined;
        this.searchTerm = undefined;

        this.dataService.getAllStoreExpenses({ establishment_id: establishmentId })
            .pipe(first())
            .subscribe({
                next: (result: any) => {
                    this.expenses = this.dataService.findJsonValue(result, 'json_result') || [];
                    this.allExpenses = this.expenses;
                },
                error: (e) => console.error('Error al cargar gastos', e),
                complete: () => {
                    // Del más reciente al más antiguo, por la fecha que se muestra: la de creación
                    this.expenses = this.expenses?.sort((a, b) =>
                        new Date(b.creationDate!).getTime() - new Date(a.creationDate!).getTime()
                    );
                    this.setTableElements(this.expenses);
                }
            });
    }

    search(): void {
        if (this.allExpenses) {
            this.expenses = this.allExpenses.filter(val => {
                if (this.searchTerm) {
                    const term = this.searchTerm.toLowerCase();
                    return (
                        val.title?.toLowerCase().includes(term) ||
                        val.supplier?.toLowerCase().includes(term) ||
                        val.comment?.toLowerCase().includes(term) ||
                        val.nit?.toLowerCase().includes(term)
                    );
                }
                return true;
            });
        }
        this.setTableElements(this.expenses);
    }

    setTableElements(elements?: StoreExpense[]) {
        this.tableElementsValues = [];
        elements?.forEach((element: StoreExpense) => {
            const curr_row = [
                // Fecha y hora en que se registró el gasto
                { type: 'text', value: this.formatDateTime(element.creationDate), header_name: 'Fecha' },
                // Las etiquetas viven en title, una por línea: una pastilla por etiqueta. `value` lleva
                // el texto unido para que la columna se pueda ordenar.
                {
                    type: 'chips',
                    value: parseExpenseTags(element.title).join(', '),
                    values: parseExpenseTags(element.title),
                    bg_color: OPERATOR_CHIP_COLOR.bg_color,
                    color: OPERATOR_CHIP_COLOR.color,
                    header_name: 'Etiquetas'
                },
                { type: 'text', value: this.dataService.getFormatedPrice(Number(element.totalAmount)), header_name: 'Monto' },
                { type: 'text', value: element.supplier || '--', header_name: 'Proveedor' },
                { type: 'text', value: element.nit || 'C/F', header_name: 'NIT' },
                {
                    type: 'badge',
                    value: (element.status?.text || element.status?.identifier) ?? '--',
                    identifier: element.status?.identifier?.toLowerCase(),
                    bg_color: element.status?.bg_color,
                    color: element.status?.color,
                    header_name: 'Estado'
                }
            ];
            // Toda la fila abre el detalle del gasto, igual que en ventas
            (curr_row as any).rowLink = '/store/expenses/history/view/' + element.id;
            (curr_row as any).rowLinkAbsolute = true;
            this.tableElementsValues.push(curr_row);
        });
    }

    /** Las fechas de json_agg a veces llegan entrecomilladas; se limpian antes de convertir. */
    private formatDateTime(utcTime?: string): string {
        return utcTime ? this.dataService.getLocalDateTimeFromUTCTime(utcTime.replaceAll('"', '')) : '--';
    }

    createExpense() {
        this.router.navigate(['/store/expenses/create'], { queryParams: { strId: this.establishmentId } });
    }
}
