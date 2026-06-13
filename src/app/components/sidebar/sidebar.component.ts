import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AccountService } from '@app/services';
import { SidebarStateService } from '@app/services/sidebar-state.service';
import { User } from '@app/models/system/user.model';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit, OnDestroy {
  menuItems: any = [];
  isCollapsed = false;
  isMobileOpen = false;
  isHovering = false;
  currentUser: User | null = null;

  private subs: Subscription[] = [];
  private hoverLeaveTimer: any;

  constructor(
    private readonly router: Router,
    private readonly accountService: AccountService,
    private readonly sidebarState: SidebarStateService
  ) {}

  ngOnInit() {
    this.menuItems = this.accountService.getUserMenuItems();
    this.subs.push(
      this.sidebarState.collapsed$.subscribe(v => this.isCollapsed = v),
      this.sidebarState.mobileOpen$.subscribe(v => this.isMobileOpen = v),
      this.accountService.user.subscribe(u => this.currentUser = u)
    );
  }

  get effectiveCollapsed(): boolean {
    return this.isCollapsed && !this.isHovering && window.innerWidth >= 992;
  }

  onSidebarMouseEnter() {
    clearTimeout(this.hoverLeaveTimer);
    if (this.isCollapsed) {
      this.isHovering = true;
    }
  }

  onSidebarMouseLeave() {
    this.hoverLeaveTimer = setTimeout(() => {
      this.isHovering = false;
    }, 150);
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    clearTimeout(this.hoverLeaveTimer);
  }

  toggle() {
    this.sidebarState.toggle();
  }

  closeMobile() {
    this.sidebarState.closeMobile();
  }

  viewProfile() {
    if (this.currentUser?.uuid) {
      this.router.navigate(['/users/view/', this.currentUser.uuid]);
      this.sidebarState.closeMobile();
    }
  }

  logOut() {
    this.accountService.logout();
  }

  navigateWithParams(routerLink: string, queryParams?: { [key: string]: any }) {
    this.sidebarState.closeMobile();
    if (queryParams) {
      this.router.navigate([routerLink], { queryParams, queryParamsHandling: 'merge' });
    } else {
      this.router.navigate([routerLink]);
    }
  }
}
