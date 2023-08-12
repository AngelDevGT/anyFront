import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import jwt_decode from 'jwt-decode';

import { environment } from '@environments/enviroment';
import { User } from '@app/models';

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
                localStorage.setItem('user', JSON.stringify(jwt_decode(usr)));
                this.userSubject.next(jwt_decode(usr));
                console.log(this.userSubject);
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
                ...undefinedStatus,
                ...undefinedRole
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

    isLoginUser(userId: string){
        return this.userValue.userID === userId;
    }


}