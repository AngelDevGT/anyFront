import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { SidebarStateService } from '@app/services/sidebar-state.service';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  isSidebarCollapsed = false;
  private sub!: Subscription;

  constructor(private readonly sidebarState: SidebarStateService) {}

  ngOnInit() {
    this.sub = this.sidebarState.collapsed$.subscribe(v => this.isSidebarCollapsed = v);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  toggleMobileSidebar() {
    this.sidebarState.toggleMobile();
  }
}
