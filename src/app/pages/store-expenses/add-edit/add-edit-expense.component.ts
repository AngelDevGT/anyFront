import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { first } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { StoreExpense } from '@app/models/store/store-expense.model';
import { Establishment } from '@app/models/establishment.model';

@Component({
    selector: 'page-add-edit-expense',
    templateUrl: 'add-edit-expense.component.html',
    styleUrls: ['add-edit-expense.component.scss']
})
export class AddEditExpenseComponent implements OnInit {

    expenseForm!: FormGroup;
    expense?: StoreExpense;
    establishment?: Establishment;
    id?: string;
    establishmentId?: string;
    isEditOption = false;
    title = 'Registrar Gasto';
    loading = true;
    submitting = false;

    constructor(
        private dataService: DataService,
        private alertService: AlertService,
        private route: ActivatedRoute,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.id = this.route.snapshot.params['id'];
        this.route.queryParams.subscribe(params => {
            this.establishmentId = params['strId'];
        });

        if (this.id) {
            this.isEditOption = true;
            this.title = 'Actualizar Gasto';
            this.expenseForm = this.createEditFormGroup();
            this.dataService.getStoreExpenseById({ id: this.id })
                .pipe(first())
                .subscribe({
                    next: (res: any) => {
                        this.expense = this.dataService.findJsonValue(res, 'json_result') || {};
                        this.expenseForm.patchValue({
                            title: this.expense?.title,
                            comment: this.expense?.comment,
                            totalAmount: this.expense?.totalAmount,
                            nit: this.expense?.nit,
                            supplier: this.expense?.supplier
                        });
                        this.loading = false;
                    },
                    error: () => { this.loading = false; }
                });
        } else {
            this.dataService.getEstablishmentById(this.establishmentId!)
                .pipe(first())
                .subscribe({
                    next: (res: any) => {
                        this.establishment = this.dataService.findJsonValue(res, 'json_result') || {};
                        this.title = 'Registrar Gasto (' + this.establishment?.name + ')';
                        this.loading = false;
                    },
                    error: () => { this.loading = false; }
                });
            this.expenseForm = this.createAddFormGroup();
        }
    }

    createAddFormGroup(): FormGroup {
        return new FormGroup({
            title:       new FormControl('', [Validators.required, Validators.maxLength(40)]),
            comment:     new FormControl('', [Validators.maxLength(100)]),
            totalAmount: new FormControl('', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
            nit:         new FormControl('C/F', [Validators.maxLength(10)]),
            supplier:    new FormControl('', [Validators.maxLength(20)])
        });
    }

    createEditFormGroup(): FormGroup {
        return new FormGroup({
            title:    new FormControl('', [Validators.required, Validators.maxLength(40)]),
            comment:  new FormControl('', [Validators.maxLength(100)]),
            nit:      new FormControl('C/F', [Validators.maxLength(10)]),
            supplier: new FormControl('', [Validators.maxLength(20)])
        });
    }

    get f() { return this.expenseForm.controls; }

    onSaveForm() {
        if (this.expenseForm.invalid) return;
        this.alertService.clear();
        this.submitting = true;

        const operation = this.isEditOption ? this.saveEdit() : this.saveNew();
        operation.pipe(first()).subscribe({
            next: () => {
                this.alertService.success('Gasto guardado', { keepAfterRouteChange: true });
                const estId = this.isEditOption
                    ? this.expense?.establishment?.id
                    : this.establishmentId;
                this.router.navigateByUrl('/store/expenses/history/' + estId);
            },
            error: error => {
                const msg = this.dataService.getErrorMessageResponse(error, 'Error al guardar el gasto');
                this.alertService.error(msg);
                this.submitting = false;
            }
        });
    }

    private saveNew() {
        const payload: StoreExpense = {
            ...this.expenseForm.value,
            establishmentId: this.establishmentId
        };
        return this.dataService.addStoreExpense(payload);
    }

    private saveEdit() {
        const payload: StoreExpense = {
            ...this.expense,
            ...this.expenseForm.value
        };
        return this.dataService.updateStoreExpense(payload);
    }
}
