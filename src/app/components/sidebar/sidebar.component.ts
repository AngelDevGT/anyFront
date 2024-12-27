import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { Router } from '@angular/router';
import { AccountService } from '@app/services';

declare interface RouteInfo {
    path: string;
    title: string;
    icon: string;
    class: string;
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {

  menuItems: any = [];

  constructor(private router: Router, private accountService: AccountService) { }

  ngOnInit() {
    this.menuItems = this.accountService.getUserMenuItems();
  }

  navigateWithParams(routerLink: string, queryParams?: { [key: string]: any }){
    if(queryParams){
      this.router.navigate([routerLink], { queryParams: queryParams, queryParamsHandling: 'merge' });
    } else {
      this.router.navigate([routerLink]);
    }
  }
}
