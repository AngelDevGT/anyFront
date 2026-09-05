import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { Establishment } from '@app/models/establishment.model';
import { StoreSection } from '@app/config/store-sections';
import { StoreContextService } from '@app/services';

/**
 * Barra con la tienda sobre la que se esta trabajando. La pinta el layout, no cada pantalla, asi que
 * queda fija arriba del contenido en todas las secciones de Tienda y no hay que repetirla.
 *
 * En los listados el selector cambia de tienda; en los detalles (ver, crear, editar) solo muestra
 * cual es, porque cambiarla a media edicion no tendria a donde llevar.
 */
@Component({
    selector: 'store-context-bar',
    templateUrl: './store-context-bar.component.html',
    styleUrls: ['./store-context-bar.component.scss']
})
export class StoreContextBarComponent implements OnInit, OnDestroy {
    section?: StoreSection;
    canSwitch = false;
    store?: Establishment;

    private subs: Subscription[] = [];

    constructor(
        private readonly router: Router,
        private readonly storeContext: StoreContextService
    ) {}

    ngOnInit() {
        this.applyUrl(this.router.url);
        this.subs.push(
            this.router.events
                .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
                .subscribe(event => this.applyUrl(event.urlAfterRedirects)),
            this.storeContext.current$.subscribe(store => this.store = store)
        );
    }

    ngOnDestroy() {
        this.subs.forEach(sub => sub.unsubscribe());
    }

    private applyUrl(url: string) {
        this.section = this.storeContext.sectionForUrl(url);
        this.canSwitch = !!this.section && this.storeContext.isSectionListing(url, this.section);
    }
}
