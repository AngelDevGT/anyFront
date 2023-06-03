import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import {map, startWith} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';

import { AccountService, AlertService} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';

@Component({ 
    templateUrl: 'list.component.html',
    styleUrls: ['list.component.scss']
})
export class ListComponent implements OnInit {
    users?: any[];
    allUsers?: any[];
    searchTerm?: string;
    pageSize = 5;
    page = 1;
    dataSource!: MatTableDataSource<any>;
    displayedColumns: string[] = ['name', 'email', 'role'];
    isDeleting = false;

    constructor(private accountService: AccountService, private alertService: AlertService) {}

    ngOnInit() {
        this.retriveUsers();
    }

    retriveUsers(){
        this.users = undefined;
        this.accountService.getAllByFilter({"status": 1})
            .pipe(first())
            .subscribe({
                next: (users: any) => {
                    this.users = users.retrieveUsersResponse?.users;
                    this.allUsers = this.users;
                    this.dataSource = new MatTableDataSource(this.users);
                }
            });
    }

    private _filter(value: string, options: string[]): string[] {
        const filterValue = value.toLowerCase();

        return options.filter(option => option.toLowerCase().includes(filterValue));
    }

    search(value: any): void {
        this.users = this.allUsers?.filter((val) => {
            const nameMatch = val.name.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
            const emailMatch = val.email.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
            return nameMatch || emailMatch;
        });
    }

    deleteUser(usr: any) {
        let deleteUser = Object.assign({}, usr);
        deleteUser.status = 3;
        usr.isDeleting = true;
        this.accountService.delete(deleteUser)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Usuario eliminado')
                this.retriveUsers()
                },
                error: error => {
                    this.alertService.error(error);
                }});
    }


    createFormGroup() {
        return new FormGroup({
            field: new FormControl(''),
        });
    }

}