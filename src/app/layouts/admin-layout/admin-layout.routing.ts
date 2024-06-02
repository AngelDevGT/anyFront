import { Routes } from "@angular/router";
import { HomeComponent } from "@app/home";
import { 
AddEditEstablishmentComponent, 
ListProviderComponent,
AddEditProviderComponent,
ViewProviderComponent,
AddEditRawMaterialByProviderOrderComponent,
ViewEstablishmentComponent,
ListRawMaterialOrderComponent,
ListFactoryInventoryRMComponent,
ListFactoryInventoryFPComponent} from "@app/pages";
import { SummaryRawMaterialOrderComponent } from "@app/pages/admin-summary/raw-material-order/summary-raw-material-order.component";
import { SummaryRawMaterialByProviderInventoryBodegaComponent } from "@app/pages/admin-summary/rmp-inventory-bodega/summary-rmp-inventory-bodega.component";
import { SummaryRawMaterialByProviderInventoryFactoryComponent } from "@app/pages/admin-summary/rm-inventory-factory/summary-rm-inventory-factory.component";
import { ListEstablishmentComponent } from "@app/pages/establishment/list/list-establishment.component";
import { AddEditFinishedProductComponent } from "@app/pages/finished-product/add-edit/add-edit-finished-product.component";
import { ListFinishedProductComponent } from "@app/pages/finished-product/list/list-finished-product.component";
import { ViewFinishedProductComponent } from "@app/pages/finished-product/view/view-finished-product.component";
import { ListWarehouseInventoryRMPComponent } from "@app/pages/inventory-rmp-bodega/list/list-inventory-rmp-bodega.component";
import { AddEditProductCreationComponent } from "@app/pages/product-creation/add-edit/add-edit-product-creation.component";
import { AddEditProductForSaleOrderComponent } from "@app/pages/product-for-sale-order/add-edit/add-edit-pfs-order.component";
import { ListProductForSaleOrderComponent } from "@app/pages/product-for-sale-order/list/list-pfs-store-order.component";
import { ViewProductForSaleOrderComponent } from "@app/pages/product-for-sale-order/view/view-pfs-order.component";
import { AddEditProductoForSaleComponent } from "@app/pages/product-for-sale/add-edit/add-edit-product-for-sale.component";
import { ListProductForSaleComponent } from "@app/pages/product-for-sale/list/list-product-for-sale.component";
import { ViewProductForSaleComponent } from "@app/pages/product-for-sale/view/view-product-for-sale.component";
import { AddEditRawMaterialComponent } from "@app/pages/raw-material-base/add-edit/add-edit-raw-material.component";
import { ListRawMaterialComponent } from "@app/pages/raw-material-base/list/list-raw-material.component";
import { ViewRawMaterialComponent } from "@app/pages/raw-material-base/view/view-raw-material.component";
import { ViewRawMaterialOrderComponent } from "@app/pages/raw-material-by-provider-order/view/view-raw-material-order.component";
import { AddEditRawMateriaByProviderComponent } from "@app/pages/raw-material-by-provider/add-edit/add-edit-raw-material-provider.component";
import { ListRawMaterialByProviderComponent } from "@app/pages/raw-material-by-provider/list/list-raw-material-provider.component";
import { ViewRawMaterialByProviderComponent } from "@app/pages/raw-material-by-provider/view/view-raw-material-provider.component";
import { SummaryFinishedProductInventoryFactoryComponent } from "@app/pages/admin-summary/fp-inventory-factory/summary-fp-inventory-factory.component";
import { ListStoreInventoryPFSComponent } from "@app/pages/store-inventory-pfs/list/list-store-inventory-pfs.component";
import { ListStoreSalesPFSComponent } from "@app/pages/store-sales/list/list-store-sales-pfs.component";
import { ViewStoreSalesPFSComponent } from "@app/pages/store-sales/view/view-store-sales-pfs.component";
import { AddEditSaleComponent } from "@app/pages/store-sales/add-edit/add-edit-sale.component";
import { SummaryProductForSaleOrderComponent } from "@app/pages/admin-summary/fp-order-factory/summary-pfs-store-order.component";
import { SummaryProductForSaleInventoryFactoryComponent } from "@app/pages/admin-summary/pfs-inventory-store/summary-pfs-inventory-store.component";
import { ViewActivityLogComponent } from "@app/pages/activity-log/view/view-activity-log.component";
import { ListCashClosingComponent } from "@app/pages/cash-closing/list/list-cash-closing.component";
import { ViewCashClosingComponent } from "@app/pages/cash-closing/view/view-cash-closing.component";
import { AddEditCashClosingComponent } from "@app/pages/cash-closing/add-edit/add-edit-cash-closing.component";
import { canActivateV2 } from "@app/helpers";

