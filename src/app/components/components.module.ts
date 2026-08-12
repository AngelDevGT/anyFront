import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './sidebar/sidebar.component';
import { NavbarComponent } from './navbar/navbar.component';
import { MenuComponent } from './menu/menu.component';
import { CardComponent } from './card/card.component';
import { ProductCardComponent } from './product-card/product-card.component';
import { ResponsiveTableComponent } from './responsive-table/responsive-table.component';
import { RouterModule } from '@angular/router';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MatToolbarModule } from '@angular/material/toolbar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatIconModule } from '@angular/material/icon';
import {MatMenuModule} from '@angular/material/menu';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ViewObjectComponent } from './view-object/view-object.component';
import { DynamicDialogComponent } from './dynamic-dialog/dynamic-dialog.component';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DataTableComponent } from './data-table/data-table.component';
import { StorePickerComponent } from './store-picker/store-picker.component';
import { DateRangeFilterComponent } from './date-range-filter/date-range-filter.component';
import { SortOrderDialogComponent } from './sort-order-dialog/sort-order-dialog.component';
import { BulkCostDialogComponent } from './bulk-cost-dialog/bulk-cost-dialog.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ScrollingModule } from '@angular/cdk/scrolling';

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    NgbCollapseModule,
    NgbModule,
    ReactiveFormsModule,
    FormsModule,
    DragDropModule,
    ScrollingModule,
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
    MatTooltipModule,
    // MatDialogModule,
    // MatToolbarModule,
    // BrowserAnimationsModule
  ],
  declarations: [
    MenuComponent,
    NavbarComponent,
    SidebarComponent,
    CardComponent,
    ProductCardComponent,
    ResponsiveTableComponent,
    ViewObjectComponent,
    DynamicDialogComponent,
    DataTableComponent,
    SortOrderDialogComponent,
    BulkCostDialogComponent,
    StorePickerComponent,
    DateRangeFilterComponent,
  ],
  exports: [
    MenuComponent,
    NavbarComponent,
    SidebarComponent,
    CardComponent,
    ProductCardComponent,
    ResponsiveTableComponent,
    ViewObjectComponent,
    DynamicDialogComponent,
    DataTableComponent,
    SortOrderDialogComponent,
    BulkCostDialogComponent,
    StorePickerComponent,
    DateRangeFilterComponent,
  ]
})
export class ComponentsModule { }
