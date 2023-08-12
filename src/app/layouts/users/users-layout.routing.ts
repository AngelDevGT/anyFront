import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { UsersLayoutComponent } from './users-layout.component';
import { ListComponent } from './list/list.component';
import { AddEditComponent } from './add-edit/add-edit.component';
import { ViewUserComponent } from './view/view-user.component';

const routes: Routes = [
    {
        path: '', component: UsersLayoutComponent,
        children: [
            { path: '', component: ListComponent },
            { path: 'add', component: AddEditComponent },
            { path: 'edit/:id', component: AddEditComponent },
            { path: 'view/:id', component: ViewUserComponent },
        ]
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class UsersRoutingModule { }