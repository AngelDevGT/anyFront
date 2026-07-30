import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { forkJoin } from 'rxjs';
import { first } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';

import { AlertService, DataService } from '@app/services';
import { customerStatusValues } from '@app/services/data/data.service';
import { Customer } from '@app/models/system/customer.model';
import { EstablishmentCustomer } from '@app/models/system/establishment-customer.model';
import { Establishment } from '@app/models/establishment.model';

@Component({
    templateUrl: 'assign-establishment-customer.component.html',
    styleUrls: ['assign-establishment-customer.component.scss']
})
export class AssignEstablishmentCustomerComponent implements OnInit {

    establishmentId!: string;
    establishment?: Establishment;
    assignedCustomers?: EstablishmentCustomer[];
    allCustomers: Customer[] = [];
    searchTerm?: string;
    modalSearchTerm = '';
    pageSize = this.dataService.defaultPageSize;
    tableElementsValues?: any;
    selectedAssignment?: EstablishmentCustomer;
    submitting = false;

    @ViewChild('assignCloseBtn') assignCloseBtnRef?: ElementRef;
    @ViewChild('removeCloseBtn') removeCloseBtnRef?: ElementRef;

    constructor(
        private dataService: DataService,
        private alertService: AlertService,
        private route: ActivatedRoute
    ) {}

    ngOnInit() {
        this.establishmentId = this.route.snapshot.params['id'];

        forkJoin([
            this.dataService.getEstablishmentById(this.establishmentId),
            this.dataService.getAllCustomersByFilter({ status_id: customerStatusValues.activo.status.id })
        ]).subscribe({
            next: (result: any) => {
                this.establishment = this.dataService.findJsonValue(result[0], 'json_result') || {};
                this.allCustomers = this.dataService.findJsonValue(result[1], 'json_result') || [];
            },
            error: (e) => console.error('Error al cargar los datos de la tienda', e),
            complete: () => this.retrieveAssignedCustomers()
        });
    }

    retrieveAssignedCustomers() {
        this.assignedCustomers = undefined;
        this.dataService.getEstablishmentCustomers(this.establishmentId)
            .pipe(first())
            .subscribe({
                next: (result: any) => {
                    this.assignedCustomers = this.dataService.findJsonValue(result, 'json_result') || [];
                    this.setTableElements(this.filterAssigned());
                },
                error: error => {
                    this.assignedCustomers = [];
                    this.setTableElements([]);
                    this.alertService.error(this.dataService.getErrorMessageResponse(error, 'Error al cargar los clientes de la tienda'));
                }
            });
    }

    /** Clientes activos que todavía no están asignados a esta tienda. */
    get unassignedCustomers(): Customer[] {
        const assignedIds = new Set((this.assignedCustomers ?? []).map(customer => customer.id));
        const available = this.allCustomers.filter(customer => !assignedIds.has(customer.id));
        const term = this.modalSearchTerm?.trim().toLowerCase();
        if (!term) return available;
        return available.filter(customer =>
            customer.name?.toLowerCase().includes(term) ||
            customer.nit?.toLowerCase().includes(term) ||
            customer.phone?.toLowerCase().includes(term)
        );
    }

    private filterAssigned(): EstablishmentCustomer[] {
        const term = this.searchTerm?.trim().toLowerCase();
        if (!term) return this.assignedCustomers ?? [];
        return (this.assignedCustomers ?? []).filter(customer =>
            customer.name?.toLowerCase().includes(term) ||
            customer.nit?.toLowerCase().includes(term) ||
            customer.phone?.toLowerCase().includes(term)
        );
    }

    search(): void {
        this.setTableElements(this.filterAssigned());
    }

    openAssignModal() {
        this.modalSearchTerm = '';
    }

    assignCustomer(customer: Customer) {
        if (!customer.id || this.submitting) return;
        this.submitting = true;
        this.dataService.addEstablishmentCustomer(this.establishmentId, customer.id)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.assignCloseBtnRef?.nativeElement?.click();
                    this.alertService.success('Cliente asignado a la tienda');
                    this.submitting = false;
                    this.retrieveAssignedCustomers();
                },
                error: error => {
                    this.submitting = false;
                    this.alertService.error(this.dataService.getErrorMessageResponse(error, 'Error al asignar el cliente'));
                }
            });
    }

    receiveData(data: EstablishmentCustomer) {
        this.selectedAssignment = data;
    }

    removeAssignment() {
        if (!this.selectedAssignment?.assignmentId || this.submitting) return;
        this.submitting = true;
        this.dataService.deleteEstablishmentCustomer(this.selectedAssignment.assignmentId)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.removeCloseBtnRef?.nativeElement?.click();
                    this.alertService.success('Asignación eliminada');
                    this.submitting = false;
                    this.selectedAssignment = undefined;
                    this.retrieveAssignedCustomers();
                },
                error: error => {
                    this.submitting = false;
                    this.alertService.error(this.dataService.getErrorMessageResponse(error, 'Error al quitar la asignación'));
                }
            });
    }

    setTableElements(elements: EstablishmentCustomer[]) {
        this.tableElementsValues = [];
        elements?.forEach((customer: EstablishmentCustomer) => {
            const curr_row = [
                { type: 'text', value: customer.name, header_name: 'Nombre' },
                { type: 'text', value: customer.nit || 'C/F', header_name: 'NIT' },
                { type: 'text', value: customer.phone || '--', header_name: 'Telefono' },
                {
                    type: 'text',
                    value: customer.assignmentDate
                        ? this.dataService.getLocalDateFromUTCTime(customer.assignmentDate.replaceAll('"', ''))
                        : '--',
                    header_name: 'Fecha de asignacion'
                },
                { type: 'text', value: customer.assignedBy?.name || 'N/A', header_name: 'Asignado por' },
                {
                    type: 'modal_button',
                    header_name: 'Acciones',
                    data: customer,
                    button: [
                        {
                            type: 'button',
                            data_bs_target: '#removeAssignmentModal',
                            colorClass: 'dt-btn-delete',
                            icon: { class: 'material-icons', icon: 'person_remove' },
                            title: 'Quitar'
                        }
                    ]
                }
            ];
            this.tableElementsValues.push(curr_row);
        });
    }
}
