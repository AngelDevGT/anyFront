import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { first } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';

import { AlertService, DataService } from '@app/services';
import { EstablishmentCustomer } from '@app/models/system/establishment-customer.model';
import { Establishment } from '@app/models/establishment.model';

@Component({
    templateUrl: 'list-customer-balance.component.html',
    styleUrls: ['list-customer-balance.component.scss']
})
export class ListCustomerBalanceComponent implements OnInit {

    establishmentId!: string;
    establishment?: Establishment;
    customers?: EstablishmentCustomer[];
    allCustomers?: EstablishmentCustomer[];
    searchTerm?: string;
    onlyPending = false;
    pageSize = this.dataService.defaultPageSize;
    tableElementsValues?: any;

    constructor(
        private dataService: DataService,
        private alertService: AlertService,
        private route: ActivatedRoute
    ) {}

    ngOnInit() {
        this.establishmentId = this.route.snapshot.params['id'];

        forkJoin([
            this.dataService.getEstablishmentById(this.establishmentId),
            this.dataService.getEstablishmentCustomers(this.establishmentId)
        ]).subscribe({
            next: (result: any) => {
                this.establishment = this.dataService.findJsonValue(result[0], 'json_result') || {};
                this.allCustomers = this.dataService.findJsonValue(result[1], 'json_result') || [];
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
                { type: 'text', value: customer.pendingSalesCount ?? 0, header_name: 'Ventas pendientes' }
            ];
            this.tableElementsValues.push(curr_row);
        });
    }
}
