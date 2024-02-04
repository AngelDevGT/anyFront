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
    selector: 'page-create-establishment',
    templateUrl: 'add-edit-establishment.component.html',
    styleUrls: ['add-edit-establishment.component.scss']
})
export class AddEditEstablishmentComponent implements OnInit{

    establishmentForm!: FormGroup;
    id?: string;
    title!: string;
    loading = false;
    submitting = false;

    constructor(private dataService: DataService, public _builder: FormBuilder, 
        private route: ActivatedRoute, private router: Router,
        private alertService: AlertService ) {
        // this.minDate.setDate(this.minDate.getDate() - 1);
    }

    ngOnInit(): void {
        this.id = this.route.snapshot.params['id'];

        this.establishmentForm = this.createFormGroup();

        this.title = 'Crear Tienda';
        if (this.id){
            this.title = 'Editar Tienda';
            this.loading = true;
            this.dataService.getEstablishmentById(this.id)
                .pipe(first())
                .subscribe((establ: any) => {
                    let establishment = establ.findEstablishmentResponse?.establishment;
                    if (establishment){
                        if ( establishment.length > 0){
                            this.establishmentForm.patchValue(establishment[0]);       
                            this.loading = false;
                        }
                    }
                });
        }
    }

    onResetForm() {
        this.establishmentForm.reset();
    }

    onSaveForm() {
        // reset alerts on submit
        this.alertService.clear();

        this.submitting = true;
        this.saveUser()
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Establecimiento guardado', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/establishments');
                },
                error: error => {
                    let errorResponse = error.error;
                    errorResponse = errorResponse.addEstablishmentResponse ? errorResponse.addEstablishmentResponse : errorResponse.updateEstablishmentResponse ? errorResponse.updateEstablishmentResponse : 'Error, consulte con el administrador';
                    this.alertService.error(errorResponse.AcknowledgementDescription);
                    this.submitting = false;
                }
            })
    }

    private saveUser() {
        // create or update user based on id param
        return this.id
            ? this.dataService.updateEstablishment(this.id!, this.establishmentForm.value)
            : this.dataService.addEstablishment(this.establishmentForm.value);
    }

    get f() {
        return this.establishmentForm.controls;
    }

    createFormGroup() {
        return new FormGroup({
            name: new FormControl('', [
            Validators.required,
            Validators.minLength(1),
            Validators.maxLength(50),
            ]),
            address: new FormControl('', [
            Validators.required,
            Validators.minLength(1),
            Validators.maxLength(50),
            ]),
            description: new FormControl('', [
            Validators.minLength(1),
            Validators.maxLength(100),
            ]),
        });
    }

}