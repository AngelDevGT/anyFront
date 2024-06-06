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
    loadingRoles = false;
    submitted = false;
    roleOptions?: Role[];

    constructor(
        private dataService: DataService,
        private formBuilder: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private alertService: AlertService
    ) { }

    ngOnInit() {
        this.loadingRoles = true;
        this.dataService.getAllConstantsByFilter({fc_id_catalog: "roles", enableElements: "true"})
            .pipe(first())
            .subscribe((roles: any) =>{
                this.roleOptions = roles.retrieveCatalogGenericResponse.elements;
                this.loadingRoles = false;
            });
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
        let newUser: User = {
            ...this.registerForm.value,
            role: this.roleOptions?.find(role => role.identifier === "Indefinido")
        }
        this.accountService.register(newUser)
            .pipe(first())
            .subscribe({
                next: (user) => {
                    this.alertService.success('Se ha registrado correctamente', { keepAfterRouteChange: true });
                    this.router.navigate(['../login'], { relativeTo: this.route });
                },
                error: (error) => {
                    this.alertService.error(error.error.newUserResponse.AcknowledgementDescription);
                    this.loading = false;
                }
            });
    }
}