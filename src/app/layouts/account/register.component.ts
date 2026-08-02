import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';

import { AccountService, AlertService, DataService } from '@app/services';
import { Role } from '@app/models';
import { User } from '@app/models/system/user.model';

@Component({ 
    templateUrl: 'register.component.html',
    styleUrls: ['register.component.scss']
})
export class RegisterComponent implements OnInit {
    registerForm!: FormGroup;
    loading = false;
    submitted = false;

    constructor(
        private dataService: DataService,
        private formBuilder: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private alertService: AlertService
    ) { }

    ngOnInit() {
        // Antes se cargaban los roles para asignar "Indefinido" desde el cliente. Ya no: esta
        // pagina es publica y /getRoles ahora exige token, asi que la peticion fallaria y el
        // formulario se quedaria colgado en el spinner. El rol lo fija el backend.
        this.registerForm = this.formBuilder.group({
            name: ['', [Validators.required, Validators.pattern(/^(?!\s*$).+/)]],
            email: ['', [Validators.required, Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)]],
            password: ['', [Validators.required, Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/)]]
        });
    }

    hasPatternError(errors: any): boolean {
        return errors && errors.pattern;
    }

    // convenience getter for easy access to form fields
    get f() { return this.registerForm.controls; }

    onSubmit() {
        this.submitted = true;

        // reset alerts on submit
        this.alertService.clear();

        // stop here if form is invalid
        if (this.registerForm.invalid) {
            return;
        }

        this.loading = true;
        // Una sola escritura, contra Postgres. El backend asigna rol Indefinido y estado
        // Inactivo: la cuenta queda a la espera de que un administrador la habilite.
        const newUser: User = { ...this.registerForm.value };

        this.accountService.registerV3(newUser)
            .subscribe({
                next: () => {
                    this.alertService.success('Se ha registrado correctamente', { keepAfterRouteChange: true });
                    this.router.navigate(['../login'], { relativeTo: this.route });
                },
                error: (error) => {
                    const errorMsg = this.accountService.findJsonValue(error, 'information')
                        || 'No fue posible completar el registro, intente de nuevo.';
                    this.alertService.error(errorMsg);
                    this.loading = false;
                }
            });
    }
}