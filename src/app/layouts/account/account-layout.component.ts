import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { AccountService } from '@app/services';

@Component({ templateUrl: 'account-layout.component.html' })
export class AccountLayoutComponent {
    constructor(
        private router: Router,
        private accountService: AccountService
    ) {
        // redirect to home if already logged in
        if (this.accountService.userValue) {
            this.router.navigate(['/']);
        }
    }
}