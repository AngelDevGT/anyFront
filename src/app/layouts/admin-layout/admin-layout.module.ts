import { NgModule } from "@angular/core";
import { HttpClientModule } from "@angular/common/http";
import { RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule} from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatMenuModule} from '@angular/material/menu';
import {MatListModule} from '@angular/material/list';

import { AdminLayoutRoutes } from "./admin-layout.routing";
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { HomeComponent } from "@app/home";
import { ComponentsModule } from "@app/components";
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { 
  ListProductComponent, 
  AddEditProductComponent, 
  ViewProductComponent,
  ListEstablishmentComponent, 
  AddEditEstablishmentComponent,
  ListProviderComponent,
  AddEditProviderComponent,
  ViewProviderComponent,
  AddEditRawMateriaByProviderOrderComponent,
  ViewEstablishmentComponent,
} from "@app/pages";
import { ListRawMaterialComponent } from "@app/pages/raw-material-base/list/list-raw-material.component";
import { AddEditRawMaterialComponent } from "@app/pages/raw-material-base/add-edit/add-edit-raw-material.component";
import { ViewRawMaterialComponent } from "@app/pages/raw-material-base/view/view-raw-material.component";
import { AddEditRawMateriaByProviderComponent } from "@app/pages/raw-material-by-provider/add-edit/add-edit-raw-material-provider.component";
import { ListRawMaterialByProviderComponent } from "@app/pages/raw-material-by-provider/list/list-raw-material-provider.component";
import { ViewRawMaterialByProviderComponent } from "@app/pages/raw-material-by-provider/view/view-raw-material-provider.component";
// import { UsersLayoutComponent } from "../users/users-layout.component";

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(AdminLayoutRoutes),
    HttpClientModule,
    ComponentsModule,
    NgbModule,
    ReactiveFormsModule,
    FormsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatAutocompleteModule,
    MatMenuModule,
    MatListModule,
  ],
  declarations: [
      HomeComponent,
      ListProductComponent,
      AddEditProductComponent,
      ViewProductComponent,
      ListEstablishmentComponent,
      AddEditEstablishmentComponent,
      ViewEstablishmentComponent,
      ListProviderComponent,
      AddEditProviderComponent,
      ViewProviderComponent,
      ListRawMaterialComponent,
      AddEditRawMaterialComponent,
      ViewRawMaterialComponent,
      AddEditRawMateriaByProviderComponent,
      ListRawMaterialByProviderComponent,
      ViewRawMaterialByProviderComponent,
      AddEditRawMateriaByProviderOrderComponent
      // UsersLayoutComponent
  ]
})

  export class AdminLayouteModule {}

