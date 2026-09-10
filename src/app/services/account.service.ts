import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { concatMap, map } from 'rxjs/operators';
import jwt_decode from 'jwt-decode';

import { environment } from '@environments/enviroment';
import { User } from '@app/models/system/user.model';
import { Role } from '@app/models';

const undefinedStatus = {
  status: {
    id: 1,
    status: 1,
    text: '0',
    identifier: 'Inactivo',
  },
};

const activeStatus = {
  status: {
    id: 2,
    status: 1,
    text: '1',
    identifier: 'Activo',
  },
};

const deleteStatus = {
  status: {
    id: 3,
    status: 1,
    text: '2',
    identifier: 'Eliminado',
  },
};

const undefinedRole = {
  role: {
    id: 6,
    status: 1,
    text: '6',
    identifier: 'Indefinido',
  },
};

/** Rol Sistema. Es el unico que puede asignar o quitar el rol Sistema a un usuario. */
export const SYSTEM_ROLE_ID = 1;

/**
 * Acciones que se pueden delegar a un rol distinto de Sistema. Se declaran en la columna
 * role.paths de la base como entradas "perm:<capacidad>", que viajan en el JWT junto con las
 * rutas. El guard las ignora porque nunca matchean una URL; solo las lee AccountService.can().
 *
 * Habilitar una accion a un rol nuevo es un UPDATE en la tabla role, sin tocar este archivo.
 * Ver src/database/migrations/2026-08-14-capacidades-por-rol.sql
 */
