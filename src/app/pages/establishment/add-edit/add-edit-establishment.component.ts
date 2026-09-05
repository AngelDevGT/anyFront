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
    establishmentTypeOptions = [
        { id: 1, name: 'Productos' },
        { id: 2, name: 'Abarrotes' }
    ];

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
                    // findJsonValue y no la clave del wrapper: esa se deriva del path, asi que
                    // cambia con cada version del endpoint (hoy /getEstablishmentV2)
                    let establishment = this.dataService.findJsonValue(establ, 'json_result');
                    if (establishment){
                        this.establishmentForm.patchValue(establishment);       
                        this.loading = false;
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
        this.saveEstablishment()
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Tienda guardada', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/establishments');
                },
                error: error => {
                    let ackError = this.dataService.findJsonValue(error, 'AcknowledgementDescription');
                    let errorResponse = this.dataService.findJsonValue(error, 'error');
                    this.alertService.error(ackError || errorResponse || 'Error al guardar la tienda');
                    this.submitting = false;
                }
            })
    }

    private saveEstablishment() {
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
            description: new FormControl(''),
            receivePendingOrdersEnabled: new FormControl(false),
            establishmentTypeId: new FormControl(1, [Validators.required]),
        });
    }

}