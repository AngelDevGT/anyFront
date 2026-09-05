import { Component, OnInit } from '@angular/core';
import { first, switchMap } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';

import { AlertService, DataService, StoreContextService } from '@app/services';
import { EstablishmentCustomer } from '@app/models/system/establishment-customer.model';
import { Establishment } from '@app/models/establishment.model';

@Component({
    templateUrl: 'list-customer-balance.component.html',
    styleUrls: ['list-customer-balance.component.scss']
})
export class ListCustomerBalanceComponent implements OnInit {

    establishmentId!: string;
    establishment?: Establishment;
    /** Sin tienda elegida no se consulta nada: la pantalla muestra el selector en grande. */
    storeSelected = false;
    customers?: EstablishmentCustomer[];
    allCustomers?: EstablishmentCustomer[];
    searchTerm?: string;
    onlyPending = false;
    pageSize = this.dataService.defaultPageSize;
    tableElementsValues?: any;

    constructor(
        private dataService: DataService,
        private alertService: AlertService,
        private route: ActivatedRoute,
        private storeContext: StoreContextService
    ) {}

    ngOnInit() {
        // La tienda viaja en la ruta: al cambiarla desde el selector se navega a esta misma sección
        // con otra tienda y Angular reutiliza el componente, así que ngOnInit ya no vuelve a correr.
        this.route.paramMap
            .pipe(switchMap(params => this.storeContext.resolveFromRoute(params.get('id'))))
            .subscribe(store => this.onStoreChange(store));
    }

    private onStoreChange(store?: Establishment) {
        this.storeSelected = !!store?.id;
        this.establishment = store;
        this.establishmentId = store?.id ?? '';

        if (!store?.id) {
            this.allCustomers = undefined;
            this.customers = undefined;
            this.tableElementsValues = [];
            return;
        }
        this.loadCustomers(store.id);
    }

    private loadCustomers(establishmentId: string) {
        this.allCustomers = undefined;
        this.customers = undefined;
        this.searchTerm = undefined;

        this.dataService.getEstablishmentCustomers(establishmentId).subscribe({
            next: (result: any) => {
                this.allCustomers = this.dataService.findJsonValue(result, 'json_result') || [];
            },
            error: error => {
                this.allCustomers = [];
                this.customers = [];
                this.setTableElements([]);
                this.alertService.error(this.dataService.getErrorMessageResponse(error, 'Error al cargar los clientes de la tienda'));
            },
            complete: () => this.search()
        });
    }

    formatPrice(value?: number | string): string {
        return this.dataService.getFormatedPriceWithSeparators(Number(value ?? 0));
    }

    /** Suma de los saldos pendientes visibles. */
    get totalPendingBalance(): number {
        return (this.customers ?? []).reduce((sum, customer) => sum + Number(customer.pendingBalance ?? 0), 0);
    }

    get customersWithDebt(): number {
        return (this.customers ?? []).filter(customer => Number(customer.pendingBalance ?? 0) > 0).length;
    }

    search(): void {
        const term = this.searchTerm?.trim().toLowerCase();
        this.customers = (this.allCustomers ?? []).filter(customer => {
            const matchesTerm = !term
                || customer.name?.toLowerCase().includes(term)
                || customer.nit?.toLowerCase().includes(term)
                || customer.phone?.toLowerCase().includes(term);
            const matchesPending = !this.onlyPending || Number(customer.pendingBalance ?? 0) > 0;
            return matchesTerm && matchesPending;
        });
        this.setTableElements(this.customers);
    }

    togglePendingFilter() {
        this.onlyPending = !this.onlyPending;
        this.search();
    }

    setTableElements(elements: EstablishmentCustomer[]) {
        this.tableElementsValues = [];
        elements?.forEach((customer: EstablishmentCustomer) => {
            const balance = Number(customer.pendingBalance ?? 0);
            const curr_row = [
                { type: 'text', value: customer.name, header_name: 'Nombre' },
                { type: 'text', value: customer.nit || 'C/F', header_name: 'NIT' },
                { type: 'text', value: customer.phone || '--', header_name: 'Telefono' },
                {
                    type: 'text',
                    value: this.dataService.getFormatedPriceWithSeparators(balance),
                    header_name: 'Saldo pendiente'
                },
                {
                    type: 'badge',
                    value: balance > 0 ? 'Pendiente' : 'Al dia',
                    identifier: balance > 0 ? 'Pendiente' : 'Al dia',
                    bg_color: balance > 0 ? '#f8d7da' : '#d4edda',
                    color: balance > 0 ? '#721c24' : '#155724',
                    header_name: 'Estado'
                },
                { type: 'text', value: customer.pendingSalesCount ?? 0, header_name: 'Ventas pendientes' },
                {
                    type: 'button',
                    header_name: 'Acciones',
                    button: [
                        {
                            // La tienda y el cliente viajan como query params:
                            // /store/customers/payments?store=<tienda>&customer=<cliente>
                            type: 'button',
                            routerLink: '/store/customers/payments',
                            is_absolute: true,
                            query_params: { store: this.establishmentId, customer: customer.id },
                            colorClass: 'dt-btn-view',
                            icon: { class: 'material-icons', icon: 'receipt_long' },
                            title: 'Historial de ventas'
                        }
                    ]
                }
            ];
            this.tableElementsValues.push(curr_row);
        });
    }
}
