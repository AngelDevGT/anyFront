import { Component, OnInit } from '@angular/core';

import { User } from '@app/models';
import { AccountService } from '@app/services';
import {
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';

@Component({ 
    selector: 'page-create-establishment',
    templateUrl: 'create-establishment.component.html',
    styleUrls: ['create-establishment.component.scss']
})
export class CreateEstablishmentComponent implements OnInit{

    user: User | null;
    establishmentForm!: FormGroup;

    constructor(private accountService: AccountService, public _builder: FormBuilder) {
        this.user = this.accountService.userValue;
        this.establishmentForm = this.createFormGroup();
        // this.minDate.setDate(this.minDate.getDate() - 1);
    }

    ngOnInit(): void {
        //this.buscarCursos();
    }

    onResetForm() {
        this.establishmentForm.reset();
    }

    onSaveForm() {
        console.log(this.establishmentForm.value);
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
            Validators.maxLength(50),
            ]),
        });
    }

}