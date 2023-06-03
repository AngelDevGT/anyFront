import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';

import { AccountService, AlertService } from '@app/services';

@Component({ 
    templateUrl: 'add-edit.component.html',
    styleUrls: ['add-edit.component.scss'] 
})
export class AddEditComponent implements OnInit {
    form!: FormGroup;
    userForm!: FormGroup;
    id?: string;
    title!: string;
    loading = false;
    submitting = false;

    constructor(
        private formBuilder: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private alertService: AlertService
    ) { }

    ngOnInit() {
        this.id = this.route.snapshot.params['id'];

        this.userForm = this.formBuilder.group({
            name: ['', [Validators.required, Validators.pattern(/^(?!\s*$).+/)]],
            email: [{value: '', disabled: this.id}, [Validators.required, Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)]],
            password: ['', [...(!this.id ? [Validators.required] : []), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/)]],
            role: ['', [Validators.required]],
        });

        this.title = 'Crear Usuario';
        if (this.id) {
            // edit mode
            this.title = 'Editar Usuario';
            this.loading = true;
            this.accountService.getById(this.id)
                .pipe(first())
                .subscribe((usr: any) => {
                    let user = usr.retrieveUsersResponse?.users;
                    if (user){
                        if ( user.length > 0){
                            this.userForm.patchValue(user[0]);       
                            this.loading = false;
                        }
                    }
                });
        }
    }

    // convenience getter for easy access to form fields
    get f() { return this.userForm.controls; }

    get roleSelect() {
        return this.userForm.get('role');
    }

    onSubmit() {
        console.log(this.userForm.value);

        // reset alerts on submit
        this.alertService.clear();

        this.submitting = true;
        this.saveUser()
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Usuario guardado', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/users');
                },
                error: error => {
                    let errorResponse = error.error;
                    errorResponse = errorResponse.newUserResponse ? errorResponse.newUserResponse : errorResponse.updateUserResponse ? errorResponse.updateUserResponse : 'Error, consulte con el administrador';
                    this.alertService.error(errorResponse.AcknowledgementDescription);
                    this.submitting = false;
                }
            })
    }

    private saveUser() {
        // create or update user based on id param
        return this.id
            ? this.accountService.update(this.id!, this.userForm.value)
            : this.accountService.register(this.userForm.value);
    }

    changeRole(e: any){
        this.roleSelect!.setValue(e.target.value, {
        onlySelf: true
        });
    }

}