import { Component, OnInit } from '@angular/core';

import { AlertService, DataService, StoreContextService } from '@app/services';
import { first, switchMap } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { StoreExpense } from '@app/models/store/store-expense.model';
import { Establishment } from '@app/models/establishment.model';

@Component({
    templateUrl: 'list-store-expenses.component.html',
    styleUrls: ['list-store-expenses.component.scss']
})
export class ListStoreExpensesComponent implements OnInit {

    establishmentId?: string;
    storeName?: string;
    /** Sin tienda elegida no se consulta nada: la pantalla muestra el selector en grande. */
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
        private readonly router: Router,
        private readonly storeContext: StoreContextService
    ) {}

    ngOnInit() {
        // La tienda viaja en la ruta: al cambiarla desde el selector se navega a esta misma sección
        // con otra tienda y Angular reutiliza el componente, así que ngOnInit ya no vuelve a correr.
        this.route.paramMap
            .pipe(switchMap(params => this.storeContext.resolveFromRoute(params.get('id'))))
            .subscribe(store => this.onStoreChange(store));
    }

    private onStoreChange(store?: Establishment) {
        this.storeSelected = !!store?.id;
        this.establishmentId = store?.id;
        this.storeName = store?.name;

        if (!store?.id) {
            this.expenses = undefined;
            this.allExpenses = undefined;
            this.tableElementsValues = [];
            return;
        }
        this.loadExpenses(store.id);
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
                    this.expenses = this.expenses?.sort((a, b) =>
                        new Date(b.updatedDate!).getTime() - new Date(a.updatedDate!).getTime()
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
                { type: 'text', value: this.dataService.getLocalDateFromUTCTime(element.updatedDate!), header_name: 'Fecha' },
                { type: 'text', value: element.title, header_name: 'Título' },
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
                },
                {
                    type: 'button',
                    header_name: 'Acciones',
                    button: [
                        {
                            type: 'button',
                            routerLink: '/store/expenses/history/view/' + element.id,
                            is_absolute: true,
                            colorClass: 'dt-btn-view',
                            icon: { class: 'material-icons', icon: 'visibility' }
                        }
                    ]
                }
            ];
            this.tableElementsValues.push(curr_row);
        });
    }

    createExpense() {
        this.router.navigate(['/store/expenses/create'], { queryParams: { strId: this.establishmentId } });
    }
}
