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

const usersModule = () => import('@app/layouts/users/users-layout.module').then(x => x.UsersModule);

export const AdminLayoutRoutes: Routes = [
    
    // {path: 'users', loadChildren: usersModule}
    { path: 'home', component: HomeComponent },
    { path: 'finishedProducts', component: ListFinishedProductComponent },
    { path: 'finishedProducts/create', component: AddEditFinishedProductComponent },
    { path: 'finishedProducts/edit/:id', component: AddEditFinishedProductComponent },
    { path: 'finishedProducts/view/:id', component: ViewFinishedProductComponent},
    { path: 'productsForSale/order', component: ListProductForSaleOrderComponent },
    { path: 'productsForSale/order/create', component: AddEditProductForSaleOrderComponent },
    { path: 'productsForSale/order/edit/:id', component: AddEditProductForSaleOrderComponent },
    { path: 'productsForSale/order/view/:id', component: ViewProductForSaleOrderComponent },
    { path: 'productsForSale/create', component: AddEditProductoForSaleComponent },
    { path: 'productsForSale/edit/:id', component: AddEditProductoForSaleComponent },
    { path: 'productsForSale', component: ListProductForSaleComponent },
    { path: 'productsForSale/view/:id', component: ViewProductForSaleComponent },
    { path: 'establishments', component: ListEstablishmentComponent},
    { path: 'establishments/create', component: AddEditEstablishmentComponent},
    { path: 'establishments/edit/:id', component: AddEditEstablishmentComponent},
    { path: 'establishments/view/:id', component: ViewEstablishmentComponent},
    { path: 'providers', component: ListProviderComponent},
    { path: 'providers/create', component: AddEditProviderComponent},
    { path: 'providers/edit/:id', component: AddEditProviderComponent},
    { path: 'providers/view/:id', component: ViewProviderComponent},
    { path: 'rawMaterials', component: ListRawMaterialComponent},
    { path: 'rawMaterials/create', component: AddEditRawMaterialComponent},
    { path: 'rawMaterials/edit/:id', component: AddEditRawMaterialComponent},
    { path: 'rawMaterials/view/:id', component: ViewRawMaterialComponent},
    { path: 'rawMaterialByProvider/order', component: ListRawMaterialOrderComponent},
    { path: 'rawMaterialByProvider/order/create', component: AddEditRawMaterialByProviderOrderComponent},
    { path: 'rawMaterialByProvider/order/view/:id', component: ViewRawMaterialOrderComponent},
    { path: 'rawMaterialByProvider/order/edit/:id', component: AddEditRawMaterialByProviderOrderComponent},
    { path: 'rawMaterialsByProvider', component: ListRawMaterialByProviderComponent},
    { path: 'rawMaterialsByProvider/create', component: AddEditRawMateriaByProviderComponent},
    { path: 'rawMaterialsByProvider/view/:id', component: ViewRawMaterialByProviderComponent},
    { path: 'rawMaterialsByProvider/edit/:id', component: AddEditRawMateriaByProviderComponent},
    { path: 'inventory/warehouse/rawMaterialByProvider', component: ListWarehouseInventoryRMPComponent},
    { path: 'inventory/factory/rawMaterial', component: ListFactoryInventoryRMComponent},
    { path: 'inventory/factory/finishedProduct', component: ListFactoryInventoryFPComponent},
    { path: 'establishments/inventory/:id', component: ListStoreInventoryPFSComponent},
    { path: 'productCreation', component: AddEditProductCreationComponent},
    { path: 'users', loadChildren: usersModule},
    { path: 'summary/rawMaterialByProvider/order', component: SummaryRawMaterialOrderComponent},
    { path: 'summary/inventory/warehouse/rawMaterialByProvider', component: SummaryRawMaterialByProviderInventoryBodegaComponent},
    { path: 'summary/inventory/factory/rawMaterial', component: SummaryRawMaterialByProviderInventoryFactoryComponent},
    { path: 'summary/inventory/factory/finishedProduct', component: SummaryFinishedProductInventoryFactoryComponent},
    { path: 'summary/productForSale/store/order', component: SummaryProductForSaleOrderComponent},
    { path: 'summary/inventory/store/productForSale', component: SummaryProductForSaleInventoryFactoryComponent},
    { path: 'store/sales/history/:id', component: ListStoreSalesPFSComponent},
    { path: 'store/sales/history/view/:id', component: ViewStoreSalesPFSComponent},
    { path: 'store/sales/create', component: AddEditSaleComponent},
    { path: 'store/sales/history/edit/:id', component: AddEditSaleComponent},
    { path: 'activityLog/view', component: ViewActivityLogComponent},
    { path: 'cashClosing/:id', component: ListCashClosingComponent},
    { path: 'cashClosing/view/:id', component: ViewCashClosingComponent},
    { path: 'cashClosing/create/:id', component: AddEditCashClosingComponent},
    { path: 'cashClosing/edit/:id', component: AddEditCashClosingComponent},
];