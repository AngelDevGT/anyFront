import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './sidebar/sidebar.component';
import { NavbarComponent } from './navbar/navbar.component';
import { MenuComponent } from './menu/menu.component';
import { CardComponent } from './card/card.component';
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

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    NgbCollapseModule,
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
    // MatDialogModule,
    // MatToolbarModule,
    // BrowserAnimationsModule
  ],
  declarations: [
    MenuComponent,
    NavbarComponent,
    SidebarComponent,
    CardComponent,
    ResponsiveTableComponent,
    ViewObjectComponent,
    DynamicDialogComponent,
  ],
  exports: [
    MenuComponent,
    NavbarComponent,
    SidebarComponent,
    CardComponent,
    ResponsiveTableComponent,
    ViewObjectComponent,
    DynamicDialogComponent,
  ]
})
export class ComponentsModule { }
