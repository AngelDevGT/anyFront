import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { StoreExpense } from '@app/models/store/store-expense.model';

@Component({
    selector: 'page-view-expense',
    templateUrl: 'view-expense.component.html',
    styleUrls: ['view-expense.component.scss']
})
export class ViewExpenseComponent implements OnInit {

    id?: string;
    expense?: StoreExpense;
    elements: any = [];
    loading = false;
    submitting = false;

    constructor(
        private dataService: DataService,
        private alertService: AlertService,
        private route: ActivatedRoute,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.id = this.route.snapshot.params['id'];
        this.loading = true;

        if (this.id) {
            this.dataService.getStoreExpenseById({ id: this.id })
                .pipe(first())
                .subscribe({
                    next: (res: any) => {
                        this.expense = this.dataService.findJsonValue(res, 'json_result') || {};
                        this.setElements(this.expense);
                        this.loading = false;
                    },
                    error: () => { this.loading = false; }
                });
        }
    }

    setElements(expense?: StoreExpense) {
        this.elements.push({ icon: 'receipt_long', name: 'Título',          value: expense?.title });
        this.elements.push({ icon: 'payments',     name: 'Monto Total',      value: this.dataService.getFormatedPrice(Number(expense?.totalAmount)) });
        this.elements.push({ icon: 'tag',          name: 'NIT',              value: expense?.nit || 'C/F' });
        this.elements.push({ icon: 'store',        name: 'Proveedor',        value: expense?.supplier || '--' });
        this.elements.push({ icon: 'feed',         name: 'Comentario',       value: expense?.comment || '--' });
        this.elements.push({ icon: 'info',         name: 'Estado',           value: expense?.status?.identifier });
        this.elements.push({ icon: 'calendar_today', name: 'Fecha Creación', value: this.dataService.getLocalDateTimeFromUTCTime(expense?.creationDate?.replaceAll('"', '') || '') });
        this.elements.push({ icon: 'calendar_today', name: 'Última Actualización', value: this.dataService.getLocalDateTimeFromUTCTime(expense?.updatedDate?.replaceAll('"', '') || '') });
        this.elements.push({ icon: 'badge',        name: 'Registrado por',   value: expense?.creatorUser?.name });
    }

    editExpense() {
        this.router.navigateByUrl('/store/expenses/edit/' + this.id);
    }

    deleteExpense() {
        if (!this.id) return;
        this.submitting = true;
        this.dataService.deleteStoreExpense(this.id)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Gasto eliminado', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/store/expenses/' + this.expense?.establishment?.id);
                },
                error: error => {
                    const msg = this.dataService.getErrorMessageResponse(error, 'Error al eliminar el gasto');
                    this.alertService.error(msg);
                    this.submitting = false;
                }
            });
    }
}
