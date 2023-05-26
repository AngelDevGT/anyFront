import { Routes } from "@angular/router";
import { HomeComponent } from "@app/home";
import { 
ViewProductComponent, 
CreateProductComponent, 
CreateEstablishmentComponent } from "@app/pages";

export const AdminLayoutRoutes: Routes = [
    
    // {path: 'users', loadChildren: usersModule}
    { path: 'home', component: HomeComponent },
    { path: 'products', component: ViewProductComponent },
    { path: 'products/create', component: CreateProductComponent },
    { path: 'establishment/create', component: CreateEstablishmentComponent}

];