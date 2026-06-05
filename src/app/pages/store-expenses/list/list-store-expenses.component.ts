import { Component, OnInit } from '@angular/core';

import { AlertService, DataService } from '@app/services';
import { forkJoin } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { StoreExpense } from '@app/models/store/store-expense.model';
import { Establishment } from '@app/models/establishment.model';

@Component({
    templateUrl: 'list-store-expenses.component.html',
    styleUrls: ['list-store-expenses.component.scss']
})
export class ListStoreExpensesComponent implements OnInit {

    establishment?: Establishment;
    expenses?: StoreExpense[];
    allExpenses?: StoreExpense[];
    searchTerm?: string;
    entries = this.dataService.tableEntries;
    pageSize = this.dataService.defaultPageSize;
    page = 1;
    tableElementsValues?: any;

    constructor(
        private dataService: DataService,
        private route: ActivatedRoute,
        private alertService: AlertService,
        private router: Router
    ) {}

    ngOnInit() {
        const establishmentId = this.route.snapshot.params['id'];

        forkJoin([
            this.dataService.getAllStoreExpenses({ establishment_id: establishmentId }),
            this.dataService.getEstablishmentById(establishmentId)
        ]).subscribe({
            next: (result: any) => {
                this.expenses = this.dataService.findJsonValue(result[0], 'json_result') || [];
                this.allExpenses = this.expenses;
                this.establishment = this.dataService.findJsonValue(result[1], 'json_result') || {};
            },
            error: (e) => console.error('Error al cargar gastos', e),
            complete: () => {
                this.expenses = this.expenses?.sort((a, b) => {
                    const dateA = new Date(a.updatedDate!);
                    const dateB = new Date(b.updatedDate!);
                    return dateB.getTime() - dateA.getTime();
                });
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
                { type: 'text', value: this.dataService.getLocalDateFromUTCTime(element.updatedDate!), header_name: 'Fecha', style: 'width: 12%', rows_bg_color: element.status?.bg_color, rows_color: element.status?.color },
                { type: 'text', value: element.title, header_name: 'Título', style: 'width: 20%' },
                { type: 'text', value: this.dataService.getFormatedPrice(Number(element.totalAmount)), header_name: 'Monto', style: 'width: 12%' },
                { type: 'text', value: element.supplier || '--', header_name: 'Proveedor', style: 'width: 15%' },
                { type: 'text', value: element.nit || 'C/F', header_name: 'NIT', style: 'width: 10%' },
                { type: 'text', value: element.comment || '--', header_name: 'Comentario', style: 'width: 20%' },
                {
                    type: 'button',
                    style: 'white-space: nowrap; width: 11%',
                    value: undefined,
                    header_name: 'Acciones',
                    button: [
                        {
                            type: 'button',
                            routerLink: '/store/expenses/view/' + element.id,
                            is_absolute: true,
                            class: 'btn btn-success btn-sm pb-0 mx-1',
                            icon: { class: 'material-icons', icon: 'visibility' }
                        }
                    ]
                }
            ];
            this.tableElementsValues.push(curr_row);
        });
    }

    createExpense() {
        this.router.navigate(['/store/expenses/create'], { queryParams: { strId: this.establishment?.id } });
    }
}
