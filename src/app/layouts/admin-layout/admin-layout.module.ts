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

import { AdminLayoutRoutes } from "./admin-layout.routing";
// import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { HomeComponent } from "@app/home";
import { ComponentsModule } from "@app/components";
import { NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ViewProductComponent, CreateProductComponent, CreateEstablishmentComponent } from "@app/pages";
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
      // BrowserAnimationsModule
      // NgbModule,
    ],
    declarations: [
        HomeComponent,
        ViewProductComponent,
        CreateProductComponent,
        CreateEstablishmentComponent,
        // UsersLayoutComponent
    ]
  })

  export class AdminLayouteModule {}

