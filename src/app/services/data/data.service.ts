import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { User } from '@app/models';
import { HeadersService } from '@app/services';
import { Observable, Subject } from 'rxjs';
// import { Comunity } from './models/comunity.model';
// import { ComunityAssign } from './models/comunityAssign.model';
import { OrdinaryObject } from '@app/models';
// import { CommunityPost } from './models/comunityPost.model';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  postAdminCreationUrl = '/api/users/adminCreation';
  apiUrl2 = '/api/users/accounts';
  apiUrl = 'http://localhost:8080/api/users/987654333';
  apiUrlAuthentication = 'http://localhost:8080/api/users/authentication';
  apiUrlObtenerToken = 'http://localhost:8080/token';
  addUserUrl = '/creation/users';
  userByTokenUrl = '/api/users/findbytoken';
  userUpdateUrl = '/api/update/user';
  getUsersByFilteringURL = '/api/users/byFiltering';
  coursesUrl = '/api/users/getCourses';
  usersURL = '/api/users/accounts';
  addComunityUrl = '/api/users/creationComunity';
  findComunytyByRegistroAcademicoUrl =
    '/api/users/findComunityByRegistroAcademico';
  findComunityByIdURL = '/api/users/findComunityById';
  saveComunityAssignURL = '/api/users/assignComunity';
  getUsersBySearchURL = '/api/users/search';
  findUserByIdURL = '/api/users/find/byId';
  getCommunitiesBySearchURL = '/api/communities/search';
  findSuscriptionComunityURL = '/api/users/findMemberComunityById';

  communityPostCreateURL = '/api/community/post/create';
  findAllCommunityPostByCommunityURL = '/api/community/post/get/allByCommunity';
  findAllCommunityPostByCommunityFiltersURL =
    '/api/community/post/get/allByCommunityFilters';
  findAllUsersInCommunityURL = '/api/comunity/users';
  findUserComunitysURL = '/api/users/findUserComunitys';

  changePasswordUserURL = '/api/users/changePassword';

  private logger$ = new Subject<boolean>(); //Va a emitir un evento
  private loggedIn: boolean;

  constructor(
    private _http: HttpClient,
    private controllHeader: HeadersService
  ) {
    if (localStorage.getItem('token') === null) {
      //No hay session
      this.loggedIn = false;
    } else {
      this.loggedIn = true;
    }
  }

  isLoggedIn(): Observable<boolean> {
    //Crea el Observer
    return this.logger$.asObservable();
  }

  logIn(user: User) {
    let headers = new HttpHeaders({
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Origin': '*',
    });
    let options = { headers: headers };
    this._http.post(this.apiUrlObtenerToken, user, options).subscribe(
      (result) => {
        localStorage.setItem('token', JSON.stringify(result));
        if (result != null) {
          this.loggedIn = true;
          this.logger$.next(this.loggedIn); //Avisar a los observadores si se logueo
        }
      },
      (error) => {
        this.logger$.next(this.loggedIn);
      }
    );
  }

  logOut() {
    this.loggedIn = false;
    localStorage.clear();
    this.logger$.next(this.loggedIn);
  }

  getUsers() {
    return this._http.get<User>(this.apiUrl);
  }

  getAllUsers(token: User) {
    let headers = new HttpHeaders({
      Authorization: 'Bearer ' + token.token,
    });
    let options = { headers: headers };
    return this._http.post<User[]>(this.usersURL, token, options);
  }

  postAdminCreation(registroAcadem: string, token: User) {
    let headers = new HttpHeaders({
      Authorization: 'Bearer ' + token.token,
    });
    let options = { headers: headers };
    return this._http.post<number>(
      this.postAdminCreationUrl,
      { registroAcademico: registroAcadem },
      options
    );
  }

  getUsersByFiltering(search: User, token: User) {
    let headers = new HttpHeaders({
      Authorization: 'Bearer ' + token.token,
    });
    let options = { headers: headers };
    return this._http.post<User[]>(
      this.getUsersByFilteringURL,
      search,
      options
    );
  }

  postChangePasswordUser(usr: User, token: User) {
    let headers = new HttpHeaders({
      Authorization: 'Bearer ' + token.token,
    });
    let options = { headers: headers };
    return this._http.post<number>(this.changePasswordUserURL, usr, options);
  }

  addNewUser(user: User): Observable<any> {
    let headers = new HttpHeaders({
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Origin': '*',
    });
    let options = { headers: headers };
    return this._http.post<any>(this.addUserUrl, user, options);
  }

  getToken(user: any) {
    let headers = new HttpHeaders({
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Origin': '*',
    });
    let options = { headers: headers };
    return this._http.post(this.apiUrlObtenerToken, user, options);
  }

  getUserByToken(token: User) {
    let headers = new HttpHeaders({
      Authorization: 'Bearer ' + token.token,
    });
    let options = { headers: headers };
    return this._http.post<User>(this.userByTokenUrl, token, options);
  }

  getUsersBySearch(search: OrdinaryObject, token: User) {
    let headers = new HttpHeaders({
      Authorization: 'Bearer ' + token.token,
    });
    let options = { headers: headers };
    return this._http.post<User[]>(this.getUsersBySearchURL, search, options);
  }

  // getCommunitiesBySearch(search: OrdinaryObject, token: User) {
  //   let headers = new HttpHeaders({
  //     Authorization: 'Bearer ' + token.token,
  //   });
  //   let options = { headers: headers };
  //   return this._http.post<Comunity[]>(
  //     this.getCommunitiesBySearchURL,
  //     search,
  //     options
  //   );
  // }

  postAuthentication(user: any) {
    return this._http.post(this.apiUrlAuthentication, user);
  }

  //Post para traer todos los cursos de la base de datos
  getCourses(token: User) {
    let headers = new HttpHeaders({
      Authorization: 'Bearer ' + token.token,
    });
    let options = { headers: headers };
    return this._http.post<any>(this.coursesUrl, token, options);
  }

  //Posta para agregar comunidad
  saveComunity(comunity: any, token: User) {
    let headers = new HttpHeaders({
      Authorization: 'Bearer ' + token.token,
    });
    let options = { headers: headers };
    return this._http.post(this.addComunityUrl, comunity, options);
  }

  // saveComunityAssign(communityAssign: ComunityAssign, user: User) {
  //   let headers = new HttpHeaders({
  //     Authorization: 'Bearer ' + user.token,
  //   });
  //   let options = { headers: headers };
  //   return this._http.post(
  //     this.saveComunityAssignURL,
  //     communityAssign,
  //     options
  //   );
  // }
  // /**
  //  *
  //  * @param user Devuelve todas las comunidades que un usuario halla creado
  //  */
  // findComunytyByRegistroAcademico(user: User) {
  //   let headers = new HttpHeaders({
  //     Authorization: 'Bearer ' + user.token,
  //   });
  //   let options = { headers: headers };
  //   return this._http.post<ComunityAssign[]>(
  //     this.findComunytyByRegistroAcademicoUrl,
  //     user,
  //     options
  //   );
  // }
  // /**
  //  * Devulve un ComunityAssign que coincida con el id de la comunidad, si esta existe
  //  * @param comunity ,se necesita el id de la comunidad
  //  */
  // findComunityById(comunity: Comunity, user: User) {
  //   let headers = new HttpHeaders({
  //     Authorization: 'Bearer ' + user.token,
  //   });
  //   let options = { headers: headers };
  //   return this._http.post<ComunityAssign>(
  //     this.findComunityByIdURL,
  //     comunity,
  //     options
  //   );
  // }

  findUserById(searchUsr: User, token: User) {
    let headers = new HttpHeaders({
      Authorization: 'Bearer ' + token.token,
    });
    let options = { headers: headers };
    return this._http.post<User>(this.findUserByIdURL, searchUsr, options);
  }

  // findSuscriptionComunity(comunityAssign: ComunityAssign, user: User) {
  //   let headers = new HttpHeaders({
  //     Authorization: 'Bearer ' + user.token,
  //   });
  //   let options = { headers: headers };
  //   return this._http.post<ComunityAssign>(
  //     this.findSuscriptionComunityURL,
  //     comunityAssign,
  //     options
  //   );
  // }

  // /**
  //  * Devuelve las comunidades a las que pertenece un usuario,
  //  * Es decir sea MIEMBRO y este ACTIVO
  //  * @param user
  //  */
  // findUserComunitys(user: User) {
  //   let headers = new HttpHeaders({
  //     Authorization: 'Bearer ' + user.token,
  //   });
  //   let options = { headers: headers };
  //   return this._http.post<ComunityAssign[]>(
  //     this.findUserComunitysURL,
  //     user,
  //     options
  //   );
  // }

  public getLoggedIn() {
    return this.loggedIn;
  }
  public setLoggedIn(a: boolean) {
    this.loggedIn = a;
  }

  public trueLoggedIn() {
    this.loggedIn = true;
  }

  public getTokenSession() {}

  updateUser(user: any) {
    return this._http.post(
      this.userUpdateUrl,
      user,
      this.controllHeader.obtenerHeaderConToken(user.token)
    );
  }

  updateAnyUser(user: any, token: string): any {
    return this._http.post(
      this.userUpdateUrl,
      user,
      this.controllHeader.obtenerHeaderConToken(token)
    );
  }

  // persistCommunityPost(post: CommunityPost, token: User) {
  //   let headers = new HttpHeaders({
  //     Authorization: 'Bearer ' + token.token,
  //   });
  //   let options = { headers: headers };
  //   return this._http.post<CommunityPost>(
  //     this.communityPostCreateURL,
  //     post,
  //     options
  //   );
  // }

  // getAllCommunityPostByCommunity(params: OrdinaryObject, token: User) {
  //   let headers = new HttpHeaders({
  //     Authorization: 'Bearer ' + token.token,
  //   });
  //   let options = { headers: headers };
  //   return this._http.post<CommunityPost[]>(
  //     this.findAllCommunityPostByCommunityURL,
  //     params,
  //     options
  //   );
  // }

  // getAllCommunityPostByCommunityWithFilters(params: any, token: User) {
  //   let headers = new HttpHeaders({
  //     Authorization: 'Bearer ' + token.token,
  //   });
  //   let options = { headers: headers };
  //   return this._http.post<CommunityPost[]>(
  //     this.findAllCommunityPostByCommunityFiltersURL,
  //     params,
  //     options
  //   );
  // }

  getAllUsersInCommunity(params: OrdinaryObject, token: User) {
    let headers = new HttpHeaders({
      Authorization: 'Bearer ' + token.token,
    });
    let options = { headers: headers };
    return this._http.post<User[]>(
      this.findAllUsersInCommunityURL,
      params,
      options
    );
  }

  public getLogger$(): Subject<boolean> {
    return this.logger$;
  }
  public setLogger$(a: Subject<boolean>) {
    this.logger$ = a;
  }
}
