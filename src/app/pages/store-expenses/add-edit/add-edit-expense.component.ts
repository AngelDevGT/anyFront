import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { first } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { StoreExpense } from '@app/models/store/store-expense.model';
import { Establishment } from '@app/models/establishment.model';
import { OPERATOR_CHIP_COLOR, parseExpenseTags, serializeExpenseTags } from '@app/helpers';

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

    /**
     * Etiquetas del gasto. Reemplazan a la descripción libre: se guardan en store_expense.title,
     * una por línea. Las del catálogo salen de establishment.expenseTags; una nueva escrita acá
     * queda solo en este gasto.
     */
    expenseTags: string[] = [];
    expenseTagOptions: string[] = [];
    readonly tagChipColor = OPERATOR_CHIP_COLOR;

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
                        // Un gasto anterior a las etiquetas trae su descripción como una sola línea:
                        // se muestra como una única etiqueta
                        this.expenseTags = parseExpenseTags(this.expense?.title);
                        this.loadExpenseTagOptions(this.expense?.establishment?.id);
                        this.expenseForm.patchValue({
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
                        this.expenseTagOptions = parseExpenseTags(this.establishment?.expenseTags);
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
            comment:     new FormControl('', [Validators.maxLength(100)]),
            totalAmount: new FormControl('', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
            nit:         new FormControl('C/F', [Validators.maxLength(10)]),
            supplier:    new FormControl('', [Validators.maxLength(20)])
        });
    }

    createEditFormGroup(): FormGroup {
        return new FormGroup({
            comment:  new FormControl('', [Validators.maxLength(100)]),
            nit:      new FormControl('C/F', [Validators.maxLength(10)]),
            supplier: new FormControl('', [Validators.maxLength(20)])
        });
    }

    get f() { return this.expenseForm.controls; }

    /** El catálogo de la tienda del gasto; al editar solo llega el id de la tienda. */
    private loadExpenseTagOptions(establishmentId?: string) {
        if (!establishmentId) return;
        this.dataService.getEstablishmentById(establishmentId)
            .pipe(first())
            .subscribe({
                next: (res: any) => {
                    const establishment = this.dataService.findJsonValue(res, 'json_result');
                    this.expenseTagOptions = parseExpenseTags(establishment?.expenseTags);
                },
                // Sin catálogo se pueden seguir escribiendo etiquetas a mano
                error: () => { this.expenseTagOptions = []; }
            });
    }

    /** Un gasto necesita al menos una etiqueta; reemplaza al Título requerido. */
    get missingTags(): boolean {
        return !this.expenseTags.length;
    }

    onSaveForm() {
        if (this.expenseForm.invalid || this.missingTags) return;
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
            title: serializeExpenseTags(this.expenseTags),
            establishmentId: this.establishmentId
        };
        return this.dataService.addStoreExpense(payload);
    }

    private saveEdit() {
        const payload: StoreExpense = {
            ...this.expense,
            ...this.expenseForm.value,
            title: serializeExpenseTags(this.expenseTags)
        };
        return this.dataService.updateStoreExpense(payload);
    }
}
