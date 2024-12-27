import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { AccountService } from '@app/services';
import { FormControl, FormGroup } from '@angular/forms';
import { startWith, map } from 'rxjs/operators';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { User } from '@app/models/system/user.model';
import { OrdinaryObject } from '@app/models';
import { Router } from '@angular/router';

interface option {
  value?: string,
  viewValue?: string
}

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  @Input() isMenuCollapsed = true;
  @Output() isMenuCollapsedResponse: EventEmitter<boolean> = new EventEmitter();

  token: any;
  userId?: string;
  formControl?: FormControl;

  sesion$?: Observable<boolean>;
  userSub?: Observable<User | null>;
  existSession: boolean;
  control = new FormControl();
  searchInput = '';
  menuItems: any = [];
  yet:boolean=false;


  constructor( private accountService: AccountService, private router: Router) {
    // this.existSession = sessionService.existSession();
    this.existSession = accountService.isActiveUser();
  }

  setIsMenuCollapsed(isCollapsed: boolean){
    this.isMenuCollapsedResponse.emit(!isCollapsed);
  }


  ngOnInit(): void {
    //Estas acciones solo las realiza cuando ocurre un cambio en la variable
    // this.sesion$ = this.sessionService.loggedIn$();//Lo convertimos en observador
    this.userSub = this.accountService.user;
    this.userSub.subscribe(usr => {
        this.existSession = false;
        if (usr){
            if (this.accountService.isActiveUser()) {
                this.existSession = true;
            }    
        }
    });
    this.menuItems = this.accountService.getUserMenuItems();
  }

  ngAfterViewInit(){
    setTimeout(()=>{
      this.yet=true
    })
  }

  logOut() {
    this.accountService.logout();
  }

  viewUser(){
    this.router.navigate(['/users/view/', this.accountService.userValue.userID]);
  }

  onKey(event: any) {
    if (!this.token) {
      this.token = localStorage.getItem('token');
      this.token = JSON.parse(this.token).token;
    }
  }

  navigateWithParams(routerLink: string, queryParams?: { [key: string]: any }){
    if(queryParams){
      this.router.navigate([routerLink], { queryParams: queryParams, queryParamsHandling: 'merge' });
    } else {
      this.router.navigate([routerLink]);
    }
  }

  action(value:any)
    {
      this.navigateWithParams(value[0], value[1]);
    }

}
