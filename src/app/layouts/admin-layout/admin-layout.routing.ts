import { Routes } from "@angular/router";
import { HomeComponent } from "@app/home";
import { 
ViewProductComponent, 
CreateProductComponent, 
AddEditEstablishmentComponent } from "@app/pages";
import { ListEstablishmentComponent } from "@app/pages/establishment/list/list-establishment.component";

const usersModule = () => import('@app/layouts/users/users-layout.module').then(x => x.UsersModule);

export const AdminLayoutRoutes: Routes = [
    
    // {path: 'users', loadChildren: usersModule}
    { path: 'home', component: HomeComponent },
    { path: 'products', component: ViewProductComponent },
    { path: 'products/create', component: CreateProductComponent },
    { path: 'establishments', component: ListEstablishmentComponent},
    { path: 'establishments/create', component: AddEditEstablishmentComponent},
    { path: 'establishments/edit/:id', component: AddEditEstablishmentComponent},
    { path: 'users', loadChildren: usersModule},

];