import { NgModule } from "@angular/core";
import { HttpClientModule } from "@angular/common/http";
import { RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";

import { AdminLayoutRoutes } from "./admin-layout.routing";
// import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { HomeComponent } from "@app/home";
import { ComponentsModule } from "@app/components";
import { NgbModule } from "@ng-bootstrap/ng-bootstrap";
// import { UsersLayoutComponent } from "../users/users-layout.component";

@NgModule({
    imports: [
      CommonModule,
      RouterModule.forChild(AdminLayoutRoutes),
      HttpClientModule,
      ComponentsModule,
      NgbModule
      // NgbModule,
    ],
    declarations: [
        HomeComponent
        // UsersLayoutComponent
    ]
  })

  export class AdminLayouteModule {}

