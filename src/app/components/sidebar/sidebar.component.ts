import { Component, OnInit, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { MatTooltip } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AccountService, StoreContextService } from '@app/services';
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

  /**
   * El `router_link` del hijo que corresponde a la pantalla actual, o cadena vacia
   * si ninguno. Se deriva de la URL en cada navegacion en vez de recordar el ultimo
   * boton apretado: recargar, pegar una URL, el boton atras del navegador o llegar
   * desde un link de otra pantalla dejarian esa memoria marcando lo que no es.
   */
  private activeLink = '';

  /** Lo mismo para las secciones de tienda, que no tienen un router_link fijo. */
  private activeStoreSection?: string;

  constructor(
    private readonly router: Router,
    private readonly accountService: AccountService,
    private readonly sidebarState: SidebarStateService,
    private readonly storeContext: StoreContextService
  ) {}

  ngOnInit() {
    this.menuItems = this.accountService.getUserMenuItems();
    this.resolveActive(this.router.url);
    this.openActiveGroup();

    this.subs.push(
      this.sidebarState.collapsed$.subscribe(v => this.isCollapsed = v),
      this.sidebarState.mobileOpen$.subscribe(v => this.isMobileOpen = v),
      this.accountService.user.subscribe(u => this.currentUser = u),
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(event => this.resolveActive((event as NavigationEnd).urlAfterRedirects))
    );
  }

  // ── Opcion activa ──────────────────────────────────────────────────────────

  /**
   * Que opcion del menu representa a la URL actual.
   *
   * Se compara por prefijo porque las rutas de la app son jerarquicas: las vistas
   * que no estan en el menu cuelgan de la que si esta ("/providers/view/<id>" de
   * "/providers"), asi que el listado sigue marcado mientras se navega dentro de
   * su seccion.
   *
   * Gana el link mas largo de los que matchean, que es el mas especifico: sin eso,
   * estando en "/finishedProduct/order/board" se encenderian tambien "Pedidos"
   * ("/finishedProduct/order") y cualquier otro ancestro que este en el menu.
   */
  private resolveActive(url: string) {
    const path = url.split('?')[0].split('#')[0];

    this.activeLink = this.childLinks()
      .filter(link => path === link || path.startsWith(link + '/'))
      .sort((a, b) => b.length - a.length)[0] ?? '';

    // Las secciones de tienda llevan la tienda en la URL, asi que no hay link fijo
    // con que comparar: cada seccion sabe reconocer sus propias rutas.
    this.activeStoreSection = this.storeContext.sectionForUrl(url)?.key;
  }

  /** Los router_link de todos los hijos del menu; las secciones de tienda no tienen. */
  private childLinks(): string[] {
    return this.menuItems
      .flatMap((subMenu: any) => subMenu.childs ?? [])
      .filter((child: any) => !child.store_section && !!child.router_link)
      .map((child: any) => child.router_link);
  }

  /**
   * Deja desplegada la seccion de la pantalla actual al entrar, para no tener que
   * buscar de nuevo donde se estaba trabajando.
   *
   * Se hace una sola vez, al construir el menu: despues el collapse es de Bootstrap
   * —que agrega y quita las clases por su cuenta— y volver a tocarlo en cada
   * navegacion reabriria secciones que el usuario cerro a mano.
   */
  private openActiveGroup() {
    const group = this.menuItems.find((subMenu: any) =>
      (subMenu.childs ?? []).some((child: any) => this.isActiveChild(child)));
    if (!group) return;

    group.initially_open = true;
    group.button_aria_expanded = 'true';
  }

  /** ¿Este hijo es la pantalla actual? Marca la opcion en el menu. */
  isActiveChild(child: any): boolean {
    if (child.store_section) {
      return this.activeStoreSection === child.store_section;
    }
    return !!this.activeLink && child.router_link === this.activeLink;
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

  /**
   * Tooltip con el texto completo de una opcion que no entra en el ancho del
   * menu y quedo cortada con "...". El menu colapsado ya tiene su propio
   * tooltip por el binding de matTooltip, asi que ahi no se hace nada.
   *
   * Se decide al pasar el mouse y no en el binding a proposito: medir el ancho
   * real obliga a leer el DOM, y hacerlo en cada ciclo de deteccion de cambios
   * —por cada opcion del menu, que son varias decenas— no vale la pena para algo
   * que solo importa mientras el cursor esta encima.
   *
   * Por lo mismo el tooltip se abre a mano: cuando Material procesa el mouseenter
   * su mensaje todavia esta vacio y no muestra nada, asi que primero se le pone
   * el texto y despues se le pide que aparezca.
   */
  showTextIfTruncated(textElement: HTMLElement, text: string, tooltip: MatTooltip) {
    if (this.effectiveCollapsed || !text) return;

    // El +1 evita los falsos positivos por el redondeo de anchos fraccionarios.
    // Se limpia el mensaje cuando ya no hace falta —el texto entero cabe— porque
    // si no, Material volveria a mostrar el que quedo de un hover anterior.
    if (textElement.scrollWidth <= textElement.clientWidth + 1) {
      tooltip.message = '';
      return;
    }

    tooltip.message = text;
    tooltip.show();
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

  /**
   * Las secciones de tienda no tienen una URL fija: se arma con la tienda que este seleccionada, o
   * con el placeholder si todavia no hay ninguna, y ahi la pantalla muestra el selector en grande.
   */
  navigateChild(child: any) {
    if (child.store_section) {
      this.sidebarState.closeMobile();
      this.storeContext.navigateToSection(child.store_section);
      return;
    }
    this.navigateWithParams(child.router_link, child.query_params);
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
