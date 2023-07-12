import { Routes } from "@angular/router";
import { HomeComponent } from "@app/home";
import { 
ListProductComponent, 
AddEditProductComponent, 
AddEditEstablishmentComponent, 
ListProviderComponent,
AddEditProviderComponent,
ViewProviderComponent,
ViewProductComponent} from "@app/pages";
import { ListEstablishmentComponent } from "@app/pages/establishment/list/list-establishment.component";

const usersModule = () => import('@app/layouts/users/users-layout.module').then(x => x.UsersModule);

export const AdminLayoutRoutes: Routes = [
    
    // {path: 'users', loadChildren: usersModule}
    { path: 'home', component: HomeComponent },
    { path: 'products', component: ListProductComponent },
    { path: 'products/create', component: AddEditProductComponent },
    { path: 'products/edit/:id', component: AddEditProductComponent },
    { path: 'products/view/:id', component: ViewProductComponent},
    { path: 'establishments', component: ListEstablishmentComponent},
    { path: 'establishments/create', component: AddEditEstablishmentComponent},
    { path: 'establishments/edit/:id', component: AddEditEstablishmentComponent},
    { path: 'providers', component: ListProviderComponent},
    { path: 'providers/create', component: AddEditProviderComponent},
    { path: 'providers/edit/:id', component: AddEditProviderComponent},
    { path: 'providers/view/:id', component: ViewProviderComponent},
    { path: 'users', loadChildren: usersModule},

];