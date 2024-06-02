import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { UsersLayoutComponent } from './users-layout.component';
import { ListComponent } from './list/list.component';
import { AddEditComponent } from './add-edit/add-edit.component';
import { ViewUserComponent } from './view/view-user.component';
import { canActivateV2 } from '@app/helpers';

const routes: Routes = [
    {
        path: '', component: UsersLayoutComponent,
        children: [
            { path: '', component: ListComponent, canActivate: [canActivateV2] },
            { path: 'add', component: AddEditComponent, canActivate: [canActivateV2] },
            { path: 'edit/:id', component: AddEditComponent, canActivate: [canActivateV2] },
            { path: 'view/:id', component: ViewUserComponent, canActivate: [canActivateV2] },
        ]
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class UsersRoutingModule { }