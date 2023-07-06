import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';

import { User } from '@app/models';
import { AlertService, DataService } from '@app/services';
import {
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

@Component({ 
    selector: 'page-add-edit-provider',
    templateUrl: 'add-edit-provider.component.html',
    styleUrls: ['add-edit-provider.component.scss']
})
export class AddEditProviderComponent implements OnInit{

    providerForm!: FormGroup;
    id?: string;
    title!: string;
    loading = false;
    submitting = false;
    listMaxLength = {
        name : 50,
        email : 25,
        phoneNumber : 8,
        description : 200,
        company : 50,
    };

    constructor(private dataService: DataService, public _builder: FormBuilder, 
        private route: ActivatedRoute, private router: Router,
        private alertService: AlertService ) {
        // this.minDate.setDate(this.minDate.getDate() - 1);
    }

    ngOnInit(): void {
        this.id = this.route.snapshot.params['id'];

        this.providerForm = this.createFormGroup();

        this.title = 'Crear Proveedor';
        if (this.id){
            this.title = 'Editar Proveedor';
            this.loading = true;
            this.dataService.getProviderById(this.id)
                .pipe(first())
                .subscribe((prov: any) => {
                    let provider = prov.getProviderResponse?.provider;
                    if (provider){
                        if (provider){
                            this.providerForm.patchValue(provider);       
                            this.loading = false;
                        }
                    }
                });
        }
    }

    onResetForm() {
        this.providerForm.reset();
    }

    onSaveForm() {
        // reset alerts on submit
        this.alertService.clear();

        this.submitting = true;
        this.saveProvider()
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Proveedor guardado', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/providers');
                },
                error: error => {
                    let errorResponse = error.error;
                    errorResponse = errorResponse.addProviderResponse ? errorResponse.addProviderResponse : errorResponse.updateEstablishmentResponse ? errorResponse.updateEstablishmentResponse : 'Error, consulte con el administrador';
                    this.alertService.error(errorResponse.AcknowledgementDescription);
                    this.submitting = false;
                }
            })
    }

    private saveProvider() {
        // create or update user based on id param
        return this.id
            ? this.dataService.updateProvider(this.id!, this.providerForm.value)
            : this.dataService.addProvider(this.providerForm.value);
    }

    get f() {
        return this.providerForm.controls;
    }

    createFormGroup() {
        return new FormGroup({
            name: new FormControl('', [
            Validators.required,
            Validators.minLength(1),
            Validators.maxLength(this.listMaxLength["name"]),
            ]),
            phoneNumber: new FormControl('', [
                Validators.required,
                Validators.minLength(1),
                Validators.maxLength(this.listMaxLength["phoneNumber"]),
                Validators.pattern(/\d+/),
                ]),
            description: new FormControl('', [
                Validators.minLength(1),
                Validators.maxLength(this.listMaxLength["description"]),
                ]),
            company: new FormControl('', [
                Validators.required,
                Validators.minLength(1),
                Validators.maxLength(this.listMaxLength["company"]),
                ]),
            email: new FormControl('', [
            Validators.required,
            Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
            ]),
        });
    }

}