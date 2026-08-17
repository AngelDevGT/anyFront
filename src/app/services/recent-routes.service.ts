import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { AccountService } from './account.service';

/** Una pantalla visitada, ya resuelta contra el menu que le toca al usuario. */
export interface RecentRoute {
    /** Ruta tal como se guarda; lleva los query params si el item del menu los define. */
    url: string;
    routerLink: string;
    queryParams?: { [key: string]: any };
    label: string;
    /** Icono del grupo del menu: los hijos usan todos `arrow_right`, que no distingue nada. */
    icon: string;
    /** Grupo del menu, para separar pantallas de nombre parecido ("Pedidos" hay en varios). */
    group: string;
}

/**
 * Ultimas pantallas visitadas por el usuario logueado, para mostrarlas como atajos en el home.
 *
 * La llave de localStorage lleva el id del usuario. El almacenamiento es por dispositivo, no por
 * sesion ni por pestana, y en tienda un mismo equipo lo comparten varias personas: con una llave
 * unica, quien entra despues veria los atajos del turno anterior. sessionStorage tambien lo
 * evitaria, pero se borra al cerrar la pestana y la lista casi nunca alcanzaria a servir de nada.
 *
 * Solo se guarda la URL. Etiqueta, icono y grupo se resuelven al leer, contra el menu del momento:
 * si el rol pierde acceso a una pantalla, esta deja de aparecer sin que haya que limpiar nada.
 */
@Injectable({ providedIn: 'root' })
export class RecentRoutesService {
    private readonly prefix = 'recientes:';
    /** Tope de la lista. Con mas, el home vuelve a ser una pared de botones. */
    private readonly limit = 4;

    private tracking = false;

    constructor(
        private readonly router: Router,
        private readonly accountService: AccountService
    ) {}

    /**
     * Empieza a anotar las visitas. Idempotente, para que el layout pueda llamarlo sin cuidar si
     * ya estaba corriendo. No se desuscribe: el servicio vive lo mismo que la aplicacion.
     */
    startTracking() {
        if (this.tracking) {
            return;
        }
        this.tracking = true;
        this.router.events
            .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
            .subscribe(event => this.track(event.urlAfterRedirects));
    }

    /** Las visitadas mas recientemente primero, ya sin las que el rol dejo de poder ver. */
    getRecent(): RecentRoute[] {
        const index = this.buildIndex();
        return this.read()
            .map(url => this.resolve(url, index))
            .filter((route): route is RecentRoute => !!route)
            .slice(0, this.limit);
    }

    /**
     * Solo se anotan las pantallas que estan en el menu. Un detalle o un formulario de edicion
     * no son destinos a los que tenga sentido volver a ciegas, y ademas no tienen nombre propio
     * que mostrar en la tarjeta.
     */
    private track(url: string) {
        const route = this.resolve(url, this.buildIndex());
        if (!route) {
            return;
        }
        const urls = this.read().filter(stored => stored !== route.url);
        urls.unshift(route.url);
        this.write(urls.slice(0, this.limit));
    }

    /**
     * Indice de las pantallas del menu del usuario. Cada una queda registrada con sus query params
     * y, si los tiene, tambien sin ellos: a `/store?opt=inventory` se llega desde otros lados sin
     * el `opt` y sigue siendo la misma pantalla.
     */
    private buildIndex(): Map<string, RecentRoute> {
        const index = new Map<string, RecentRoute>();

        for (const group of this.accountService.getUserMenuItems()) {
            for (const child of group.childs || []) {
                if (!child?.router_link) {
                    continue;
                }
                const route: RecentRoute = {
                    url: this.destinationRoute(child),
                    routerLink: child.router_link,
                    queryParams: child.query_params,
                    label: child.link_name,
                    icon: group.button_icon,
                    group: group.button_name
                };
                index.set(route.url, route);
                if (!index.has(child.router_link)) {
                    index.set(child.router_link, route);
                }
            }
        }
        return index;
    }

    /** La ruta del item del menu con sus query params, en el mismo formato que da el Router. */
    private destinationRoute(child: any): string {
        if (!child.query_params) {
            return child.router_link;
        }
        const query = Object.keys(child.query_params)
            .map(key => `${key}=${child.query_params[key]}`)
            .join('&');
        return `${child.router_link}?${query}`;
    }

    private resolve(url: string, index: Map<string, RecentRoute>): RecentRoute | undefined {
        const clean = url.split('#')[0];
        return index.get(clean) || index.get(clean.split('?')[0]);
    }

    /** Sin usuario no hay donde guardar; pasa en el arranque, antes de que se resuelva la sesion. */
    private get storageKey(): string | undefined {
        const userId = this.accountService.userValue?.userID;
        return userId ? this.prefix + userId : undefined;
    }

    private read(): string[] {
        const key = this.storageKey;
        if (!key) {
            return [];
        }
        try {
            const raw = localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.filter(url => typeof url === 'string') : [];
        } catch {
            return [];
        }
    }

    private write(urls: string[]) {
        const key = this.storageKey;
        if (!key) {
            return;
        }
        try {
            localStorage.setItem(key, JSON.stringify(urls));
        } catch {}
    }
}
