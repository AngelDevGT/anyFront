import { Routes } from "@angular/router";
import { HomeComponent } from "@app/home";
import { 
ViewProductComponent, 
CreateProductComponent, 
CreateEstablishmentComponent } from "@app/pages";

const usersModule = () => import('@app/layouts/users/users-layout.module').then(x => x.UsersModule);

export const AdminLayoutRoutes: Routes = [
    
    // {path: 'users', loadChildren: usersModule}
    { path: 'home', component: HomeComponent },
    { path: 'products', component: ViewProductComponent },
    { path: 'products/create', component: CreateProductComponent },
    { path: 'establishment/create', component: CreateEstablishmentComponent},
    { path: 'users', loadChildren: usersModule},

];