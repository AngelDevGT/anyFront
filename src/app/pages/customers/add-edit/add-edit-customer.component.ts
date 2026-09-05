import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { first } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { Customer } from '@app/models/system/customer.model';

@Component({
    selector: 'page-add-edit-customer',
    templateUrl: 'add-edit-customer.component.html',
    styleUrls: ['add-edit-customer.component.scss']
})
export class AddEditCustomerComponent implements OnInit {

    customerForm!: FormGroup;
    currentCustomer?: Customer;
    id?: string;
    title = 'Registrar Cliente';
    loading = false;
    submitting = false;
    listMaxLength = {
        name: 100,
        phone: 15,
        email: 100,
        nit: 15
    };

    constructor(
        private dataService: DataService,
        private alertService: AlertService,
        private route: ActivatedRoute,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.id = this.route.snapshot.params['id'];
        this.customerForm = this.createFormGroup();

        if (this.id) {
            this.title = 'Editar Cliente';
            this.loading = true;
            this.dataService.getCustomerById(this.id)
                .pipe(first())
                .subscribe({
                    next: (result: any) => {
                        const customer = this.dataService.findJsonValue(result, 'json_result');
                        if (customer) {
                            this.currentCustomer = customer;
                            this.customerForm.patchValue({
                                name: customer.name,
                                phone: customer.phone,
                                email: customer.email,
                                nit: customer.nit,
                                isOperator: !!customer.isOperator
                            });
                        }
                        this.loading = false;
                    },
                    error: error => {
                        this.loading = false;
                        this.alertService.error(this.dataService.getErrorMessageResponse(error, 'Error al cargar el cliente'));
                    }
                });
        }
    }

    createFormGroup(): FormGroup {
        return new FormGroup({
            name: new FormControl('', [
                Validators.required,
                Validators.minLength(1),
                Validators.maxLength(this.listMaxLength['name'])
            ]),
            phone: new FormControl('', [
                Validators.maxLength(this.listMaxLength['phone']),
                Validators.pattern(/^\d+$/)
            ]),
            email: new FormControl('', [
                Validators.maxLength(this.listMaxLength['email']),
                Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
            ]),
            nit: new FormControl('C/F', [
                Validators.maxLength(this.listMaxLength['nit'])
            ]),
            // Lo único que hace: incluir al cliente en el catálogo del modal de
            // operadores de los pedidos de bodega.
            isOperator: new FormControl(false)
        });
    }

    get f() {
        return this.customerForm.controls;
    }

    onResetForm() {
        this.customerForm.reset();
    }

    onSaveForm() {
        if (this.customerForm.invalid) return;
        this.alertService.clear();
        this.submitting = true;

        this.saveCustomer()
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Cliente guardado', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/customers');
                },
                error: error => {
                    this.alertService.error(this.dataService.getErrorMessageResponse(error, 'Error al guardar el cliente, consulte con el administrador'));
                    this.submitting = false;
                }
            });
    }

    private saveCustomer() {
        const customerFormValues = this.customerForm.value;
        if (this.id) {
            const newCustomer: Customer = {
                ...this.currentCustomer,
                ...customerFormValues,
                id: this.id
            };
            return this.dataService.updateCustomer(newCustomer);
        }
        return this.dataService.addCustomer(customerFormValues);
    }
}