const usersModule = () => import('@app/layouts/users/users-layout.module').then(x => x.UsersModule);

export const AdminLayoutRoutes: Routes = [
    
    // {path: 'users', loadChildren: usersModule}
    { path: 'home', component: HomeComponent , canActivate: [canActivateV2]},
    // { path: 'home', component: HomeComponent},
    { path: 'finishedProducts', component: ListFinishedProductComponent , canActivate: [canActivateV2]},
    { path: 'finishedProducts/create', component: AddEditFinishedProductComponent , canActivate: [canActivateV2]},
    { path: 'finishedProducts/edit/:id', component: AddEditFinishedProductComponent , canActivate: [canActivateV2]},
    { path: 'finishedProducts/view/:id', component: ViewFinishedProductComponent, canActivate: [canActivateV2]},
    { path: 'productsForSale/order', component: ListProductForSaleOrderComponent , canActivate: [canActivateV2]},
    { path: 'productsForSale/order/create', component: AddEditProductForSaleOrderComponent , canActivate: [canActivateV2]},
    { path: 'productsForSale/order/edit/:id', component: AddEditProductForSaleOrderComponent , canActivate: [canActivateV2]},
    { path: 'productsForSale/order/view/:id', component: ViewProductForSaleOrderComponent , canActivate: [canActivateV2]},
    { path: 'productsForSale/create', component: AddEditProductoForSaleComponent , canActivate: [canActivateV2]},
    { path: 'productsForSale/edit/:id', component: AddEditProductoForSaleComponent , canActivate: [canActivateV2]},
    { path: 'productsForSale', component: ListProductForSaleComponent , canActivate: [canActivateV2]},
    { path: 'productsForSale/view/:id', component: ViewProductForSaleComponent , canActivate: [canActivateV2]},
    { path: 'establishments', component: ListEstablishmentComponent, canActivate: [canActivateV2]},
    { path: 'establishments/create', component: AddEditEstablishmentComponent, canActivate: [canActivateV2]},
    { path: 'establishments/edit/:id', component: AddEditEstablishmentComponent, canActivate: [canActivateV2]},
    { path: 'establishments/view/:id', component: ViewEstablishmentComponent, canActivate: [canActivateV2]},
    { path: 'providers', component: ListProviderComponent, canActivate: [canActivateV2]},
    { path: 'providers/create', component: AddEditProviderComponent, canActivate: [canActivateV2]},
    { path: 'providers/edit/:id', component: AddEditProviderComponent, canActivate: [canActivateV2]},
    { path: 'providers/view/:id', component: ViewProviderComponent, canActivate: [canActivateV2]},
    { path: 'rawMaterials', component: ListRawMaterialComponent, canActivate: [canActivateV2]},
    { path: 'rawMaterials/create', component: AddEditRawMaterialComponent, canActivate: [canActivateV2]},
    { path: 'rawMaterials/edit/:id', component: AddEditRawMaterialComponent, canActivate: [canActivateV2]},
    { path: 'rawMaterials/view/:id', component: ViewRawMaterialComponent, canActivate: [canActivateV2]},
    { path: 'rawMaterialByProvider/order', component: ListRawMaterialOrderComponent, canActivate: [canActivateV2]},
    { path: 'rawMaterialByProvider/order/create', component: AddEditRawMaterialByProviderOrderComponent, canActivate: [canActivateV2]},
    { path: 'rawMaterialByProvider/order/view/:id', component: ViewRawMaterialOrderComponent, canActivate: [canActivateV2]},
    { path: 'rawMaterialByProvider/order/edit/:id', component: AddEditRawMaterialByProviderOrderComponent, canActivate: [canActivateV2]},
    { path: 'rawMaterialsByProvider', component: ListRawMaterialByProviderComponent, canActivate: [canActivateV2]},
    { path: 'rawMaterialsByProvider/create', component: AddEditRawMateriaByProviderComponent, canActivate: [canActivateV2]},
    { path: 'rawMaterialsByProvider/view/:id', component: ViewRawMaterialByProviderComponent, canActivate: [canActivateV2]},
    { path: 'rawMaterialsByProvider/edit/:id', component: AddEditRawMateriaByProviderComponent, canActivate: [canActivateV2]},
    { path: 'inventory/warehouse/rawMaterialByProvider', component: ListWarehouseInventoryRMPComponent, canActivate: [canActivateV2]},
    { path: 'inventory/factory/rawMaterial', component: ListFactoryInventoryRMComponent, canActivate: [canActivateV2]},
    { path: 'inventory/factory/finishedProduct', component: ListFactoryInventoryFPComponent, canActivate: [canActivateV2]},
    { path: 'establishments/inventory/:id', component: ListStoreInventoryPFSComponent, canActivate: [canActivateV2]},
    { path: 'productCreation', component: AddEditProductCreationComponent, canActivate: [canActivateV2]},
    { path: 'users', loadChildren: usersModule, canActivate: [canActivateV2]},
    { path: 'summary/rawMaterialByProvider/order', component: SummaryRawMaterialOrderComponent, canActivate: [canActivateV2]},
    { path: 'summary/inventory/warehouse/rawMaterialByProvider', component: SummaryRawMaterialByProviderInventoryBodegaComponent, canActivate: [canActivateV2]},
    { path: 'summary/inventory/factory/rawMaterial', component: SummaryRawMaterialByProviderInventoryFactoryComponent, canActivate: [canActivateV2]},
    { path: 'summary/inventory/factory/finishedProduct', component: SummaryFinishedProductInventoryFactoryComponent, canActivate: [canActivateV2]},
    { path: 'summary/productForSale/store/order', component: SummaryProductForSaleOrderComponent, canActivate: [canActivateV2]},
    { path: 'summary/inventory/store/productForSale', component: SummaryProductForSaleInventoryFactoryComponent, canActivate: [canActivateV2]},
    { path: 'store/sales/history/:id', component: ListStoreSalesPFSComponent, canActivate: [canActivateV2]},
    { path: 'store/sales/history/view/:id', component: ViewStoreSalesPFSComponent, canActivate: [canActivateV2]},
    { path: 'store/sales/create', component: AddEditSaleComponent, canActivate: [canActivateV2]},
    { path: 'store/sales/history/edit/:id', component: AddEditSaleComponent, canActivate: [canActivateV2]},
    { path: 'activityLog/view', component: ViewActivityLogComponent, canActivate: [canActivateV2]},
    { path: 'cashClosing/:id', component: ListCashClosingComponent, canActivate: [canActivateV2]},
    { path: 'cashClosing/view/:id', component: ViewCashClosingComponent, canActivate: [canActivateV2]},
    { path: 'cashClosing/create/:id', component: AddEditCashClosingComponent, canActivate: [canActivateV2]},
    { path: 'cashClosing/edit/:id', component: AddEditCashClosingComponent, canActivate: [canActivateV2]},
];