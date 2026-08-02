import { Injectable } from '@angular/core';
import {
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpInterceptor,
    HttpErrorResponse,
} from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';

import { environment } from '@environments/enviroment';
import { AccountService } from '@app/services';

/** Endpoints que no llevan token: son justamente los que sirven para obtenerlo. */
const ANONYMOUS_PATHS = ['/Login', '/Refresh', '/Logout', '/RegisterUser'];

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
    /** Evita que varias peticiones en paralelo disparen varios refresh a la vez. */
    private refreshing = false;
    private refreshed$ = new BehaviorSubject<boolean | null>(null);

    constructor(private accountService: AccountService) { }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const isApiUrl = request.url.startsWith(environment.apiUrlBase);
        const isAnonymous = ANONYMOUS_PATHS.some((path) => request.url.includes(path));

        if (!isApiUrl || isAnonymous) {
            return next.handle(request);
        }

        return next.handle(this.withToken(request)).pipe(
            catchError((error: HttpErrorResponse) => {
                // Un 401 sobre la API significa access token vencido: se intenta renovar una
                // sola vez y se reintenta la peticion original.
                if (error.status === 401 && this.accountService.refreshToken) {
                    return this.retryWithRefreshedToken(request, next);
                }
                return throwError(() => error);
            }),
        );
    }

    private withToken(request: HttpRequest<any>): HttpRequest<any> {
        const token = this.accountService.accessToken;

        if (!token) {
            return request;
        }

        return request.clone({
            setHeaders: { Authorization: `Bearer ${token}` },
        });
    }

    private retryWithRefreshedToken(
        request: HttpRequest<any>,
        next: HttpHandler,
    ): Observable<HttpEvent<any>> {
        if (this.refreshing) {
            // Ya hay un refresh en curso: esperar su resultado en vez de lanzar otro.
            return this.refreshed$.pipe(
                filter((result): result is boolean => result !== null),
                take(1),
                switchMap((ok) =>
                    ok
                        ? next.handle(this.withToken(request))
                        : throwError(
                            () => new HttpErrorResponse({ status: 401, statusText: 'Sesión expirada' }),
                        ),
                ),
            );
        }

        this.refreshing = true;
        this.refreshed$.next(null);

        return this.accountService.refreshSession().pipe(
            switchMap((ok) => {
                this.refreshing = false;
                this.refreshed$.next(ok);

                if (!ok) {
                    // El ErrorInterceptor hara el logout al ver este 401.
                    return throwError(
                        () => new HttpErrorResponse({ status: 401, statusText: 'Sesión expirada' }),
                    );
                }

                return next.handle(this.withToken(request));
            }),
            catchError((error) => {
                this.refreshing = false;
                this.refreshed$.next(false);
                return throwError(() => error);
            }),
        );
    }
}
