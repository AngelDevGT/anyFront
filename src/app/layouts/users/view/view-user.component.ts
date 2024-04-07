import { Component, OnInit} from '@angular/core';
import { first } from 'rxjs/operators';

import { AccountService, AlertService, DataService } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { User } from '@app/models/system/user.model';

@Component({ 
    selector: 'page-view-user',
    templateUrl: 'view-user.component.html',
    styleUrls: ['view-user.component.scss']
})
export class ViewUserComponent implements OnInit{

    id?: string;
    user?: User;
    submitting = false;
    loading = false;
    elements: any = [];

    constructor(private accountService: AccountService, private dataService: DataService, private alertService: AlertService,
        private route: ActivatedRoute, private router: Router) {
    }

    ngOnInit(): void {
        this.id = this.route.snapshot.params['id'];

        this.loading = true;

        if (this.id){
            this.accountService.getUserById(this.id)
                .pipe(first())
                .subscribe((usr: any) => {
                    let user = usr.retrieveUsersResponse?.users;
                    if (user){
                        if ( user.length > 0){
                            this.user = user[0];
                            this.setUserElements(this.user!);
                            this.loading = false;
                        }
                    }
                });
        }
    }


    deleteUser() {
        this.submitting = true;
        this.accountService.deleteUser(this.user)
            .pipe(first())
            .subscribe({
                next: (logOut) => {
                    if(logOut){
                        this.accountService.logout();
                    } else {
                        this.alertService.success('Usuario eliminado', { keepAfterRouteChange: true });
                        this.router.navigateByUrl('/users');
                    }
                    },
                    error: error => {
                        this.alertService.error('Error al eliminar el proveedor, contacte con Administracion');
                    }});
    }

    isAdmin(){
        return this.accountService.isAdminUser();
    }

    isMine(){
        return this.accountService.isLoginUser(this.user?._id!);
    }

    setUserElements(user: User){
        this.elements.push({icon : "mail", name : "Correo Electronico", value : user.email});
        this.elements.push({icon : "call", name : "Telefono", value : user.phone});
        this.elements.push({icon : "settings", name : "Rol", value : user.role?.identifier});
        this.elements.push({icon : "info", name : "Estado", value : user.status?.identifier});
        this.elements.push({icon : "calendar_today", name : "Fecha Creación", value : this.dataService.getLocalDateTimeFromUTCTime(user.creationDate!.replaceAll("\"",""))});
        // this.elements.push({icon : "calendar_today", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(user.updateDate!.replaceAll("\"",""))});
    }

}