import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { HomeComponent } from '@app/home/index';
import { AuthGuard } from '@app/helpers/index';
import { AdminLayoutComponent } from '@app/layouts';

const accountModule = () => import('./layouts/account/account-layout.module').then(x => x.AccountModule);
const adminLayoutModule = () => import('@app/layouts').then(x => x.AdminLayouteModule);
const usersModule = () => import('./layouts/users/users-layout.module').then(x => x.UsersModule);

const routes: Routes = [
    {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
    },
    // { path: '', component: HomeComponent, canActivate: [AuthGuard] },
    { 
        path: '', 
        component: AdminLayoutComponent, 
        children : [
            {
                path: '',
                loadChildren: adminLayoutModule
            }
        ],
        canActivate: [AuthGuard]},
    // { path: 'users', loadChildren: usersModule, canActivate: [AuthGuard] },
    { path: 'account', loadChildren: accountModule },

    // otherwise redirect to home
    { path: '**', redirectTo: '' }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule { }