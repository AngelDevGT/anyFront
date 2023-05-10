import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

// used to create fake backend
import { fakeBackendProvider } from '@app/helpers/fake-backend';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { AppRoutingModule } from './app.routing';
import { JwtInterceptor, ErrorInterceptor } from '@app/helpers';
import { AppComponent } from '.';
import { AlertComponent } from '@app/components';
import { HomeComponent } from '@app/home';
import { ComponentsModule } from './components/components.module';
import { AdminLayoutComponent } from './layouts';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { RouterModule } from '@angular/router';
// import { UsersLayoutComponent } from './layouts/users/users-layout.component';

@NgModule({
  imports: [
      BrowserModule,
      ReactiveFormsModule,
      HttpClientModule,
      ComponentsModule,
      NgbModule,
      RouterModule,
      AppRoutingModule,
    //   MatToolbarModule,
    //   MatButtonModule,
    //   MatIconModule,
    //   MatCardModule,
    //   MatTableModule,
    //   MatCheckboxModule,
    //   MatAutocompleteModule,
    //   ReactiveFormsModule,
    //   MatInputModule,
    //   MatRadioModule,
    //   MatSelectModule,
    //   MatFormFieldModule,
    //   MatSelectModule,
  ],
  declarations: [
      AppComponent,
      AlertComponent,
      AdminLayoutComponent,
      // HomeComponent,
    //   UsersLayoutComponent
  ],
  providers: [
      { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
      { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },

      // provider used to create fake backend
      fakeBackendProvider
  ],
  bootstrap: [AppComponent]
})
export class AppModule { };
