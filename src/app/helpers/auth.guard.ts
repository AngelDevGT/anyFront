import { Injectable, inject } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, CanActivateFn } from '@angular/router';
import { Role } from '@app/models';

import { AccountService } from '@app/services';
import { catchError, map, of, switchMap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
    constructor(
        private router: Router,
        private accountService: AccountService
    ) {}

    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
        const user = this.accountService.userValue;
        if (user) {
            // authorised so return true
            return true;
        }

        // not logged in so redirect to login page with the return url
        this.router.navigate(['/account/login'], { queryParams: { returnUrl: state.url }});
        return false;
    }
}

export const canActivate: CanActivateFn = (
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ) => {
    const accountService = inject(AccountService);
    const router = inject(Router);
  
    return accountService.checkLogin().pipe(
      switchMap((isLoggedIn: boolean) => {
        if (isLoggedIn) {
          // return accountService.getUserRole().pipe(
          //   map((userRole: Role) => {
          //     const allowedRoles = route.data['roles'];
          //     if (allowedRoles && allowedRoles.includes(userRole)) {
          //       return true;
          //     } else {
          //       return router.createUrlTree(['/home']);
          //     }
          //   }),
          //   catchError(() => {
          //     // Maneja errores al obtener el rol del usuario
          //     return of(router.createUrlTree(['/home']));
          //   })
          // );
          return of(true);
        } else {
          // Si el usuario no está autenticado, redirige a la página de inicio de sesión
          return of(router.createUrlTree(['/account/login']));
        }
      }),
      catchError(() => {
        // Maneja errores al verificar la autenticación del usuario
        return of(router.createUrlTree(['/account/login']));
      })
    );
  };


  export const canActivatePrev: CanActivateFn = (
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ) => {
    const accountService = inject(AccountService);
    const router = inject(Router);
  
    return accountService.checkLogin().pipe(
      map(() => true),
      catchError(() => {
        return of(router.createUrlTree(['/account/login']));
      })
    );
  };

  export const canActivateV2: CanActivateFn = (
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ) => {
    const accountService = inject(AccountService);
    const router = inject(Router);
    return accountService.checkLogin().pipe(
      switchMap((userValue: any) => {
        if (userValue) {
          const userRoutes = userValue.role.paths || [];
          const destinationRoute = state.url;
          const destinationRouteFound = userRoutes.find((route: any) => {
            const currRegex = new RegExp(route.matchPattern);
            return currRegex.test(destinationRoute)
          });
          if(!destinationRouteFound){
            return of(router.createUrlTree(['/home']));
          }
          return of(true);
        } else {
          // Si el usuario no está autenticado, redirige a la página de inicio de sesión
          return of(router.createUrlTree(['/account/login']));
        }
      }),
      catchError(() => {
        // Maneja errores al verificar la autenticación del usuario
        return of(router.createUrlTree(['/account/login']));
      })
    );
      // map(() => true),
      // catchError(() => {
      //   return of(router.createUrlTree(['/account/login']));
      // })
  };

