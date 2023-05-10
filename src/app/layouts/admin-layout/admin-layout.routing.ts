import { Routes } from "@angular/router";
import { HomeComponent } from "@app/home";

export const AdminLayoutRoutes: Routes = [
    
    // {path: 'users', loadChildren: usersModule}
    {path: 'home', component: HomeComponent}

];