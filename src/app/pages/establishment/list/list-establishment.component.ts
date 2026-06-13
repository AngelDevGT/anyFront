import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';

import { AccountService, AlertService, DataService} from '@app/services';
import { Establishment } from '@app/models/establishment.model';
import { ActivatedRoute } from '@angular/router';

@Component({
    templateUrl: 'list-establishment.component.html',
    styleUrls: ['list-establishment.component.scss']
})
export class ListEstablishmentComponent implements OnInit {
    establishments?: Establishment[];
    allEstablishments?: Establishment[];
    searchTerm?: string;
    pageSize = this.dataService.defaultPageSize;
    title = '';
    viewOption = '';
    isInventory = false;
    tableElementsValues?: any;

    constructor(private dataService: DataService, private route: ActivatedRoute, private alertService: AlertService, private accountService: AccountService) {}

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            this.viewOption = params['opt'];
        });
        this.title = 'Tiendas';
        if (this.viewOption && this.viewOption === 'inventory') {
            this.isInventory = true;
        }
        this.retriveEstablishments();
    }

    retriveEstablishments() {
        this.establishments = undefined;
        this.dataService.getAllEstablishmentsByFilter({status_id: 28})
            .pipe(first())
            .subscribe({
                next: (establishments: any) => {
                    this.establishments = establishments.retrieveEstablishmentsResponse?.data[0]?.json_result || [];
                    this.allEstablishments = this.establishments;
                    this.setTableElements(this.establishments);
                }
            });
    }

    search(value: any): void {
        if (this.allEstablishments) {
            this.establishments = this.allEstablishments.filter((val) => {
                if (this.searchTerm) {
                    const term = this.searchTerm.toLowerCase();
                    return val.name?.toLowerCase().includes(term) ||
                           val.address?.toLowerCase().includes(term) ||
                           val.description?.toLowerCase().includes(term);
                }
                return true;
            });
        }
        this.setTableElements(this.establishments);
    }

    setTableElements(elements: any) {
        this.tableElementsValues = [];
        const userEmail = this.accountService.userEmail;
        elements?.forEach((element: any) => {
            let curr_row: any[];
            let buttonsRow: any;
            if (this.isInventory) {
                buttonsRow = {
                    type: 'button',
                    header_name: 'Acciones',
                    button: [
                        { type: 'button', routerLink: 'inventory/' + element.id, colorClass: 'dt-btn-edit', icon: { class: 'material-icons', icon: 'inventory_2' }, title: 'Inventario' },
                        { type: 'button', routerLink: '/store/sales/history/' + element.id, is_absolute: true, colorClass: 'dt-btn-view', icon: { class: 'material-icons', icon: 'shopping_bag' }, title: 'Ventas' },
                        { type: 'button', routerLink: '/productsForSale/order', is_absolute: true, query_params: { opt: 'store', store: element.id, name: element.name }, colorClass: 'dt-btn-secondary', icon: { class: 'material-icons', icon: 'local_shipping' }, title: 'Pedidos' },
                        { type: 'button', routerLink: '/store/expenses/history/' + element.id, is_absolute: true, colorClass: 'dt-btn-warning', icon: { class: 'material-icons', icon: 'money_off' }, title: 'Gastos' },
                        { type: 'button', routerLink: '/cashClosing/' + element.id, is_absolute: true, colorClass: 'dt-btn-delete', icon: { class: 'material-icons', icon: 'dns' }, title: 'Caja' }
                    ]
                };
                curr_row = [
                    { type: 'text', value: element.name, header_name: 'Nombre' },
                    { type: 'text', value: element.address, header_name: 'Direccion' },
                    buttonsRow
                ];
            } else {
                buttonsRow = {
                    type: 'button',
                    header_name: 'Acciones',
                    button: [
                        { type: 'button', routerLink: 'view/' + element.id, query_params: { opt: this.viewOption }, colorClass: 'dt-btn-view', icon: { class: 'material-icons', icon: 'visibility' }, title: 'Ver' },
                        { type: 'button', routerLink: 'edit/' + element.id, query_params: { opt: this.viewOption }, colorClass: 'dt-btn-edit', icon: { class: 'material-icons', icon: 'edit' }, title: 'Editar' },
                        { type: 'button', routerLink: '/productsForSale', query_params: { store: element.id }, is_absolute: true, colorClass: 'dt-btn-delete', icon: { class: 'material-icons', icon: 'shopping_bag' }, title: 'Productos' }
                    ]
                };
                curr_row = [
                    { type: 'text', value: element.name, header_name: 'Nombre' },
                    { type: 'text', value: element.address, header_name: 'Direccion' },
                    { type: 'text', value: element.description, header_name: 'Descripcion' },
                    buttonsRow
                ];
            }
            const emails = this.accountService.extractEmails(element.description);
            if (this.accountService.isAdminUser()) {
                this.tableElementsValues.push(curr_row);
            } else if (emails.length > 0 && userEmail && emails.includes(userEmail)) {
                this.tableElementsValues.push(curr_row);
            }
        });
    }
}
