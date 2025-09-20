import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';

import { AccountService, AlertService } from '@app/services';
import { User } from '@app/models/system/user.model';

@Component({ 
    templateUrl: 'login.component.html',
    styleUrls: ['login.component.scss']
})
export class LoginComponent implements OnInit {
    loginForm!: FormGroup;
    loading = false;
    submitted = false;

    constructor(
        private formBuilder: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private alertService: AlertService
    ) { }

    ngOnInit() {
        this.loginForm = this.formBuilder.group({
            email: ['', Validators.required],
            password: ['', Validators.required]
        });
    }

    // convenience getter for easy access to form fields
    get f() { return this.loginForm.controls; }

    onSubmit() {
        this.submitted = true;

        // reset alerts on submit
        this.alertService.clear();

        // stop here if form is invalid
        if (this.loginForm.invalid) {
            return;
        }

        this.loading = true;
        this.accountService.login(this.f['email'].value, this.f['password'].value)
            .subscribe({
                next: (usr) => {
                    let user : User = this.accountService.findJsonValue(usr, 'json_result');
                    if (user){
                        const userValue = this.accountService.userValue;
                        const logedUser: User = { 
                            ...userValue,
                            status: user.status,
                            role: user.role,
                            uuid: user.id
                        };
                        localStorage.removeItem('user');
                        localStorage.setItem('user', JSON.stringify(logedUser));
                        this.accountService.setUserSubject(logedUser);
                    }
                    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
                    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
                        this.router.navigate([returnUrl]);
                    });
                },
                error: (error) => {
                    let errorMsg = this.accountService.findJsonValue(error, 'AcknowledgementDescription');
                    this.alertService.error(errorMsg);
                    this.loading = false;
                }
            });
    }
}