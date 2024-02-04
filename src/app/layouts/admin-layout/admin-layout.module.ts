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
  ListEstablishmentComponent, 
  AddEditEstablishmentComponent,
  ListProviderComponent,
  AddEditProviderComponent,
  ViewProviderComponent,
  AddEditRawMaterialByProviderOrderComponent,
  ViewEstablishmentComponent,
  ListRawMaterialOrderComponent,
  ListFactoryInventoryRMComponent,
  ListFactoryInventoryFPComponent,
} from "@app/pages";
import { ListRawMaterialComponent } from "@app/pages/raw-material-base/list/list-raw-material.component";
import { AddEditRawMaterialComponent } from "@app/pages/raw-material-base/add-edit/add-edit-raw-material.component";
import { ViewRawMaterialComponent } from "@app/pages/raw-material-base/view/view-raw-material.component";
import { AddEditRawMateriaByProviderComponent } from "@app/pages/raw-material-by-provider/add-edit/add-edit-raw-material-provider.component";
import { ListRawMaterialByProviderComponent } from "@app/pages/raw-material-by-provider/list/list-raw-material-provider.component";
import { ViewRawMaterialByProviderComponent } from "@app/pages/raw-material-by-provider/view/view-raw-material-provider.component";
import { AddEditFinishedProductComponent } from "@app/pages/finished-product/add-edit/add-edit-finished-product.component";
import { ListFinishedProductComponent } from "@app/pages/finished-product/list/list-finished-product.component";
import { ViewFinishedProductComponent } from "@app/pages/finished-product/view/view-finished-product.component";
import { AddEditProductCreationComponent } from "@app/pages/product-creation/add-edit/add-edit-product-creation.component";
import { MatDialogModule } from "@angular/material/dialog";
import { ViewRawMaterialOrderComponent } from "@app/pages/raw-material-by-provider-order/view/view-raw-material-order.component";
import { ListWarehouseInventoryRMPComponent } from "@app/pages/inventory-rmp-bodega/list/list-inventory-rmp-bodega.component";
import { AddEditProductoForSaleComponent } from "@app/pages/product-for-sale/add-edit/add-edit-product-for-sale.component";
import { ListProductForSaleComponent } from "@app/pages/product-for-sale/list/list-product-for-sale.component";
import { ViewProductForSaleComponent } from "@app/pages/product-for-sale/view/view-product-for-sale.component";
import { AddEditProductForSaleOrderComponent } from "@app/pages/product-for-sale-order/add-edit/add-edit-pfs-order.component";
import { ListProductForSaleOrderComponent } from "@app/pages/product-for-sale-order/list/list-pfs-store-order.component";
import { ViewProductForSaleOrderComponent } from "@app/pages/product-for-sale-order/view/view-pfs-order.component";
import { SummaryRawMaterialOrderComponent } from "@app/pages/admin-summary/raw-material-order/summary-raw-material-order.component";
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
    MatDialogModule,
  ],
  declarations: [
      HomeComponent,
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
      AddEditRawMaterialByProviderOrderComponent,
      ListRawMaterialOrderComponent,
      ViewRawMaterialOrderComponent,
      AddEditFinishedProductComponent,
      ListFinishedProductComponent,
      ViewFinishedProductComponent,
      AddEditProductCreationComponent,
      ListWarehouseInventoryRMPComponent,
      ListFactoryInventoryRMComponent,
      ListFactoryInventoryFPComponent,
      AddEditProductoForSaleComponent,
      ListProductForSaleComponent,
      ViewProductForSaleComponent,
      AddEditProductForSaleOrderComponent,
      ListProductForSaleOrderComponent,
      ViewProductForSaleOrderComponent,
      SummaryRawMaterialOrderComponent,
      // UsersLayoutComponent
  ]
})

  export class AdminLayouteModule {}

