import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import jwt_decode from 'jwt-decode';

import { environment } from '@environments/enviroment';
import { User } from '@app/models/system/user.model';
import { Role } from '@app/models';

const undefinedStatus = {
    status: {
        "id": 1,
        "status": 1,
        "text": "0",
        "identifier": "Inactivo"
    }
};

const activeStatus = {
    status: {
        "id": 2,
        "status": 1,
        "text": "1",
        "identifier": "Activo"
    }
};

const deleteStatus = {
    status: {
        "id": 3,
        "status": 1,
        "text": "2",
        "identifier": "Eliminado"
    }
};

const undefinedRole = {
    role: {
        "id": 6,
        "status": 1,
        "text": "6",
        "identifier": "Indefinido"
    }
};

const menuItemsOptions: any = [
    {
      button_type : "button",
      button_class : "list-group-item principal-bottom",
      button_toggle : "collapse",
      button_data_bs_toggle : "collapse",
      button_data_bs_target : "#administrar-lvl1",
      button_aria_controls : "administrar-lvl1",
      button_aria_expanded : "false",
      button_icon_class : "material-icons icon",
      button_icon : "admin_panel_settings",
      button_name : "Sistema",
      button_dropdown_icon_class : "material-icons icon",
      button_dropdown_icon : "arrow_drop_down",
      root_id : "administrar-lvl1",
      root_class : "panel-collapse collapse",
      sub_class : "position-sticky",
      is_tree : true,
      childs : [
        {
          root_class : "list-group list-group-flush",
          router_link : "/users",
          link_class : "list-group-item py-2 ripple",
          link_name : "Usuarios",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/establishments",
          link_class : "list-group-item py-2 ripple",
          link_name : "Tiendas",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        }
      ]
    },{
      button_type : "button",
      button_class : "list-group-item principal-bottom",
      button_toggle : "collapse",
      button_data_bs_toggle : "collapse",
      button_data_bs_target : "#reports-lvl1",
      button_aria_controls : "reports-lvl1",
      button_aria_expanded : "false",
      button_icon_class : "material-icons icon",
      button_icon : "description",
      button_name : "Reportes",
      button_dropdown_icon_class : "material-icons icon",
      button_dropdown_icon : "arrow_drop_down",
      root_id : "reports-lvl1",
      root_class : "panel-collapse collapse",
      sub_class : "position-sticky",
      is_tree : true,
      childs : [
        {
          root_class : "list-group list-group-flush",
          router_link : "/summary/rawMaterialByProvider/order",
          link_class : "list-group-item py-2 ripple",
          link_name : "Pedidos de materia prima",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/summary/inventory/factory/rawMaterial",
          link_class : "list-group-item py-2 ripple",
          link_name : "Inventario de materia prima",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/summary/inventory/factory/finishedProduct",
          link_class : "list-group-item py-2 ripple",
          link_name : "Inventario de productos",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/summary/inventory/store/productForSale",
          link_class : "list-group-item py-2 ripple",
          link_name : "Inventario de producto en tiendas",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/summary/productForSale/store/order",
          link_class : "list-group-item py-2 ripple",
          link_name : "Listado de pedidos",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        }
      ]
    },
    {
      button_type : "button",
      button_class : "list-group-item principal-bottom",
      button_toggle : "collapse",
      button_data_bs_toggle : "collapse",
      button_data_bs_target : "#providers-lvl1",
      button_aria_controls : "providers-lvl1",
      button_aria_expanded : "false",
      button_icon_class : "material-icons icon",
      button_icon : "local_shipping",
      button_name : "Proveedores",
      button_dropdown_icon_class : "material-icons icon",
      button_dropdown_icon : "arrow_drop_down",
      root_id : "providers-lvl1",
      root_class : "panel-collapse collapse",
      sub_class : "position-sticky",
      is_tree : true,
      childs : [
        {
          root_class : "list-group list-group-flush",
          router_link : "/rawMaterials",
          link_class : "list-group-item py-2 ripple",
          link_name : "Materia prima",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/providers",
          link_class : "list-group-item py-2 ripple",
          link_name : "Registro proveedores",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/rawMaterialsByProvider",
          link_class : "list-group-item py-2 ripple",
          link_name : "Ingreso de proveedores",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/rawMaterialByProvider/order",
          link_class : "list-group-item py-2 ripple",
          link_name : "Pedidos de materia prima",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
      ]
    },
    {
      button_type : "button",
      button_class : "list-group-item principal-bottom",
      button_toggle : "collapse",
      button_data_bs_toggle : "collapse",
      button_data_bs_target : "#fabrica-lvl1",
      button_aria_controls : "fabrica-lvl1",
      button_aria_expanded : "false",
      button_icon_class : "material-icons icon",
      button_icon : "shelves",
      button_name : "Bodega",
      button_dropdown_icon_class : "material-icons icon",
      button_dropdown_icon : "arrow_drop_down",
      root_id : "fabrica-lvl1",
      root_class : "panel-collapse collapse",
      sub_class : "position-sticky",
      is_tree : true,
      childs : [
        {
          root_class : "list-group list-group-flush",
          router_link : "/finishedProducts",
          link_class : "list-group-item py-2 ripple",
          link_name : "Listado de productos",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/inventory/factory/rawMaterial",
          link_class : "list-group-item py-2 ripple",
          link_name : "Inventario de materia prima",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/consumeRawMaterial",
          link_class : "list-group-item py-2 ripple",
          link_name : "Consumir materia prima de inventario",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/productCreation",
          link_class : "list-group-item py-2 ripple",
          link_name : "Registrar productos en inventario",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/inventory/factory/finishedProduct",
          link_class : "list-group-item py-2 ripple",
          link_name : "Inventario de productos",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/finishedProduct/order",
          query_params: {opt: 'factory'},
          link_class : "list-group-item py-2 ripple",
          link_name : "Pedidos",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        }
      ]
    },
    {
      button_type : "button",
      button_class : "list-group-item principal-bottom",
      button_toggle : "collapse",
      button_data_bs_toggle : "collapse",
      button_data_bs_target : "#store-lvl1",
      button_aria_controls : "store-lvl1",
      button_aria_expanded : "false",
      button_icon_class : "material-icons icon",
      button_icon : "storefront",
      button_name : "Tienda",
      button_dropdown_icon_class : "material-icons icon",
      button_dropdown_icon : "arrow_drop_down",
      root_id : "store-lvl1",
      root_class : "panel-collapse collapse",
      sub_class : "position-sticky",
      is_tree : true,
      childs : [
        {
          root_class : "list-group list-group-flush",
          router_link : "/store",
          query_params: {opt: 'inventory'},
          link_class : "list-group-item py-2 ripple",
          link_name : "Listado de Tiendas",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        }
      ]
    },
];

@Injectable({ providedIn: 'root' })
export class AccountService {

    private userSubject: BehaviorSubject<any>;
    public user: Observable<any>;

    constructor(
        private router: Router,
        private http: HttpClient
    ) {
        this.userSubject = new BehaviorSubject(JSON.parse(localStorage.getItem('user')!));
        this.user = this.userSubject.asObservable();
    }

    public get userValue() {
        return this.userSubject.value;
    }

    public get userRole(){
        return this.userValue?.role;
    }

    public get userEmail(){
        return this.userValue?.correo;
    }

    public get userValueFixed(){
        let userValue = this.userSubject.value;
        let logedUser: User = {
            name: userValue?.name,
            email: userValue?.correo,
            _id: userValue?.userID,
        };
        return logedUser;
    }

    login(email: string, password: string) {
        let headers = new HttpHeaders({
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Origin': '*',
        });
        let options = { headers: headers };
        let loginUser = JSON.stringify({
            loginUser: { 
                "email": email, "password": password 
            }});
        return this.http.post(`${environment.apiUrl}/LoginUser`, loginUser, options)
            .pipe(map((user: any) => {
                let usr = user.loginUserResponse.token;
                // store user details and jwt token in local storage to keep user logged in between page refreshes
                let jwd_decoded_usr: any = jwt_decode(usr);
                let logedUser: User = { 
                    ...jwd_decoded_usr,
                    name: jwd_decoded_usr.name,
                    email: jwd_decoded_usr.correo,
                    _id: jwd_decoded_usr.userID,
                };
                console.log(logedUser);
                localStorage.setItem('user', JSON.stringify(jwt_decode(usr)));
                this.userSubject.next(logedUser);
                return user;
            }));
    }

    logout() {
        // remove user from local storage and set current user to null
        localStorage.removeItem('user');
        this.userSubject.next(null);
        this.router.navigate(['/account/login']);
    }

    register(user: User) {
        let newUser = JSON.stringify({
            newUser: { 
                ...user,
                ...undefinedStatus
            }});
        // let newUser = { ...user };
        return this.http.post(`${environment.apiUrl}/newUser`, newUser);
    }

    create(user: User) {
        let newUser = JSON.stringify({
            newUser: { 
                ...user
            }});
        // let newUser = { ...user };
        return this.http.post(`${environment.apiUrl}/newUser`, newUser);
    }

    getAll() {
        // let headers = new HttpHeaders({
        //     Authorization: 'Bearer ' + this.userValue?.token,
        // });
        // let options = { headers: headers };
        let params = JSON.stringify({retrieveUsers: {}});
        return this.http.post(`${environment.apiUrl}/retrieveUsers`, params);
    }


    getAllUsersByFilter(params: any) {
        // let headers = new HttpHeaders({
        //     Authorization: 'Bearer ' + this.userValue?.token,
        // });
        // let options = { headers: headers };
        let parameters = JSON.stringify({
            retrieveUsers: {
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/retrieveUsers`, parameters);
    }

    getUserById(id: string) {
        let params = JSON.stringify({retrieveUsers: { "_id": id}});
        return this.http.post(`${environment.apiUrl}/retrieveUsers`, params);
    }

    update(id: string, params: any) {
        let modifyUser = JSON.stringify({
            updateUser: {
                "_id": id,
                ...params
            }});
        return this.http.post(`${environment.apiUrl}/ModifyUser`, modifyUser)
            .pipe(map(x => {
                // update stored user if the logged in user updated their own record
                if (id == this.userValue?._id) {
                    // update local storage
                    const user = { ...this.userValue, ...params };
                    localStorage.setItem('user', JSON.stringify(user));

                    // publish updated user to subscribers
                    this.userSubject.next(user);
                }
                return x;
            }));
    }

    deleteUser(params: any) {
        let deleteUser = JSON.stringify({
            updateUser: {
                ...params,
                ...deleteStatus
            }});
        return this.http.post(`${environment.apiUrl}/ModifyUser`, deleteUser)
            .pipe(map(x => {
                // auto logout if the logged in user deleted their own record
                if (params._id === this.userValue?.userID) {
                    return true;
                }
                return false;
            }));
    }

    isActiveUser(){
        return this.userValue?.status == 1;
    }

    isAdminUser(){
        return this.userValue.role.id === 1;
    }

    isSalesUser(){
        return this.userValue.role.id === 3;
    }

    isLoginUser(userId: string){
        return this.userValue.userID === userId;
    }

    checkLogin(): Observable<boolean> {
        return of(this.userValue);
      }

    // checkUserRole(enabledRoles: string[]): Observable<boolean> {
    //     let enabledUserRole = false;
    //     for (let currRole of enabledRoles){
    //         if (currRole === this.userValue.role.identifier){
    //             enabledUserRole = true;
    //         }
    //     }
    //     return of(enabledUserRole);
    // }

    getUserRole(): Observable<Role> {
        return of(this.userValue.role);
    }

    getUserPaths(): Observable<Role> {
        return of(this.userValue.role);
    }

    extractEmails(text: any): string[] {
        if (!text) {
            return [];
        }
        const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
        const matches = text.match(emailPattern);
        return matches ?? [];
    }

    getUserMenuItems(){
        let menuItems: any = [];
        let copy_menuItemsOptions = structuredClone(menuItemsOptions)
        for(let item of copy_menuItemsOptions){
        let userPaths = this.userValue?.role?.paths || [];
        let newItem = item;
        let newItemChilds = [];
        for(let child of item.childs){
            let destinationRoute = child.router_link;
            if(child.query_params){
            destinationRoute += "?";
            for(let key in child.query_params){
                destinationRoute += key + "=" + child.query_params[key] + "&";
            }
            destinationRoute = destinationRoute.slice(0, -1);
            }
            const destinationRouteFound = userPaths.find((route: any) => {
            const currRegex = new RegExp(route.matchPattern);
            return currRegex.test(destinationRoute);
            });
            if(destinationRouteFound){
            newItemChilds.push(child);
            }
        }
        newItem.childs = newItemChilds;
        if(newItemChilds.length > 0){
            menuItems.push(newItem);
        }
        }
        return menuItems;
    }

}