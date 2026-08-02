import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import jwt_decode from 'jwt-decode';

import { environment } from '@environments/enviroment';
import { User } from '@app/models/system/user.model';
import { Role } from '@app/models';

/** Claves de localStorage de la sesion. */
export const USER_KEY = 'user';
export const ACCESS_TOKEN_KEY = 'accessToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';

// Nota: aqui vivian undefinedStatus/activeStatus/deleteStatus/undefinedRole, que codificaban
// el catalogo de estados del backend Mongo (ids 1/2/3). Ya no aplican: en Postgres los estados
// de usuario son 2 Activo, 6 Inactivo, 8 Eliminado. El deleteStatus que sigue en uso es el
// exportado por data.service.ts, que es otro.

const menuItemsOptions: any = [
  {
    button_type: 'button',
    button_class: 'list-group-item principal-bottom',
    button_toggle: 'collapse',
    button_data_bs_toggle: 'collapse',
    button_data_bs_target: '#administrar-lvl1',
    button_aria_controls: 'administrar-lvl1',
    button_aria_expanded: 'false',
    button_icon_class: 'material-icons icon',
    button_icon: 'admin_panel_settings',
    button_name: 'Sistema',
    button_dropdown_icon_class: 'material-icons icon',
    button_dropdown_icon: 'arrow_drop_down',
    root_id: 'administrar-lvl1',
    root_class: 'panel-collapse collapse',
    sub_class: 'position-sticky',
    is_tree: true,
    childs: [
      {
        root_class: 'list-group list-group-flush',
        router_link: '/users',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Usuarios',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/establishments',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Tiendas',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/customers',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Clientes',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
    ],
  },
  {
    button_type: 'button',
    button_class: 'list-group-item principal-bottom',
    button_toggle: 'collapse',
    button_data_bs_toggle: 'collapse',
    button_data_bs_target: '#reports-lvl1',
    button_aria_controls: 'reports-lvl1',
    button_aria_expanded: 'false',
    button_icon_class: 'material-icons icon',
    button_icon: 'description',
    button_name: 'Reportes',
    button_dropdown_icon_class: 'material-icons icon',
    button_dropdown_icon: 'arrow_drop_down',
    root_id: 'reports-lvl1',
    root_class: 'panel-collapse collapse',
    sub_class: 'position-sticky',
    is_tree: true,
    childs: [
      {
        root_class: 'list-group list-group-flush',
        router_link: '/summary/rawMaterialByProvider/order',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Pedidos de materia prima',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/summary/inventory/factory/rawMaterial',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Inventario de materia prima',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/summary/inventory/factory/finishedProduct',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Inventario de productos',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/summary/inventory/store/productForSale',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Inventario de producto en tiendas',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/summary/productForSale/store/order',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Listado de pedidos',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
    ],
  },
  {
    button_type: 'button',
    button_class: 'list-group-item principal-bottom',
    button_toggle: 'collapse',
    button_data_bs_toggle: 'collapse',
    button_data_bs_target: '#providers-lvl1',
    button_aria_controls: 'providers-lvl1',
    button_aria_expanded: 'false',
    button_icon_class: 'material-icons icon',
    button_icon: 'local_shipping',
    button_name: 'Proveedores',
    button_dropdown_icon_class: 'material-icons icon',
    button_dropdown_icon: 'arrow_drop_down',
    root_id: 'providers-lvl1',
    root_class: 'panel-collapse collapse',
    sub_class: 'position-sticky',
    is_tree: true,
    childs: [
      {
        root_class: 'list-group list-group-flush',
        router_link: '/rawMaterials',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Materia prima',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/providers',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Registro proveedores',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/rawMaterialsByProvider',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Ingreso de proveedores',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/empaques',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Material de Empaque',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/rawMaterialByProvider/order',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Pedidos de materia prima',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/empaques/order',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Pedidos de material de empaque',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
    ],
  },
  {
    button_type: 'button',
    button_class: 'list-group-item principal-bottom',
    button_toggle: 'collapse',
    button_data_bs_toggle: 'collapse',
    button_data_bs_target: '#fabrica-lvl1',
    button_aria_controls: 'fabrica-lvl1',
    button_aria_expanded: 'false',
    button_icon_class: 'material-icons icon',
    button_icon: 'shelves',
    button_name: 'Bodega',
    button_dropdown_icon_class: 'material-icons icon',
    button_dropdown_icon: 'arrow_drop_down',
    root_id: 'fabrica-lvl1',
    root_class: 'panel-collapse collapse',
    sub_class: 'position-sticky',
    is_tree: true,
    childs: [
      {
        root_class: 'list-group list-group-flush',
        router_link: '/finishedProducts',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Listado de productos',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/inventory/factory/rawMaterial',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Inventario de materia prima',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/inventory/warehouse/packagingMaterial',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Inventario de Material de Empaque',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/consumeRawMaterial',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Consumir materia prima de inventario',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/consumePackagingMaterial',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Consumir material de empaque',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/productCreation',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Registrar productos en inventario',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/inventory/factory/finishedProduct',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Inventario de productos',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/finishedProduct/order',
        query_params: { opt: 'factory' },
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Pedidos',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/abarrotes',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Listado de abarrotes',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
    {
        root_class: 'list-group list-group-flush',
        router_link: '/abarroteCreation',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Registrar abarrotes en inventario',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/inventory/factory/abarrote',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Inventario de abarrotes',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
    ],
  },
  {
    button_type: 'button',
    button_class: 'list-group-item principal-bottom',
    button_toggle: 'collapse',
    button_data_bs_toggle: 'collapse',
    button_data_bs_target: '#store-lvl1',
    button_aria_controls: 'store-lvl1',
    button_aria_expanded: 'false',
    button_icon_class: 'material-icons icon',
    button_icon: 'storefront',
    button_name: 'Tienda',
    button_dropdown_icon_class: 'material-icons icon',
    button_dropdown_icon: 'arrow_drop_down',
    root_id: 'store-lvl1',
    root_class: 'panel-collapse collapse',
    sub_class: 'position-sticky',
    is_tree: true,
    childs: [
      {
        root_class: 'list-group list-group-flush',
        router_link: '/store',
        query_params: { opt: 'inventory' },
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Listado de Tiendas',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/store/sales/summary',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Resumen de ventas',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
    ],
  },
];

@Injectable({ providedIn: 'root' })
export class AccountService {
  private userSubject: BehaviorSubject<any>;
  public user: Observable<any>;

  constructor(
    private router: Router,
    private http: HttpClient,
  ) {
    this.userSubject = new BehaviorSubject(
      JSON.parse(localStorage.getItem('user')!),
    );
    this.user = this.userSubject.asObservable();
  }

  public get userValue() {
    return this.userSubject.value;
  }

  public get userName() {
    return this.userValue?.name;
  }

  public get userRole() {
    return this.userValue?.role;
  }

  public get userEmail() {
    return this.userValue?.correo;
  }

  setUserSubject(user: User) {
    this.userSubject.next(user);
  }

  public get userValueFixed() {
    let userValue = this.userSubject.value;
    let logedUser: User = {
      name: userValue?.name,
      email: userValue?.correo,
      id: userValue?.userID,
    };
    return logedUser;
  }

  /**
   * Inicia sesion contra el backend Postgres. Una sola llamada: la respuesta ya trae el perfil
   * completo con role.paths, asi que no hace falta pedir /getUser despues (esa llamada iba sin
   * autenticar y ademas devolvia el hash de la contrasena).
   */
  login(email: string, password: string) {
    return this.http
      .post<any>(`${environment.apiUrlBase}/Login`, { email, password })
      .pipe(
        map((response) => {
          this.startSession(response);
          return response.user as User;
        }),
      );
  }

  /**
   * Guarda la sesion. El token crudo se persiste: sin esto el JwtInterceptor no tiene nada que
   * adjuntar y las peticiones salen anonimas (era el fallo de raiz del esquema anterior).
   */
  private startSession(response: any) {
    const decoded: any = jwt_decode(response.token);
    const profile = response.user ?? {};

    const logedUser: User = {
      ...profile,
      id: profile.id,
      uuid: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      status: profile.status,
    };

    localStorage.setItem(ACCESS_TOKEN_KEY, response.token);
    if (response.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    }
    localStorage.setItem(USER_KEY, JSON.stringify({ ...decoded, ...logedUser }));

    this.userSubject.next({ ...decoded, ...logedUser });
  }

  public get accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  public get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  /** true si no hay token o si su `exp` ya paso. Un token ilegible se trata como vencido. */
  public isAccessTokenExpired(): boolean {
    const token = this.accessToken;
    if (!token) {
      return true;
    }

    try {
      const { exp }: any = jwt_decode(token);
      return !exp || exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }

  /**
   * Canjea el refresh token por una sesion nueva. El backend rota el refresh en cada uso, por
   * eso hay que guardar el que devuelve.
   */
  refreshSession(): Observable<boolean> {
    const refreshToken = this.refreshToken;

    if (!refreshToken) {
      return of(false);
    }

    return this.http
      .post<any>(`${environment.apiUrlBase}/Refresh`, { refreshToken })
      .pipe(
        map((response) => {
          this.startSession(response);
          return true;
        }),
        catchError(() => of(false)),
      );
  }

  private clearSession() {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this.userSubject.next(null);
  }

  /**
   * Cierra la sesion. Se avisa al backend para revocar el refresh token: sin eso el token
   * seguiria siendo valido hasta expirar aunque el usuario haya salido.
   */
  logout() {
    const refreshToken = this.refreshToken;

    if (refreshToken) {
      this.http
        .post(`${environment.apiUrlBase}/Logout`, { refreshToken })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }

    this.clearSession();
    this.router.navigate(['/account/login']);
  }

  /** Autorregistro publico. El backend fuerza rol Indefinido y estado Inactivo. */
  registerV3(user: User & { password?: string }) {
    return this.http.post(`${environment.apiUrlBase}/RegisterUser`, {
      name: user.name,
      email: user.email,
      password: user.password,
      phone: user.phone ? Number(user.phone) : 0,
    });
  }

  /** Alta desde el portal. Va por funcion propia porque guarda el hash de la contrasena. */
  createUserV3(user: User & { password?: string }) {
    return this.http.post(`${environment.apiUrlBase}/CreateUser`, {
      name: user.name,
      email: user.email,
      password: user.password,
      phone: user.phone ? Number(user.phone) : 0,
      roleId: user.role?.id,
      statusId: user.status?.id,
    });
  }

  getAllUsersByFilter(params: any) {
    // let headers = new HttpHeaders({
    //     Authorization: 'Bearer ' + this.userValue?.token,
    // });
    // let options = { headers: headers };
    let parameters = JSON.stringify({
      u: {
        ...params,
      },
    });
    return this.http.post(`${environment.apiUrlV3}/retrieveUsers`, parameters);
  }

  getUserById(id: string) {
    let params = JSON.stringify({ u: { id: id } });
    return this.http.post(`${environment.apiUrlV3}/getUser`, params);
  }

  getUserByEmail(email: string) {
    let params = JSON.stringify({ u: { email: email } });
    return this.http.post(`${environment.apiUrlV3}/getUser`, params);
  }

  /**
   * Edicion desde el portal. Va por funcion propia porque puede cambiar la contrasena, que
   * necesita el hash del backend. `password` es opcional: si no viene, no se toca.
   */
  updateUserV3(id: string, params: any) {
    return this.http
      .post(`${environment.apiUrlBase}/UpdateUser`, {
        id,
        name: params.name,
        phone: params.phone ? Number(params.phone) : 0,
        statusId: params.status?.id,
        roleId: params.role?.id,
        ...(params.password ? { password: params.password } : {}),
      })
      .pipe(
        map((x) => {
          // Si el usuario se edito a si mismo, refrescar la copia local de la sesion.
          if (id === this.userValue?.uuid) {
            const user = { ...this.userValue, ...params };
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            this.userSubject.next(user);
          }
          return x;
        }),
      );
  }

  /** Baja logica (status Eliminado). Devuelve true si el usuario se elimino a si mismo. */
  deleteUserV3(id: string) {
    let modifyUser = JSON.stringify({
      $1: id,
    });
    return this.http
      .patch(`${environment.apiUrlV3}/deleteUser`, modifyUser)
      .pipe(map(() => id === this.userValue?.uuid));
  }

  isActiveUser() {
    return this.userValue?.status == 1;
  }

  isAdminUser() {
    return this.userValue.role.id === 1;
  }

  isSalesUser() {
    return this.userValue.role.id === 3;
  }

  isLoginUser(userId: string) {
    return this.userValue.userID === userId;
  }

  /**
   * Resuelve la sesion actual para los guards. Antes solo miraba localStorage, asi que un token
   * vencido seguia dando acceso al portal; ahora, si expiro, intenta renovarlo y solo deja
   * pasar si el backend acepta el refresh.
   */
  checkLogin(): Observable<any> {
    if (!this.userValue || !this.accessToken) {
      return of(null);
    }

    if (!this.isAccessTokenExpired()) {
      return of(this.userValue);
    }

    return this.refreshSession().pipe(map((ok) => (ok ? this.userValue : null)));
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
    const emailPattern =
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
    const matches = text.match(emailPattern);
    return matches ?? [];
  }

  getUserMenuItems() {
    let menuItems: any = [];
    let copy_menuItemsOptions = structuredClone(menuItemsOptions);
    for (let item of copy_menuItemsOptions) {
      let userPaths = this.userValue?.role?.paths || [];
      let newItem = item;
      let newItemChilds = [];
      for (let child of item.childs) {
        let destinationRoute = child.router_link;
        if (child.query_params) {
          destinationRoute += '?';
          for (let key in child.query_params) {
            destinationRoute += key + '=' + child.query_params[key] + '&';
          }
          destinationRoute = destinationRoute.slice(0, -1);
        }
        const destinationRouteFound = userPaths.find((route: any) => {
          const currRegex = new RegExp(route.matchPattern);
          const regex_test_result = currRegex.test(destinationRoute);
        //   console.log(`Testing route: ${destinationRoute} against pattern: ${route.matchPattern} - Result: ${regex_test_result}`);
          return regex_test_result;
        });
        if (destinationRouteFound) {
          newItemChilds.push(child);
        }
      }
      newItem.childs = newItemChilds;
      if (newItemChilds.length > 0) {
        menuItems.push(newItem);
      }
    }
    // console.log(menuItems);
    return menuItems;
  }

  findJsonValue(obj: any, targetKey: string): any | null {
    if (obj == null || typeof obj !== 'object') return null;

    if (targetKey in obj) {
      return obj[targetKey];
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = this.findJsonValue(item, targetKey);
        if (result !== null) return result;
      }
    }

    for (const key of Object.keys(obj)) {
      const result = this.findJsonValue(obj[key], targetKey);
      if (result !== null) return result;
    }

    return null;
  }
}
