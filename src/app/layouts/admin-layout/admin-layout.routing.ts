import { Routes } from "@angular/router";
import { HomeComponent } from "@app/home";
import { 
ListProductComponent, 
AddEditProductComponent, 
AddEditEstablishmentComponent, 
ListProviderComponent,
AddEditProviderComponent,
ViewProviderComponent,
ViewProductComponent,
AddEditRawMaterialByProviderOrderComponent,
ViewEstablishmentComponent,
ListRawMaterialOrderComponent} from "@app/pages";
import { ListEstablishmentComponent } from "@app/pages/establishment/list/list-establishment.component";
import { AddEditFinishedProductComponent } from "@app/pages/finished-product/add-edit/add-edit-finished-product.component";
import { ListFinishedProductComponent } from "@app/pages/finished-product/list/list-finished-product.component";
import { ViewFinishedProductComponent } from "@app/pages/finished-product/view/view-finished-product.component";
import { AddEditProductCreationComponent } from "@app/pages/product-creation/add-edit/add-edit-creation.component";
import { AddEditRawMaterialComponent } from "@app/pages/raw-material-base/add-edit/add-edit-raw-material.component";
import { ListRawMaterialComponent } from "@app/pages/raw-material-base/list/list-raw-material.component";
import { ViewRawMaterialComponent } from "@app/pages/raw-material-base/view/view-raw-material.component";
import { ViewRawMaterialOrderComponent } from "@app/pages/raw-material-by-provider-order/view/view-raw-material-order.component";
import { AddEditRawMateriaByProviderComponent } from "@app/pages/raw-material-by-provider/add-edit/add-edit-raw-material-provider.component";
import { ListRawMaterialByProviderComponent } from "@app/pages/raw-material-by-provider/list/list-raw-material-provider.component";
import { ViewRawMaterialByProviderComponent } from "@app/pages/raw-material-by-provider/view/view-raw-material-provider.component";

const usersModule = () => import('@app/layouts/users/users-layout.module').then(x => x.UsersModule);

export const AdminLayoutRoutes: Routes = [
    
    // {path: 'users', loadChildren: usersModule}
    { path: 'home', component: HomeComponent },
    { path: 'products', component: ListProductComponent },
    { path: 'products/create', component: AddEditProductComponent },
    { path: 'products/edit/:id', component: AddEditProductComponent },
    { path: 'products/view/:id', component: ViewProductComponent},
    { path: 'finishedProducts', component: ListFinishedProductComponent },
    { path: 'finishedProducts/create', component: AddEditFinishedProductComponent },
    { path: 'finishedProducts/edit/:id', component: AddEditFinishedProductComponent },
    { path: 'finishedProducts/view/:id', component: ViewFinishedProductComponent},
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
    { path: 'productCreation', component: AddEditProductCreationComponent},
    { path: 'users', loadChildren: usersModule},

];