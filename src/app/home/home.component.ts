import { Component, OnInit } from '@angular/core';

import { User } from '@app/models';
import { AccountService } from '@app/services';
import {
AbstractControl,
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';

@Component({ 
    selector: 'app-home',
    templateUrl: 'home.component.html',
    styleUrls: ['home.component.scss']
})
export class HomeComponent {

    user: User | null;

    constructor(private accountService: AccountService, public _builder: FormBuilder) {
        this.user = this.accountService.userValue;
    }

}