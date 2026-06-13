import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';

import { AlertService, DataService, rawMaterialOrderStatusValues} from '@app/services';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import { ActivatedRoute } from '@angular/router';

@Component({
    templateUrl: 'list-raw-material-order.component.html',
    styleUrls: ['list-raw-material-order.component.scss']
})
export class ListRawMaterialOrderComponent implements OnInit {
    rawMaterialOrders?: RawMaterialOrder[];
    allRawMaterialOrders?: RawMaterialOrder[];
    searchTerm?: string;
    sortOpts = ['Desc', 'Asc'];
    selectedSortOpt = this.sortOpts[0];
    pageSize = this.dataService.defaultPageSize;
    tableElementsValues?: any;
    materialType = 1;
    basePath = '/rawMaterialByProvider/order';
    pageTitle = 'Pedidos de Materia Prima';
    availableStatuses: string[] = [];
    statusFilter: string | null = null;

    constructor(private readonly dataService: DataService, private readonly alertService: AlertService,
        private readonly route: ActivatedRoute) {}

    ngOnInit() {
        this.materialType = this.route.snapshot.data['materialType'] ?? 1;
        this.basePath = this.materialType === 2 ? '/empaques/order' : '/rawMaterialByProvider/order';
        this.pageTitle = this.materialType === 2 ? 'Pedidos de Material de Empaque' : 'Pedidos de Materia Prima';
        this.retriveRawMaterialOrders();
    }

    sortDataByDate(sortOpt: string) {
        this.selectedSortOpt = sortOpt;
        this.rawMaterialOrders = this.rawMaterialOrders?.sort((a, b) => {
            const fechaA = new Date(a.updatedDate!).getTime();
            const fechaB = new Date(b.updatedDate!).getTime();
            return sortOpt === 'Desc' ? fechaB - fechaA : fechaA - fechaB;
        });
        this.setTableElements(this.rawMaterialOrders);
    }

    retriveRawMaterialOrders() {
        this.rawMaterialOrders = undefined;
        this.dataService.getAllRawMaterialOrderByFilter({raw_material_by_provider_type_id: this.materialType})
            .pipe(first())
            .subscribe({
                next: (rmOrders: any) => {
                    this.rawMaterialOrders = (this.dataService.findJsonValue(rmOrders, 'json_result') || [])
                        .filter((rmOrder: RawMaterialOrder) =>
                            rmOrder.status?.id !== rawMaterialOrderStatusValues.eliminado.status.id
                        );
                    this.allRawMaterialOrders = this.rawMaterialOrders;
                    this.availableStatuses = [...new Set(
                        (this.allRawMaterialOrders || []).map(e => e.status?.identifier).filter((s): s is string => !!s)
                    )];
                    this.sortDataByDate(this.sortOpts[0]);
                }
            });
    }

    filterByStatus(status: string | null) {
        this.statusFilter = status;
        this.search(null);
    }

    search(value: any): void {
        if (this.allRawMaterialOrders) {
            this.rawMaterialOrders = this.allRawMaterialOrders.filter((val) => {
                const textMatch = !this.searchTerm ||
                    val.name?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                    val.comment?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                    val.provider?.name?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                    val.paymentType?.identifier?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                    val.paymentStatus?.identifier?.toLowerCase().includes(this.searchTerm.toLowerCase());
                const statusMatch = !this.statusFilter || val.status?.identifier === this.statusFilter;
                return textMatch && statusMatch;
            });
        }
        this.sortDataByDate(this.selectedSortOpt);
    }

    setTableElements(elements?: RawMaterialOrder[]) {
        this.tableElementsValues = [];
        elements?.forEach((element: RawMaterialOrder) => {
            const curr_row = [
                { type: 'text', value: this.dataService.getLocalDateTimeFromUTCTime(element.updatedDate!), header_name: 'Fecha' },
                { type: 'text', value: element.name, header_name: 'Nombre' },
                { type: 'text', value: element.provider?.name, header_name: 'Proveedor' },
                {
                    type: 'badge',
                    value: (element.status?.text || element.status?.identifier) ?? '--',
                    identifier: element.status?.identifier?.toLowerCase(),
                    bg_color: element.status?.bg_color,
                    color: element.status?.color,
                    header_name: 'Estado del pedido'
                },
                { type: 'text', value: element.paymentType?.identifier, header_name: 'Tipo de pago' },
                {
                    type: 'badge',
                    value: (element.paymentStatus?.text || element.paymentStatus?.identifier) ?? '--',
                    identifier: element.paymentStatus?.identifier?.toLowerCase(),
                    bg_color: element.paymentStatus?.bg_color,
                    color: element.paymentStatus?.color,
                    header_name: 'Estado de pago'
                },
                { type: 'text', value: this.dataService.getFormatedPrice(Number(element.finalAmount)), header_name: 'Monto total' },
                { type: 'text', value: this.dataService.getFormatedPrice(Number(element.pendingAmount)), header_name: 'Monto pendiente' },
                {
                    type: 'button',
                    header_name: 'Acciones',
                    button: [
                        {
                            type: 'button',
                            routerLink: 'view/' + element.id,
                            colorClass: 'dt-btn-view',
                            icon: { class: 'material-icons', icon: 'visibility' }
                        }
                    ]
                }
            ];
            this.tableElementsValues.push(curr_row);
        });
    }
}
