import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { SidebarStateService } from '@app/services/sidebar-state.service';
import { RecentRoutesService } from '@app/services/recent-routes.service';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  isSidebarCollapsed = false;
  private sub!: Subscription;

  constructor(
    private readonly sidebarState: SidebarStateService,
    private readonly recentRoutes: RecentRoutesService
  ) {}

  ngOnInit() {
    this.sub = this.sidebarState.collapsed$.subscribe(v => this.isSidebarCollapsed = v);
    // Se anota desde aca y no desde el home: hay que registrar las pantallas al visitarlas, no al
    // volver a la portada. Este layout envuelve a todas las rutas autenticadas.
    this.recentRoutes.startTracking();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  toggleMobileSidebar() {
    this.sidebarState.toggleMobile();
  }
}
