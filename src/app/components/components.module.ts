import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './sidebar/sidebar.component';
import { NavbarComponent } from './navbar/navbar.component';
import { CardComponent } from './card/card.component';
import { RouterModule } from '@angular/router';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
// import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MatToolbarModule } from '@angular/material/toolbar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatIconModule } from '@angular/material/icon';

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    NgbCollapseModule,
    // NgbModule,
    MatIconModule,
    // MatToolbarModule,
    // BrowserAnimationsModule
  ],
  declarations: [
    NavbarComponent,
    SidebarComponent,
    CardComponent
  ],
  exports: [
    NavbarComponent,
    SidebarComponent,
    CardComponent
  ]
})
export class ComponentsModule { }