export const CAPABILITIES = {
  /** Agregar, quitar y devolver a bodega en el inventario de tienda. */
  inventoryStoreWrite: 'inventory.store.write',
  /** Agregar y quitar en el inventario de productos de fabrica. */
  inventoryFactoryFinishedProductWrite: 'inventory.factory.finishedProduct.write',
  /** Agregar y quitar en el inventario de abarrotes (misma pantalla, productType 2). */
  inventoryFactoryAbarroteWrite: 'inventory.factory.abarrote.write',
  /** Agregar y quitar en el inventario de materia prima de fabrica. */
  inventoryFactoryRawMaterialWrite: 'inventory.factory.rawMaterial.write',
  /** Agregar y quitar en el inventario de material de empaque (misma pantalla, materialType 2). */
  inventoryFactoryPackagingMaterialWrite: 'inventory.factory.packagingMaterial.write',
  /** Agregar y quitar en el inventario de bodega. El boton "Mover" no depende de esto. */
  inventoryBodegaWrite: 'inventory.bodega.write',
  /** Ver el costo del producto para venta. Define ademas que endpoint se pide. */
  costRead: 'cost.read',
  /** Editar el costo del producto para venta, individual y masivo. */
  costWrite: 'cost.write',
  /**
   * Editar un pedido ya creado, incluso mientras sigue Pendiente. Sin esto la tienda crea
   * el pedido y ya no lo corrige: el boton Editar no aparece y la pantalla de edicion
   * rebota. No gobierna la creacion.
   */
  ordersEdit: 'orders.edit',
  /**
   * Editar un pedido que ya salio del estado Pendiente. Es una extension de orders.edit:
   * sin esa capacidad base no habilita nada.
   */
  ordersEditAfterPending: 'orders.editAfterPending',
  /**
   * Editar un pedido que ya esta en Listo. Tercer escalon de la escalera
   * orders.edit -> orders.editAfterPending -> orders.editReady: hacen falta las tres.
   *
   * Es aparte porque en Listo el producto YA salio de bodega: editar mueve inventario
   * -descuenta lo que se agrega, devuelve lo que se quita- y le quita la verificacion
   * al pedido si cambian los productos.
   */
  ordersEditReady: 'orders.editReady',
  /** Campos extra del formulario de alta y edicion de pedido. */
  ordersViewProperties: 'orders.viewProperties',
  /** Mover en el tablero tarjetas que tienen a otra persona como encargada. */
  ordersBoardOverrideOwner: 'orders.board.overrideOwner',
  /** Devolver un pedido de En curso a Pendiente. El encargado siempre puede con el suyo. */
  ordersRelease: 'orders.release',
  /**
   * Verificar un pedido que esta en Preparado, adelantando la firma. NO gobierna la verificacion
   * obligatoria al pasar a Listo: esa la puede hacer cualquiera que pueda cerrar el pedido.
   */
  ordersVerify: 'orders.verify',
  /** Editar y eliminar usuarios. No alcanza para asignar el rol Sistema. */
  usersManage: 'users.manage',
  /** Ver todas las tiendas sin estar asignado por correo en la descripcion. */
  establishmentsViewAll: 'establishments.viewAll',
} as const;

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
        router_link: '/finishedProduct/order/board',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Tablero de pedidos',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/finishedProduct/order/prepared',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Pedidos preparados',
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
      // Las acciones por tienda (inventario, ventas, pedidos, gastos, clientes y caja) se eligen
      // desde la tabla del listado, no desde el menu.
      {
        root_class: 'list-group list-group-flush',
        router_link: '/store',
        query_params: { opt: 'inventory' },
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Listado de Tiendas',
        icon_name: 'storefront',
        icon_class: 'material-icons icon',
      },
      {
        root_class: 'list-group list-group-flush',
        router_link: '/store/sales/summary',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Resumen de ventas',
        icon_name: 'summarize',
        icon_class: 'material-icons icon',
      },
    ],
  },
  {
    button_type: 'button',
    button_class: 'list-group-item principal-bottom',
    button_toggle: 'collapse',
    button_data_bs_toggle: 'collapse',
    button_data_bs_target: '#consultas-lvl1',
    button_aria_controls: 'consultas-lvl1',
    button_aria_expanded: 'false',
    button_icon_class: 'material-icons icon',
    button_icon: 'fact_check',
    button_name: 'Consultas',
    button_dropdown_icon_class: 'material-icons icon',
    button_dropdown_icon: 'arrow_drop_down',
    root_id: 'consultas-lvl1',
    root_class: 'panel-collapse collapse',
    sub_class: 'position-sticky',
    is_tree: true,
    childs: [
      {
        root_class: 'list-group list-group-flush',
        router_link: '/consultas/pedidos/dashboard',
        link_class: 'list-group-item py-2 ripple',
        link_name: 'Pedidos por tienda',
        icon_name: 'arrow_right',
        icon_class: 'material-icons icon',
      },
      // {
      //   root_class: 'list-group list-group-flush',
      //   router_link: '/consultas/pedidos',
      //   link_class: 'list-group-item py-2 ripple',
      //   link_name: 'Pedidos',
      //   icon_name: 'arrow_right',
      //   icon_class: 'material-icons icon',
      // },
      // {
      //   root_class: 'list-group list-group-flush',
      //   router_link: '/consultas/ventas',
      //   link_class: 'list-group-item py-2 ripple',
      //   link_name: 'Ventas',
      //   icon_name: 'arrow_right',
      //   icon_class: 'material-icons icon',
      // },
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

  login(email: string, password: string) {
    let headers = new HttpHeaders({
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Origin': '*',
    });
    let options = { headers: headers };
    let loginUser = JSON.stringify({
      loginUser: {
        email: email,
        password: password,
      },
    });
    return this.http
      .post(`${environment.apiUrlV2}/LoginUser`, loginUser, options)
      .pipe(
        concatMap((user: any) => {
          let usr = user.loginUserResponse.token;
          // store user details and jwt token in local storage to keep user logged in between page refreshes
          let jwd_decoded_usr: any = jwt_decode(usr);
          let logedUser: User = {
            ...jwd_decoded_usr,
            name: jwd_decoded_usr.name,
            email: jwd_decoded_usr.correo,
            _id: jwd_decoded_usr.userID,
          };
          localStorage.setItem('user', JSON.stringify(jwt_decode(usr)));
          this.userSubject.next(logedUser);
          return this.getUserByEmail(logedUser.email!);
        }),
      );
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
      },
    });
    // let newUser = { ...user };
    return this.http.post(`${environment.apiUrlV2}/newUser`, newUser);
  }

  registerV3(user: User) {
    let newUser = JSON.stringify({
      $1: user.ext_id,
      $2: user.name,
      $3: user.email,
      $4: user.role?.id,
    });
    return this.http.patch(`${environment.apiUrlV3}/registerUser`, newUser);
  }

  create(user: User) {
    let newUser = JSON.stringify({
      newUser: {
        ...user,
      },
    });
    // let newUser = { ...user };
    return this.http.post(`${environment.apiUrlV2}/newUser`, newUser);
  }

  createUserV3(user: User) {
    let newUser = JSON.stringify({
      $1: user.name,
      $2: user.status?.id,
      $3: user.email,
      $4: user.phone ? user.phone : 0,
      $5: user.role?.id,
      $6: user.ext_id,
    });
    return this.http.patch(`${environment.apiUrlV3}/createUser`, newUser);
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

  getUserByIdV2(id: string) {
    let params = JSON.stringify({ retrieveUsers: { _id: id } });
    return this.http.post(`${environment.apiUrlV2}/retrieveUsers`, params);
  }

  getUserByEmail(email: string) {
    let params = JSON.stringify({ u: { email: email } });
    return this.http.post(`${environment.apiUrlV3}/getUser`, params);
  }

  getUserByEmailV2(email: string) {
    let params = JSON.stringify({ retrieveUsers: { email: email } });
    return this.http.post(`${environment.apiUrlV2}/retrieveUsers`, params);
  }

  update(id: string, params: any) {
    let modifyUser = JSON.stringify({
      updateUser: {
        _id: params.ext_id,
        ...params,
      },
    });
    return this.http
      .post(`${environment.apiUrlV2}/ModifyUser`, modifyUser)
      .pipe(
        map((x) => {
          // update stored user if the logged in user updated their own record
          if (id == this.userValue?._id) {
            // update local storage
            const user = { ...this.userValue, ...params };
            localStorage.setItem('user', JSON.stringify(user));

            // publish updated user to subscribers
            this.userSubject.next(user);
          }
          return x;
        }),
      );
  }

  updateUserV3(id: string, params: any) {
    let modifyUser = JSON.stringify({
      $1: params.name,
      $2: params.phone ? params.phone : 0,
      $3: params.status?.id,
      $4: params.role?.id,
      $5: id,
    });
    return this.http.patch(`${environment.apiUrlV3}/updateUser`, modifyUser);
  }

  deleteUserV3(id: string) {
    let modifyUser = JSON.stringify({
      $1: id,
    });
    return this.http.patch(`${environment.apiUrlV3}/deleteUser`, modifyUser);
  }

  deleteUser(params: any) {
    let deleteUser = JSON.stringify({
      updateUser: {
        _id: params.ext_id,
        ...params,
        ...deleteStatus,
      },
    });
    return this.http
      .post(`${environment.apiUrlV2}/ModifyUser`, deleteUser)
      .pipe(
        map((x) => {
          // auto logout if the logged in user deleted their own record
          if (params._id === this.userValue?.userID) {
            return true;
          }
          return false;
        }),
      );
  }

  isActiveUser() {
    return this.userValue?.status == 1;
  }

  isAdminUser() {
    return this.isSystemRole(this.userValue?.role);
  }

  /** ¿El rol recibido es el rol Sistema? */
  isSystemRole(role?: Role | null): boolean {
    return role != null && String(role.id) === String(SYSTEM_ROLE_ID);
  }

  /**
   * ¿El rol del usuario logueado tiene esta capacidad? Se declaran en role.paths como entradas
   * "perm:<capacidad>" y se evaluan con el mismo regex que las rutas, pero contra el nombre de la
   * capacidad en vez de contra la URL. Como toda ruta empieza con "/" y toda capacidad con "perm:",
   * los dos tipos de entrada nunca se cruzan.
   *
   * El rol Sistema las tiene todas sin necesidad de declararlas.
   */
  can(capability: string): boolean {
    if (this.isAdminUser()) {
      return true;
    }
    const paths = this.userValue?.role?.paths || [];
    const target = 'perm:' + capability;
    return paths.some((path: any) => {
      // Sin patron no se evalua: new RegExp(undefined) matchea cualquier cosa.
      if (!path?.matchPattern) {
        return false;
      }
      return new RegExp(path.matchPattern).test(target);
    });
  }

  /**
   * ¿Puede el usuario logueado asignar este rol? El rol Sistema solo lo asigna un usuario Sistema;
   * cualquier otro rol lo puede asignar quien tenga acceso al mantenimiento de usuarios.
   */
  canAssignRole(role?: Role | null): boolean {
    return this.isAdminUser() || !this.isSystemRole(role);
  }

  /** Roles que el usuario logueado puede asignar (todos menos Sistema si no es Sistema). */
  assignableRoles(roles?: Role[] | null): Role[] {
    return (roles || []).filter((role) => this.canAssignRole(role));
  }

  /**
   * ¿Puede el usuario logueado cambiar el rol del usuario recibido? El rol de un usuario Sistema
   * (asignarlo o quitarlo) solo lo modifica otro usuario Sistema.
   */
  canEditUserRole(user?: User | null): boolean {
    return this.canAssignRole(user?.role);
  }

  isLoginUser(userId: string) {
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
    const emailPattern =
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
    const matches = text.match(emailPattern);
    return matches ?? [];
  }

  /**
   * ¿La tienda está asignada al usuario logueado? La asignación se hace escribiendo su correo en la
   * descripción del establecimiento. Quien tenga establishmentsViewAll las ve todas sin necesidad
   * de estar asignado; el rol Sistema entra por ahí.
   */
  isAssignedEstablishment(establishment: any): boolean {
    if (this.can(CAPABILITIES.establishmentsViewAll)) {
      return true;
    }
    const userEmail = this.userEmail;
    if (!userEmail) {
      return false;
    }
    return this.extractEmails(establishment?.description).includes(userEmail);
  }

  /** Deja solo las tiendas que el usuario tiene asignadas (todas si es admin). */
  filterAssignedEstablishments<T>(establishments?: T[]): T[] {
    return (establishments || []).filter(establishment => this.isAssignedEstablishment(establishment));
  }

  getUserMenuItems() {
    let menuItems: any = [];
    let copy_menuItemsOptions = structuredClone(menuItemsOptions);
    for (let item of copy_menuItemsOptions) {
      let userPaths = this.userValue?.role?.paths || [];
      let newItem = item;
      let newItemChilds = [];
      for (let child of item.childs) {
        // Las secciones de tienda no llevan router_link: su URL depende de la tienda seleccionada,
        // asi que los permisos se evaluan contra una ruta de muestra.
        let destinationRoute = child.match_route ?? child.router_link;
        if (child.query_params) {
          destinationRoute += '?';
          for (let key in child.query_params) {
            destinationRoute += key + '=' + child.query_params[key] + '&';
          }
          destinationRoute = destinationRoute.slice(0, -1);
        }
        const destinationRouteFound = userPaths.find((route: any) => {
          // Sin patron no se evalua: new RegExp(undefined) matchea cualquier ruta.
          if (!route?.matchPattern) {
            return false;
          }
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
