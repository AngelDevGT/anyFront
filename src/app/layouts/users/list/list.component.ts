import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';
import { AccountService, AlertService, DataService } from '@app/services';
import { User } from '@app/models/system/user.model';

@Component({ 
    templateUrl: 'list.component.html',
    styleUrls: ['list.component.scss']
})
export class ListComponent implements OnInit {
    users?: User[];
    allUsers?: User[];
    searchTerm?: string;
    pageSize = this.dataService.defaultPageSize;
    page = 1;
    entries = this.dataService.tableEntries;
    tableElementsValues?: any;

    constructor(private readonly accountService: AccountService, private readonly alertService: AlertService, private readonly dataService: DataService) {}

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
                    this.users = this.dataService.findJsonValue(users, 'json_result') || [];
                    this.allUsers = this.users;
                    this.setTableElements(this.users);
                }
            });
    }

    search(value: any): void {
        this.users = this.allUsers?.filter((val) => {
            if(this.searchTerm){
                const nameMatch = val.name!.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                const emailMatch = val.email!.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                const statusMatch = val.status!.identifier!.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                const roleMatch = val.role!.identifier!.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                const phoneMatch = String(val.phone!).toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
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
                { type: "avatar_text", value: element.name, header_name: "Nombre" },
                { type: "text", value: element.phone, header_name: "Teléfono" },
                { type: "text", value: element.email, header_name: "Correo" },
                { type: "text", value: element.role?.identifier, header_name: "Rol" },
                {
                    type: "badge",
                    value: element.status?.text || element.status?.identifier,
                    identifier: element.status?.identifier?.toLowerCase(),
                    bg_color: element.status?.bg_color,
                    color: element.status?.color,
                    header_name: "Estado"
                },
                {
                    type: "button",
                    header_name: "Acciones",
                    button: [
                        {
                            type: "button",
                            routerLink: "view/" + element.id,
                            colorClass: "dt-btn-view",
                            icon: { class: "material-icons", icon: "visibility" }
                        },
                        {
                            type: "button",
                            routerLink: "edit/" + element.id,
                            colorClass: "dt-btn-edit",
                            icon: { class: "material-icons", icon: "edit" }
                        }
                    ]
                }
            ];
            this.tableElementsValues.push(curr_row);
        });
    }

}