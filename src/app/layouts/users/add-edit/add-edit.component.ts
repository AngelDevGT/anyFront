import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { concatMap, first } from 'rxjs/operators';

import { AccountService, AlertService, DataService } from '@app/services';
import { User } from '@app/models/system/user.model';
import { Role, Status } from '@app/models';
import { BehaviorSubject, of } from 'rxjs';

@Component({ 
    templateUrl: 'add-edit.component.html',
    styleUrls: ['add-edit.component.scss'] 
})
export class AddEditComponent implements OnInit {
    userForm!: FormGroup;
    currentUser?: User;
    roleOptions?: Role[];
    statusOptions?: Status[];
    selectedStatus?: Status;
    selectedStatusSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedRole?: Role;
    selectedRoleSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    id?: string;
    title!: string;
    loading = true;
    submitting = false;
    listMaxLength = {
        name : 50,
        email : 25,
        phone : 8,
        password: 25
    };

    constructor(
        private dataService: DataService,
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private alertService: AlertService
    ) { 
        this.selectedRoleSubject.subscribe(value => {
            this.selectRole(String(value));
        });
        this.selectedStatusSubject.subscribe(value => {
            this.selectStatus(String(value));
        });
    }

    ngOnInit() {
        this.id = this.route.snapshot.params['id'];

        this.userForm = this.createFormGroup();

        this.title = 'Crear Usuario';

        if (this.id){
            this.title = 'Editar Usuario';
        }

        this.dataService.getAllConstantsByFilter({fc_id_catalog: "roles", enableElements: "true"})
            .pipe(
                concatMap((roles: any) => {
                    this.roleOptions = roles.retrieveCatalogGenericResponse.elements;
                    return this.dataService.getAllConstantsByFilter({fc_id_catalog: "status", enableElements: "true"});
                }),
                concatMap((status: any) => {
                    this.statusOptions = status.retrieveCatalogGenericResponse.elements;
                    this.statusOptions = this.statusOptions?.slice(0, 3);
                    if(this.id){
                        return this.accountService.getUserById(this.id);
                    }
                    this.loading = false;
                    return of(null);
                })
            )
            .subscribe((usr: any) => {
                if(usr){
                    let user = usr.retrieveUsersResponse?.users;
                    if (user){
                        if ( user.length > 0){
                            this.userForm.patchValue(user[0]);
                            this.currentUser = user[0];
                            this.selectedRole = this.currentUser?.role;
                            this.selectedStatus = this.currentUser?.status;
                            this.roleSelect?.patchValue(String(this.selectedRole?.id));
                            this.statusSelect?.patchValue(String(this.selectedStatus?.id));
                            this.loading = false;
                        }
                    }
                }
            });
    }

    // convenience getter for easy access to form fields
    get f() { return this.userForm.controls; }

    get roleSelect() {
        return this.userForm.get('role');
    }

    get statusSelect() {
        return this.userForm.get('status');
    }

    selectRole(roleId?: string){
        if (roleId){
            this.selectedRole = this.roleOptions?.find(role => String(role.id) === roleId);
        }
    }

    selectStatus(statusId?: string){
        if(statusId){
            this.selectedStatus = this.statusOptions?.find(stat => String(stat.id) === statusId);
        }
    }

    onSubmit() {
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
            });
    }

    createFormGroup(){
        return new FormGroup({
            name: new FormControl('', [
                Validators.required, 
                Validators.pattern(/^(?!\s*$).+/),
            ]),
            email: new FormControl('', [
                Validators.required, 
                Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
            ]),
            phone: new FormControl('', [
                Validators.pattern(/\d+/)
            ]),
            password: new FormControl('', [
                this.id ? Validators.nullValidator : Validators.required,
                Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/)
            ]),
            role: new FormControl('', [
                Validators.required
            ]),
            status: new FormControl('', [
                Validators.required
            ]),
        });
    }

    private saveUser() {
        if(this.id){
            let updatedUser = {
                ...this.currentUser,
                ...this.userForm.value,
                status: this.selectedStatus,
                role: this.selectedRole
            };
            console.log(updatedUser);
            return this.accountService.update(this.id!, updatedUser);
        }
        let newUser = {
            ...this.userForm.value,
            status: this.selectedStatus,
            role: this.selectedRole
        }
        return this.accountService.create(newUser);
    }

    // changeRole(e: any){
    //     this.roleSelect!.setValue(e.target.value, {
    //     onlySelf: true
    //     });
    // }

}