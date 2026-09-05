import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';

import { AccountService, AlertService, DataService} from '@app/services';
import { Establishment } from '@app/models/establishment.model';
import { ActivatedRoute } from '@angular/router';
import { parseBanks, serializeBanks } from '@app/helpers';

/** Accion del boton "Bancos" de la tabla. La emite data-table por (modalAction). */
const BANKS_ACTION = 'banks';

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

    // Modal de bancos
    banksDialogOpen = false;
    banksTarget?: Establishment;
    initialBanks: string[] = [];
    loadingBanks = false;
    savingBanks = false;

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
                        { type: 'button', routerLink: '/store/customers/' + element.id, is_absolute: true, colorClass: 'dt-btn-info', icon: { class: 'material-icons', icon: 'group' }, title: 'Clientes' },
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
                    // La consume el boton con 'action', que en vez de navegar emite (modalAction)
                    data: element,
                    button: [
                        { type: 'button', routerLink: 'view/' + element.id, query_params: { opt: this.viewOption }, colorClass: 'dt-btn-view', icon: { class: 'material-icons', icon: 'visibility' }, title: 'Ver' },
                        { type: 'button', routerLink: 'edit/' + element.id, query_params: { opt: this.viewOption }, colorClass: 'dt-btn-edit', icon: { class: 'material-icons', icon: 'edit' }, title: 'Editar' },
                        { type: 'button', routerLink: '/productsForSale', query_params: { store: element.id }, is_absolute: true, colorClass: 'dt-btn-delete', icon: { class: 'material-icons', icon: 'shopping_bag' }, title: 'Productos' },
                        { type: 'button', routerLink: 'customers/' + element.id, colorClass: 'dt-btn-info', icon: { class: 'material-icons', icon: 'group' }, title: 'Clientes' },
                        { type: 'button', action: BANKS_ACTION, colorClass: 'dt-btn-secondary', icon: { class: 'material-icons', icon: 'account_balance' }, title: 'Bancos' }
                    ]
                };
                curr_row = [
                    { type: 'text', value: element.name, header_name: 'Nombre' },
                    { type: 'text', value: element.address, header_name: 'Direccion' },
                    { type: 'text', value: element.description, header_name: 'Descripcion' },
                    buttonsRow
                ];
            }
            if (this.accountService.isAssignedEstablishment(element)) {
                this.tableElementsValues.push(curr_row);
            }
        });
    }

    // ── Bancos ───────────────────────────────────────────────────────────────

    onTableAction(event: { target: string; data: any }) {
        if (event.target === BANKS_ACTION) {
            this.openBanks(event.data);
        }
    }

    /**
     * El listado no trae los bancos —/retrieveEstablishments no se toco— asi que se piden al
     * abrir. El modal se muestra enseguida con el spinner y recibe la lista cuando llega.
     */
    private openBanks(establishment: Establishment) {
        this.banksTarget = establishment;
        this.initialBanks = [];
        this.savingBanks = false;
        this.loadingBanks = true;
        this.banksDialogOpen = true;

        this.dataService.getEstablishmentById(establishment.id!)
            .pipe(first())
            .subscribe({
                next: (response: any) => {
                    // findJsonValue y no la clave del wrapper: esa se deriva del path, asi que
                    // cambia con cada version del endpoint (hoy /getEstablishmentV2)
                    const detail = this.dataService.findJsonValue(response, 'json_result');
                    // Si mientras cargaba se cerro el modal o se abrio el de otra tienda, se descarta
                    if (!this.banksDialogOpen || this.banksTarget?.id !== establishment.id) return;
                    this.initialBanks = parseBanks(detail?.banks);
                    this.loadingBanks = false;
                },
                error: () => {
                    if (!this.banksDialogOpen || this.banksTarget?.id !== establishment.id) return;
                    this.loadingBanks = false;
                    this.banksDialogOpen = false;
                    this.alertService.error('Error al cargar los bancos de la tienda');
                }
            });
    }

    onBanksConfirmed(names: string[]) {
        if (!this.banksTarget?.id) return;

        const target = this.banksTarget;
        const banks = serializeBanks(names);
        this.savingBanks = true;

        this.dataService.updateEstablishmentBanks(target.id!, banks)
            .pipe(first())
            .subscribe({
                next: () => {
                    // La tienda del listado queda con lo guardado; no hace falta recargar la tabla
                    // porque los bancos no son una columna
                    target.banks = banks;
                    this.savingBanks = false;
                    this.banksDialogOpen = false;
                    this.alertService.success('Bancos actualizados');
                },
                error: () => {
                    this.savingBanks = false;
                    this.alertService.error('Error al guardar los bancos, consulte con el administrador');
                }
            });
    }

    onBanksCancelled() {
        this.banksDialogOpen = false;
    }
}
