import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { DataService } from '@app/services';
import { User } from '@app/models';

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  /**
   * Para poder usuar el servicio, con variables observables hay que:
   *    1)IMportar el servicio
   *    2)Cambiar en el metodo ngOnInit el servicio y el metodo
   *    3)Cambiar la variable de servicio donde se cierre session o abra session o se use algun metodo de ese tipo
   * Para usarlo para sabr si hay una session se debe
   *    1)Importar el servicio
   *    2)Usar el servicio con su metodo exitSession()
   *
   */

  private userRole: string = '';

  //Variables
  token: any;

  //Rutas
  apiUrlObtenerToken = 'http://localhost:8080/token';

  //Varables para el observable
  private logger$ = new Subject<boolean>(); //Va a emitir un evento
  private loggedIn: boolean;

  constructor(private _http: HttpClient, private dataService: DataService) {
    if (localStorage.getItem('user') === null) {
      //No hay session
      this.loggedIn = false;
      //this.asignarTipodeUsuarioSinSesion()
    } else {
      this.loggedIn = true;
      this.dataService
        .getUserByToken(this.getUserWithToken())
        .subscribe((response) => {
          var user = response;
          this.assignUserRolesWithSession(user);
        });

      //this.asignarTipoDeUsuarioConSesion()
    }
  }

  //Generar el observable
  loggedIn$(): Observable<boolean> {
    return this.logger$.asObservable();
  }

  //Inicio de sesion, llamarlo cuando se necesita iniciar la sesion
  //El usuario debe llevar registroAcademico y contrasenia
  logIn(user: User) {
    let headers = new HttpHeaders({
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Origin': '*',
    });
    let options = { headers: headers };
    this._http.post(this.apiUrlObtenerToken, user, options).subscribe(
      (result) => {
        localStorage.setItem('user', JSON.stringify(result));
        if (result != null) {
          this.loggedIn = true;
          this.logger$.next(this.loggedIn); //Avisar a los observadores el cambio del valor de la variable
        }
      },
      (error) => {
        this.logger$.next(this.loggedIn);
      }
    );
  }

  //CIerra la sesion, llamarlo cuando se va a cerrar la sesion
  log0ut() {
    this.loggedIn = false;
    localStorage.clear();
    this.logger$.next(this.loggedIn); //Avisar a los observadores el cambio del valor de la variable
  }

  getUserWithToken(): User {
    var user: User = new User();
    user.token = this.getToken();
    return user;
  }

  //Regresa el token de sesion en forma de JSON, si no hay token regresa null
  getToken(): any {
    this.token = localStorage.getItem('user');
    if (this.token != null) {
      this.token = JSON.parse(this.token).token;
    }
    return this.token;
  }

  //Devuelve true si existe una sesion
  public existSession(): boolean {
    return this.loggedIn;
  }

  //Se asigna el tipo de usuario
  assignUserRolesWithSession(user: User) {
    if(user){
      if (user.role)
        this.userRole = user.role;
    }
  }

  assignUserRolesWithoutSession() {
    this.userRole = '';
  }

  getUserRoles(){
    return this.userRole;
  }

  userHasRole(role: string){
    return this.userRole == role;
  }

  public getLogger() {
    return this.logger$;
  }

  //Getter
  public getLoggedIn(){
    return this.loggedIn;
  }


}
