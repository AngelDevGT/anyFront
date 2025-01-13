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
import {MatExpansionModule} from '@angular/material/expansion';
import { ViewRawMaterialOrderComponent } from "@app/pages/raw-material-by-provider-order/view/view-raw-material-order.component";
import { ListWarehouseInventoryRMPComponent } from "@app/pages/inventory-rmp-bodega/list/list-inventory-rmp-bodega.component";
import { AddEditProductoForSaleComponent } from "@app/pages/product-for-sale/add-edit/add-edit-product-for-sale.component";
import { ListProductForSaleComponent } from "@app/pages/product-for-sale/list/list-product-for-sale.component";
import { ViewProductForSaleComponent } from "@app/pages/product-for-sale/view/view-product-for-sale.component";
import { AddEditProductForSaleOrderComponent } from "@app/pages/product-for-sale-order/add-edit/add-edit-pfs-order.component";
import { ListProductForSaleOrderComponent } from "@app/pages/product-for-sale-order/list-store/list-pfs-store-order.component";
import { ViewProductForSaleOrderComponent } from "@app/pages/product-for-sale-order/view/view-pfs-order.component";
import { SummaryRawMaterialOrderComponent } from "@app/pages/admin-summary/raw-material-order/summary-raw-material-order.component";
import { SummaryRawMaterialByProviderInventoryBodegaComponent } from "@app/pages/admin-summary/rmp-inventory-bodega/summary-rmp-inventory-bodega.component";
import { SummaryRawMaterialByProviderInventoryFactoryComponent } from "@app/pages/admin-summary/rm-inventory-factory/summary-rm-inventory-factory.component";
import { SummaryFinishedProductInventoryFactoryComponent } from "@app/pages/admin-summary/fp-inventory-factory/summary-fp-inventory-factory.component";
import { ListStoreInventoryPFSComponent } from "@app/pages/store-inventory-pfs/list/list-store-inventory-pfs.component";
import { ListStoreSalesPFSComponent } from "@app/pages/store-sales/list/list-store-sales-pfs.component";
import { ViewStoreSalesPFSComponent } from "@app/pages/store-sales/view/view-store-sales-pfs.component";
import { AddEditSaleComponent } from "@app/pages/store-sales/add-edit/add-edit-sale.component";
import { SummaryProductForSaleOrderComponent } from "@app/pages/admin-summary/fp-order-factory/summary-pfs-store-order.component";
import { SummaryProductForSaleInventoryFactoryComponent } from "@app/pages/admin-summary/pfs-inventory-store/summary-pfs-inventory-store.component";
import { ViewActivityLogComponent } from "@app/pages/activity-log/view/view-activity-log.component";
import { ListCashClosingComponent } from "@app/pages/cash-closing/list/list-cash-closing.component";
import { ViewCashClosingComponent } from "@app/pages/cash-closing/view/view-cash-closing.component";
import { AddEditCashClosingComponent } from "@app/pages/cash-closing/add-edit/add-edit-cash-closing.component";
import { ListFinishedProductOrderInFactoryComponent } from "@app/pages/product-for-sale-order/list-factory/list-pfs-store-order-factory.component";
import { ConsumeRawMaterialComponent } from "@app/pages/consume-raw-material/consume-raw-material.component";
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { MAT_DATE_FORMATS } from '@angular/material/core';
// import { UsersLayoutComponent } from "../users/users-layout.component";

export const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY', // Para entrada del usuario
  },
  display: {
    dateInput: 'DD/MM/YYYY', // Formato de visualización
    monthYearLabel: 'MMMM YYYY', // Formato para la etiqueta de mes y año
    dateA11yLabel: 'LL', // Formato accesible
    monthYearA11yLabel: 'MMMM YYYY', // Formato accesible de mes y año
  },
};

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
    MatExpansionModule,
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
      ConsumeRawMaterialComponent,
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
      SummaryRawMaterialByProviderInventoryBodegaComponent,
      SummaryRawMaterialByProviderInventoryFactoryComponent,
      SummaryFinishedProductInventoryFactoryComponent,
      SummaryProductForSaleOrderComponent,
      SummaryProductForSaleInventoryFactoryComponent,
      ListStoreInventoryPFSComponent,
      ListStoreSalesPFSComponent,
      ViewStoreSalesPFSComponent,
      AddEditSaleComponent,
      ViewActivityLogComponent,
      ListCashClosingComponent,
      ViewCashClosingComponent,
      AddEditCashClosingComponent,
      ListFinishedProductOrderInFactoryComponent,
      // UsersLayoutComponent
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'es-GT' }, // Idioma español Guatemala
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }, // Formato personalizado
  ],
})

  export class AdminLayouteModule {}

