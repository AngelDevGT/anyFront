import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';

import { Establishment } from '@app/models/establishment.model';
import {
    STORE_PLACEHOLDER,
    StoreSection,
    findStoreSection,
    isStoreSectionListing,
    storeIdFromRoute,
    storeSectionForUrl
} from '@app/config/store-sections';
import { AccountService } from './account.service';
import { DataService } from './data/data.service';

/** Estado 28: establecimiento activo. Mismo filtro que usaba el listado de tiendas. */
const ACTIVE_ESTABLISHMENT_STATUS = 28;

/**
 * La tienda sobre la que se esta trabajando, compartida por todas las secciones de Tienda
 * (inventario, ventas, pedidos, gastos, clientes y caja).
 *
 * Se guarda en localStorage —no en sessionStorage— para que sobreviva al cierre del navegador y sea
 * la misma en cualquier pestana. Solo se ofrecen las tiendas asignadas al usuario: la lista se pide
 * una vez y se filtra con `AccountService.filterAssignedEstablishments()`, igual que antes.
 *
 * La URL sigue siendo la fuente de verdad de cada pantalla (la tienda viaja en la ruta); este
 * servicio es la memoria que permite abrir una seccion desde el menu sin volver al listado de
 * tiendas, y el que centraliza la navegacion al cambiar de tienda.
 */
@Injectable({ providedIn: 'root' })
export class StoreContextService {
    private readonly storageKey = 'store:current';

    private readonly currentSubject = new BehaviorSubject<Establishment | undefined>(undefined);
    /** Tienda seleccionada; `undefined` mientras no haya ninguna. */
    readonly current$ = this.currentSubject.asObservable();

    private readonly storesSubject = new BehaviorSubject<Establishment[] | undefined>(undefined);
    /** Tiendas asignadas al usuario; `undefined` mientras no se han cargado. */
    readonly stores$ = this.storesSubject.asObservable();

    private storesRequest?: Observable<Establishment[]>;
    private lastUserEmail?: string;
    private userSeen = false;

    constructor(
        private readonly dataService: DataService,
        private readonly accountService: AccountService,
        private readonly router: Router
    ) {
        // Lo guardado alcanza para navegar y pintar la barra de inmediato; la validacion contra las
        // tiendas asignadas ocurre cuando llega la lista.
        this.currentSubject.next(this.readSaved());

        this.accountService.user.subscribe((user: any) => {
            const email = user?.correo;
            if (this.userSeen && email === this.lastUserEmail) {
                return;
            }
            if (this.userSeen) {
                // Cambio de usuario (o cierre de sesion): ni la lista ni la tienda anterior sirven
                this.storesRequest = undefined;
                this.storesSubject.next(undefined);
                this.adopt(undefined);
            }
            this.userSeen = true;
            this.lastUserEmail = email;
        });
    }

    get current(): Establishment | undefined {
        return this.currentSubject.value;
    }

    /**
     * Las tiendas asignadas al usuario. Se pide una sola vez por sesion; si la peticion falla se
     * devuelve vacio y se permite reintentar en la siguiente llamada.
     */
    stores(): Observable<Establishment[]> {
        if (!this.storesRequest) {
            this.storesRequest = this.dataService
                .getAllEstablishmentsByFilter({ status_id: ACTIVE_ESTABLISHMENT_STATUS })
                .pipe(
                    map((response: any) => {
                        const all: Establishment[] = this.dataService.findJsonValue(response, 'json_result') || [];
                        return this.accountService.filterAssignedEstablishments<Establishment>(all);
                    }),
                    tap(stores => this.onStoresLoaded(stores)),
                    catchError(() => {
                        this.storesRequest = undefined;
                        this.storesSubject.next([]);
                        return of([] as Establishment[]);
                    }),
                    shareReplay({ bufferSize: 1, refCount: false })
                );
        }
        return this.storesRequest;
    }

    /**
     * Resuelve la tienda de la ruta actual. Devuelve `undefined` cuando la ruta trae el placeholder
     * o una tienda que el usuario no tiene asignada, que es la senal para que la pantalla muestre el
     * selector en grande en lugar de consultar datos de una tienda ajena.
     */
    resolveFromRoute(rawId?: string | null): Observable<Establishment | undefined> {
        return this.stores().pipe(
            map(stores => {
                const id = storeIdFromRoute(rawId);
                if (!id) {
                    // Sin tienda en la URL pero con una en memoria: se corrige la URL y la pantalla
                    // se vuelve a resolver con la tienda ya puesta.
                    const current = this.currentSubject.value;
                    if (current?.id) {
                        this.navigateToCurrentSection(current, true);
                    }
                    return undefined;
                }
                const found = stores.find(store => store.id === id);
                if (found) {
                    this.adopt(found);
                }
                return found;
            })
        );
    }

    /** Cambio de tienda desde el selector: recuerda la eleccion y recarga la seccion actual. */
    select(store?: Establishment) {
        this.adopt(store);
        this.navigateToCurrentSection(store);
    }

    /** Entrada a una seccion desde el menu lateral, con la tienda que ya estaba seleccionada. */
    navigateToSection(key: string) {
        const section = findStoreSection(key);
        if (section) {
            this.navigate(section, this.currentSubject.value);
        }
    }

    /** La seccion de Tienda a la que pertenece una URL. */
    sectionForUrl(url: string): StoreSection | undefined {
        return storeSectionForUrl(url);
    }

    /** ¿La URL es el listado de la seccion? En los detalles la tienda solo se muestra. */
    isSectionListing(url: string, section: StoreSection): boolean {
        return isStoreSectionListing(url, section);
    }

    /** Recuerda la tienda sin navegar. */
    private adopt(store?: Establishment) {
        const current = this.currentSubject.value;
        if (current?.id === store?.id && current?.name === store?.name) {
            return;
        }
        this.persist(store);
        this.currentSubject.next(store);
    }

    private navigateToCurrentSection(store?: Establishment, replaceUrl = false) {
        const section = storeSectionForUrl(this.router.url);
        if (section) {
            this.navigate(section, store, replaceUrl);
        }
    }

    private navigate(section: StoreSection, store?: Establishment, replaceUrl = false) {
        const link = section.link(store);
        this.router.navigate(link.path, { queryParams: link.query ?? {}, replaceUrl });
    }

    /**
     * La tienda guardada puede haber dejado de estar asignada o de existir, asi que se descarta si
     * ya no esta entre las opciones; si el usuario tiene una sola tienda, se elige sola.
     */
    private onStoresLoaded(stores: Establishment[]) {
        this.storesSubject.next(stores);
        const current = this.currentSubject.value;
        const valid = current?.id ? stores.find(store => store.id === current.id) : undefined;

        if (valid) {
            this.adopt(valid);
        } else if (stores.length === 1) {
            this.adopt(stores[0]);
        } else if (current) {
            this.adopt(undefined);
        }
    }

    private readSaved(): Establishment | undefined {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) {
                return undefined;
            }
            const saved = JSON.parse(raw);
            return saved?.id && saved.id !== STORE_PLACEHOLDER ? { id: saved.id, name: saved.name } : undefined;
        } catch {
            return undefined;
        }
    }

    private persist(store?: Establishment) {
        try {
            if (store?.id) {
                localStorage.setItem(this.storageKey, JSON.stringify({ id: store.id, name: store.name }));
            } else {
                localStorage.removeItem(this.storageKey);
            }
        } catch {}
    }
}
