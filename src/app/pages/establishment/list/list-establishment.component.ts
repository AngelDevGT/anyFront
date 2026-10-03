import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';

import { AccountService, AlertService, DataService} from '@app/services';
import { Establishment } from '@app/models/establishment.model';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { parseBanks, parseExpenseTags, serializeBanks, serializeExpenseTags } from '@app/helpers';

/** Acciones de los botones "Bancos" y "Gastos" de la tabla. Las emite data-table por (modalAction). */
const BANKS_ACTION = 'banks';
const EXPENSE_TAGS_ACTION = 'expenseTags';
type TagListKind = typeof BANKS_ACTION | typeof EXPENSE_TAGS_ACTION;

/**
 * Lo que cambia entre las dos listas de etiquetas de la tienda. Las dos tienen el mismo formato
 * (texto separado por salto de linea, ver @app/helpers/tag-list) y usan el mismo modal.
 */
interface TagListConfig {
    field: 'banks' | 'expenseTags';
    parse: (text?: string | null) => string[];
    serialize: (names: string[]) => string;
    save: (dataService: DataService, id: string, text: string) => Observable<any>;
    title: string;
    addTitle: string;
    placeholder: string;
    emptyText: string;
    loadingText: string;
    saved: string;
    loadError: string;
    saveError: string;
}

const TAG_LISTS: Record<TagListKind, TagListConfig> = {
    [BANKS_ACTION]: {
        field: 'banks',
        parse: parseBanks,
        serialize: serializeBanks,
        save: (ds, id, text) => ds.updateEstablishmentBanks(id, text),
        title: 'Bancos de la tienda',
        addTitle: 'Agregar banco',
        placeholder: 'Nombre del banco',
        emptyText: 'Ningún banco agregado todavía.',
        loadingText: 'Cargando bancos...',
        saved: 'Bancos actualizados',
        loadError: 'Error al cargar los bancos de la tienda',
        saveError: 'Error al guardar los bancos, consulte con el administrador'
    },
    [EXPENSE_TAGS_ACTION]: {
        field: 'expenseTags',
        parse: parseExpenseTags,
        serialize: serializeExpenseTags,
        save: (ds, id, text) => ds.updateEstablishmentExpenseTags(id, text),
        title: 'Etiquetas de gastos',
        addTitle: 'Agregar etiqueta',
        placeholder: 'Nombre de la etiqueta',
        emptyText: 'Ninguna etiqueta agregada todavía.',
        loadingText: 'Cargando etiquetas...',
        saved: 'Etiquetas de gastos actualizadas',
        loadError: 'Error al cargar las etiquetas de gastos de la tienda',
        saveError: 'Error al guardar las etiquetas de gastos, consulte con el administrador'
    }
};

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

    // Modal de bancos / etiquetas de gastos: es uno solo, cambia la lista que edita
    tagDialogOpen = false;
    tagListKind: TagListKind = BANKS_ACTION;
    tagListTarget?: Establishment;
    initialTags: string[] = [];
    loadingTags = false;
    savingTags = false;

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
                        { type: 'button', action: BANKS_ACTION, colorClass: 'dt-btn-secondary', icon: { class: 'material-icons', icon: 'account_balance' }, title: 'Bancos' },
                        { type: 'button', action: EXPENSE_TAGS_ACTION, colorClass: 'dt-btn-warning', icon: { class: 'material-icons', icon: 'money_off' }, title: 'Gastos' }
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

    // ── Bancos y etiquetas de gastos ─────────────────────────────────────────

    onTableAction(event: { target: string; data: any }) {
        if (event.target === BANKS_ACTION || event.target === EXPENSE_TAGS_ACTION) {
            this.openTagList(event.target, event.data);
        }
    }

    /** Textos y endpoint de la lista abierta en el modal. */
    get tagDialog(): TagListConfig {
        return TAG_LISTS[this.tagListKind];
    }

    /**
     * El listado no trae las listas —/retrieveEstablishments no se toco— asi que se piden al
     * abrir. El modal se muestra enseguida con el spinner y recibe la lista cuando llega.
     */
    private openTagList(kind: TagListKind, establishment: Establishment) {
        this.tagListKind = kind;
        this.tagListTarget = establishment;
        this.initialTags = [];
        this.savingTags = false;
        this.loadingTags = true;
        this.tagDialogOpen = true;

        this.dataService.getEstablishmentById(establishment.id!)
            .pipe(first())
            .subscribe({
                next: (response: any) => {
                    // findJsonValue y no la clave del wrapper: esa se deriva del path, asi que
                    // cambia con cada version del endpoint (hoy /getEstablishmentV4)
                    const detail = this.dataService.findJsonValue(response, 'json_result');
                    // Si mientras cargaba se cerro el modal o se abrio otro, se descarta
                    if (!this.isTagDialogFor(kind, establishment)) return;
                    this.initialTags = TAG_LISTS[kind].parse(detail?.[TAG_LISTS[kind].field]);
                    this.loadingTags = false;
                },
                error: () => {
                    if (!this.isTagDialogFor(kind, establishment)) return;
                    this.loadingTags = false;
                    this.tagDialogOpen = false;
                    this.alertService.error(TAG_LISTS[kind].loadError);
                }
            });
    }

    private isTagDialogFor(kind: TagListKind, establishment: Establishment): boolean {
        return this.tagDialogOpen && this.tagListKind === kind && this.tagListTarget?.id === establishment.id;
    }

    onTagsConfirmed(names: string[]) {
        if (!this.tagListTarget?.id) return;

        const target = this.tagListTarget;
        const config = this.tagDialog;
        const text = config.serialize(names);
        this.savingTags = true;

        config.save(this.dataService, target.id!, text)
            .pipe(first())
            .subscribe({
                next: () => {
                    // La tienda del listado queda con lo guardado; no hace falta recargar la tabla
                    // porque las listas no son una columna
                    target[config.field] = text;
                    this.savingTags = false;
                    this.tagDialogOpen = false;
                    this.alertService.success(config.saved);
                },
                error: () => {
                    this.savingTags = false;
                    this.alertService.error(config.saveError);
                }
            });
    }

    onTagsCancelled() {
        this.tagDialogOpen = false;
    }
}

