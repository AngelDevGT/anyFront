import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { customerStatusValues } from '@app/services/data/data.service';
import { DEFAULT_SALE_TYPE_COLOR, OPERATOR_CHIP_COLOR } from '@app/helpers';
import { Customer } from '@app/models/system/customer.model';

@Component({
    templateUrl: 'list-customer.component.html',
    styleUrls: ['list-customer.component.scss']
})
export class ListCustomerComponent implements OnInit {

    customers?: Customer[];
    allCustomers?: Customer[];
    searchTerm?: string;
    pageSize = this.dataService.defaultPageSize;
    tableElementsValues?: any;

    constructor(private dataService: DataService, private alertService: AlertService) {}

    ngOnInit() {
        this.retrieveCustomers();
    }

    retrieveCustomers() {
        this.customers = undefined;
        this.dataService.getAllCustomersByFilter({ status_id: customerStatusValues.activo.status.id })
            .pipe(first())
            .subscribe({
                next: (result: any) => {
                    this.customers = this.dataService.findJsonValue(result, 'json_result') || [];
                    this.allCustomers = this.customers;
                    this.setTableElements(this.customers);
                },
                error: error => {
                    this.customers = [];
                    this.allCustomers = [];
                    this.setTableElements(this.customers);
                    this.alertService.error(this.dataService.getErrorMessageResponse(error, 'Error al cargar los clientes'));
                }
            });
    }

    search(): void {
        if (this.allCustomers) {
            this.customers = this.allCustomers.filter(val => {
                if (this.searchTerm) {
                    const term = this.searchTerm.toLowerCase();
                    return (
                        val.name?.toLowerCase().includes(term) ||
                        val.phone?.toLowerCase().includes(term) ||
                        val.nit?.toLowerCase().includes(term) ||
                        val.email?.toLowerCase().includes(term)
                    );
                }
                return true;
            });
        }
        this.setTableElements(this.customers);
    }

    setTableElements(elements?: Customer[]) {
        this.tableElementsValues = [];
        elements?.forEach((customer: Customer) => {
            const curr_row = [
                { type: 'text', value: customer.name, header_name: 'Nombre' },
                { type: 'text', value: customer.phone || '--', header_name: 'Telefono' },
                { type: 'text', value: customer.nit || 'C/F', header_name: 'NIT' },
                // Capsula en los dos casos, como la columna Estado. Un cliente sin
                // el atributo tiene is_operator = false, pero los anteriores a la
                // columna pueden venir en null: los dos son "No".
                {
                    type: 'badge',
                    value: customer.isOperator ? 'Si' : 'No',
                    identifier: customer.isOperator ? 'operador' : 'no-operador',
                    bg_color: customer.isOperator ? OPERATOR_CHIP_COLOR.bg_color : DEFAULT_SALE_TYPE_COLOR.bg_color,
                    color: customer.isOperator ? OPERATOR_CHIP_COLOR.color : DEFAULT_SALE_TYPE_COLOR.color,
                    header_name: 'Operador'
                },
                {
                    type: 'badge',
                    value: customer.status?.identifier,
                    identifier: customer.status?.identifier,
                    bg_color: customer.status?.bg_color,
                    color: customer.status?.color,
                    header_name: 'Estado'
                },
                {
                    type: 'button',
                    header_name: 'Acciones',
                    button: [
                        {
                            type: 'button',
                            routerLink: 'view/' + customer.id,
                            colorClass: 'dt-btn-view',
                            icon: { class: 'material-icons', icon: 'visibility' }
                        },
                        {
                            type: 'button',
                            routerLink: 'edit/' + customer.id,
                            colorClass: 'dt-btn-edit',
                            icon: { class: 'material-icons', icon: 'edit' }
                        }
                    ]
                }
            ];
            this.tableElementsValues.push(curr_row);
        });
    }
}
