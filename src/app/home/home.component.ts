import { Component, OnInit } from '@angular/core';

import { AccountService, RecentRoute, RecentRoutesService } from '@app/services';

@Component({
    selector: 'app-home',
    templateUrl: 'home.component.html',
    styleUrls: ['home.component.scss']
})
export class HomeComponent implements OnInit {

    /** "Buenos días", "Buenas tardes" o "Buenas noches", segun la hora de la maquina. */
    greeting = '';
    /** Solo el nombre de pila: el saludo con el nombre completo suena a carta formal. */
    firstName = '';
    /** La fecha de hoy, que es el dato con el que se trabaja en casi toda la aplicacion. */
    todayLabel = '';
    roleName?: string;

    recentRoutes: RecentRoute[] = [];

    constructor(
        private readonly accountService: AccountService,
        private readonly recentRoutesService: RecentRoutesService
    ) {}

    ngOnInit() {
        const now = new Date();
        const fullName = (this.accountService.userName || '').trim();

        this.greeting = this.buildGreeting(now.getHours());
        this.firstName = fullName.split(/\s+/)[0] || '';
        this.todayLabel = this.buildTodayLabel(now);
        this.roleName = this.accountService.userRole?.identifier;

        this.recentRoutes = this.recentRoutesService.getRecent();
    }

    private buildGreeting(hour: number): string {
        if (hour < 12) {
            return 'Buenos días';
        }
        if (hour < 19) {
            return 'Buenas tardes';
        }
        return 'Buenas noches';
    }

    /**
     * "Sábado, 16 de agosto". Sin el año, que en el dia a dia no aporta y alarga la linea en movil.
     * Se arma con `toLocaleDateString` y no con DatePipe porque el locale es-GT no esta registrado
     * en la aplicacion; el del navegador sirve igual, como en el dashboard de pedidos.
     */
    private buildTodayLabel(date: Date): string {
        const label = date.toLocaleDateString('es-GT', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
        return label.charAt(0).toUpperCase() + label.slice(1);
    }

    trackByUrl(_index: number, route: RecentRoute) {
        return route.url;
    }
}
