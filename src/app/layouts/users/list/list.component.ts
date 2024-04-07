import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import {map, startWith} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';

import { AccountService, AlertService} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { User } from '@app/models/system/user.model';

@Component({ 
    templateUrl: 'list.component.html',
    styleUrls: ['list.component.scss']
})
export class ListComponent implements OnInit {
    users?: User[];
    allUsers?: User[];
    searchTerm?: string;
    pageSize = 5;
    page = 1;
    entries = [5, 10, 20, 50];
    tableElementsValues?: any;

    constructor(private accountService: AccountService, private alertService: AlertService) {}

    ngOnInit() {
        this.retriveUsers();
    }

    retriveUsers(){
        this.users = undefined;
        // this.accountService.getAllUsersByFilter({"status": { "id": 2}})
        this.accountService.getAllUsersByFilter({})
            .pipe(first())
            .subscribe({
                next: (users: any) => {
                    this.users = users.retrieveUsersResponse?.users;
                    this.allUsers = this.users;
                    this.setTableElements(this.users);
                }
            });
    }

    private _filter(value: string, options: string[]): string[] {
        const filterValue = value.toLowerCase();

        return options.filter(option => option.toLowerCase().includes(filterValue));
    }

    search(value: any): void {
        this.users = this.allUsers?.filter((val) => {
            if(this.searchTerm){
                const nameMatch = val.name!.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                const emailMatch = val.email!.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                const statusMatch = val.status!.identifier!.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                const roleMatch = val.role!.identifier!.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                const phoneMatch = val.phone!.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                return nameMatch || emailMatch || statusMatch || roleMatch || phoneMatch;
            }
            return true;
        });
        this.setTableElements(this.users);
    }

    // deleteUser(usr: any) {
    //     let deleteUser = Object.assign({}, usr);
    //     deleteUser.status = 3;
    //     usr.isDeleting = true;
    //     this.accountService.delete(deleteUser)
    //         .pipe(first())
    //         .subscribe({
    //             next: () => {
    //             this.alertService.success('Usuario eliminado')
    //             this.retriveUsers()
    //             },
    //             error: error => {
    //                 this.alertService.error(error);
    //             }});
    // }

    setTableElements(elements?: User[]){
        this.tableElementsValues = [];
        elements?.forEach((element) => {
            const curr_row = [
                { type: "text", value: element.name, header_name: "Nombre" },
                { type: "text", value: element.email, header_name: "Correo" },
                { type: "text", value: element.status?.identifier, header_name: "Estado" },
                { type: "text", value: element.role?.identifier, header_name: "Rol" },
                { type: "text", value: element.phone, header_name: "Telefono" },
                {
                    type: "button",
                    style: "white-space: nowrap",
                    header_name: "Acciones",
                    button: [
                        {
                            type: "button",
                            routerLink: "view/" + element._id,
                            class: "btn btn-success btn-sm pb-0 mx-1",
                            icon: {
                                class: "material-icons",
                                icon: "visibility"
                            }
                        },
                        {
                            type: "button",
                            routerLink: "edit/" + element._id,
                            class: "btn btn-primary btn-sm pb-0 mx-1",
                            icon: {
                                class: "material-icons",
                                icon: "edit"
                            }
                        }
                    ]
                }
            ];
            this.tableElementsValues.push(curr_row);
        });
    }

}