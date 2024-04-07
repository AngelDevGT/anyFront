import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { Router } from '@angular/router';

declare interface RouteInfo {
    path: string;
    title: string;
    icon: string;
    class: string;
}
// export const ROUTES: RouteInfo[] = [
//     { path: '/dashboard', title: 'Dashboard',  icon: 'ni-tv-2 text-primary', class: '' },
//     { path: '/icons', title: 'Icons',  icon:'ni-planet text-blue', class: '' },
//     { path: '/maps', title: 'Maps',  icon:'ni-pin-3 text-orange', class: '' },
//     { path: '/user-profile', title: 'User profile',  icon:'ni-single-02 text-yellow', class: '' },
//     { path: '/tables', title: 'Tables',  icon:'ni-bullet-list-67 text-red', class: '' },
//     { path: '/login', title: 'Login',  icon:'ni-key-25 text-info', class: '' },
//     { path: '/register', title: 'Register',  icon:'ni-circle-08 text-pink', class: '' }
// ];

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {

  menuItems: any = [
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
      button_name : "Admin",
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
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/providers",
          link_class : "list-group-item py-2 ripple",
          link_name : "Proveedores",
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
      button_icon : "view_in_ar",
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
          link_name : "Resumen (bodega) Pedidos de Materia Prima",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/summary/inventory/warehouse/rawMaterialByProvider",
          link_class : "list-group-item py-2 ripple",
          link_name : "Resumen (bodega) Inventario de Materia Prima",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/summary/inventory/factory/rawMaterial",
          link_class : "list-group-item py-2 ripple",
          link_name : "Resumen (Fabrica) Inventario de Materia Prima",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/summary/inventory/factory/finishedProduct",
          link_class : "list-group-item py-2 ripple",
          link_name : "Resumen (Fabrica) Inventario de Producto Terminado",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/summary/inventory/store/productForSale",
          link_class : "list-group-item py-2 ripple",
          link_name : "Resumen (Tienda) Inventario de Producto para Venta",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/summary/productForSale/store/order",
          link_class : "list-group-item py-2 ripple",
          link_name : "Resumen (Tienda) Pedidos de Producto para Venta",
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
      button_data_bs_target : "#bodega-lvl1",
      button_aria_controls : "bodega-lvl1",
      button_aria_expanded : "false",
      button_icon_class : "material-icons icon",
      button_icon : "trolley",
      button_name : "Bodega",
      button_dropdown_icon_class : "material-icons icon",
      button_dropdown_icon : "arrow_drop_down",
      root_id : "bodega-lvl1",
      root_class : "panel-collapse collapse",
      sub_class : "position-sticky",
      is_tree : true,
      childs : [
        {
          root_class : "list-group list-group-flush",
          router_link : "/rawMaterials",
          link_class : "list-group-item py-2 ripple",
          link_name : "Materia Prima Base",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/rawMaterialsByProvider",
          link_class : "list-group-item py-2 ripple",
          link_name : "Materia Prima con Proveedor",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/rawMaterialByProvider/order",
          link_class : "list-group-item py-2 ripple",
          link_name : "Pedidos de Materia Prima",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/inventory/warehouse/rawMaterialByProvider",
          link_class : "list-group-item py-2 ripple",
          link_name : "Inventario de Materia Prima con Proveedor",
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
      button_data_bs_target : "#fabrica-lvl1",
      button_aria_controls : "fabrica-lvl1",
      button_aria_expanded : "false",
      button_icon_class : "material-icons icon",
      button_icon : "factory",
      button_name : "Fabrica",
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
          link_name : "Producto Terminado",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/inventory/factory/rawMaterial",
          link_class : "list-group-item py-2 ripple",
          link_name : "Inventario de Materia Prima",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/productCreation",
          link_class : "list-group-item py-2 ripple",
          link_name : "Registrar Producto en Inventario",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/inventory/factory/finishedProduct",
          link_class : "list-group-item py-2 ripple",
          link_name : "Inventario de Producto Terminado",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/productsForSale/order",
          query_params: {opt: 'factory'},
          link_class : "list-group-item py-2 ripple",
          link_name : "Pedidos de Producto Terminado",
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
        // {
        //   root_class : "list-group list-group-flush",
        //   router_link : "/productsForSale/order",
        //   query_params: {opt: 'store'},
        //   link_class : "list-group-item py-2 ripple",
        //   link_name : "Pedidos de Producto para Venta",
        //   icon_name : "arrow_right",
        //   icon_class : "material-icons icon"
        // },
        {
          root_class : "list-group list-group-flush",
          router_link : "/productsForSale",
          link_class : "list-group-item py-2 ripple",
          link_name : "Productos para Venta",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        },
        {
          root_class : "list-group list-group-flush",
          router_link : "/establishments",
          query_params: {opt: 'inventory'},
          link_class : "list-group-item py-2 ripple",
          link_name : "Listado de Tiendas",
          icon_name : "arrow_right",
          icon_class : "material-icons icon"
        }
      ]
    },
    // {
    //   button_type : "button",
    //   button_class : "list-group-item principal-bottom",
    //   button_router_link : "/users",
    //   is_tree : false,
    //   button_icon_class : "material-icons icon",
    //   button_icon : "tune",
    //   button_name : "Opcion 1",
    // },
    // {
    //   button_type : "button",
    //   button_class : "list-group-item principal-bottom",
    //   button_router_link : "/users",
    //   is_tree : false,
    //   button_icon_class : "material-icons icon",
    //   button_icon : "tune",
    //   button_name : "Opcion 2",
    // },
    // {
    //   button_type : "button",
    //   button_class : "list-group-item principal-bottom",
    //   button_router_link : "/users",
    //   is_tree : false,
    //   button_icon_class : "material-icons icon",
    //   button_icon : "tune",
    //   button_name : "Opcion 3",
    // },
    // {
    //   button_type : "button",
    //   button_class : "list-group-item principal-bottom",
    //   button_router_link : "/users",
    //   is_tree : false,
    //   button_icon_class : "material-icons icon",
    //   button_icon : "tune",
    //   button_name : "Opcion 4",
    // }
  ];

  constructor(private router: Router) { }

  ngOnInit() {
  //   this.menuItems = ROUTES.filter(menuItem => menuItem);
  //   this.router.events.subscribe((event) => {
  //     this.isCollapsed = true;
  //  });
  }

  navigateWithParams(routerLink: string, queryParams?: { [key: string]: any }){
    if(queryParams){
      this.router.navigate([routerLink], { queryParams: queryParams, queryParamsHandling: 'merge' });
    } else {
      this.router.navigate([routerLink]);
    }
  }
}
