import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';
import { AlertService, DataService } from '@app/services';
import {
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Provider } from '@app/models/system/provider.model';

@Component({ 
    selector: 'page-add-edit-provider',
    templateUrl: 'add-edit-provider.component.html',
    styleUrls: ['add-edit-provider.component.scss']
})
export class AddEditProviderComponent implements OnInit{

    providerForm!: FormGroup;
    currentProvider?: Provider;
    id?: string;
    title!: string;
    loading = false;
    submitting = false;
    listMaxLength = {
        name : 50,
        email : 25,
        phone : 8,
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

        this.title = 'Registrar Proveedor';
        if (this.id){
            this.title = 'Editar Proveedor';
            this.loading = true;
            this.dataService.getProviderById(this.id)
                .pipe(first())
                .subscribe((prov: any) => {
                    let provider = prov.getProviderResponse?.provider;
                    if (provider){
                        this.providerForm.patchValue(provider);
                        this.currentProvider = provider;
                        this.loading = false;
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
        let providerFormValues = this.providerForm.value;
        providerFormValues.description = providerFormValues.description && providerFormValues.description.trim() ? providerFormValues.description.trim() : '--';
        if (this.id){
            let newProvider = {
                ...this.currentProvider,
                ...providerFormValues
            };
            return this.dataService.updateProvider(this.id, newProvider);
        };
        return this.dataService.addProvider(providerFormValues);
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
            phone: new FormControl('', [
                Validators.required,
                Validators.minLength(1),
                Validators.maxLength(this.listMaxLength["phone"]),
                Validators.pattern(/\d+/),
                ]),
            description: new FormControl('', [
                // Validators.required,
                // Validators.minLength(1),
                // Validators.maxLength(this.listMaxLength["description"]),
                ]),
            company: new FormControl('', [
                Validators.required,
                Validators.minLength(1),
                Validators.maxLength(this.listMaxLength["company"]),
                ]),
            email: new FormControl('', [
            this.id ? Validators.nullValidator : Validators.required,
            Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
            ]),
        });
    }

}