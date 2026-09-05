import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { customerStatusValues } from '@app/services/data/data.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Customer } from '@app/models/system/customer.model';

@Component({
    selector: 'page-view-customer',
    templateUrl: 'view-customer.component.html',
    styleUrls: ['view-customer.component.scss']
})
export class ViewCustomerComponent implements OnInit {

    id?: string;
    customer?: Customer;
    elements: any = [];
    loading = false;
    submitting = false;
    isDeleted = false;

    constructor(
        private dataService: DataService,
        private alertService: AlertService,
        private route: ActivatedRoute,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.id = this.route.snapshot.params['id'];
        this.loading = true;

        if (this.id) {
            this.dataService.getCustomerById(this.id)
                .pipe(first())
                .subscribe({
                    next: (result: any) => {
                        const customer = this.dataService.findJsonValue(result, 'json_result');
                        if (customer) {
                            this.customer = customer;
                            this.isDeleted = customer.status?.id === customerStatusValues.eliminado.status.id;
                            this.setCustomerElements(customer);
                        }
                        this.loading = false;
                    },
                    error: error => {
                        this.loading = false;
                        this.alertService.error(this.dataService.getErrorMessageResponse(error, 'Error al cargar el cliente'));
                    }
                });
        }
    }

    setCustomerElements(customer: Customer) {
        this.elements.push({ icon: 'person', name: 'Nombre', value: customer.name });
        this.elements.push({ icon: 'call', name: 'Numero de teléfono', value: customer.phone || '--' });
        this.elements.push({ icon: 'mail', name: 'Correo Electronico', value: customer.email || '--' });
        this.elements.push({ icon: 'tag', name: 'NIT', value: customer.nit || 'C/F' });
        this.elements.push({ icon: 'groups', name: 'Operador', value: customer.isOperator ? 'Si' : 'No' });
        this.elements.push({ icon: 'info', name: 'Estado', value: customer.status?.identifier });
        this.elements.push({ icon: 'calendar_today', name: 'Fecha Creación', value: this.dataService.getLocalDateTimeFromUTCTime(customer.creationDate?.replaceAll('"', '') || '') });
        this.elements.push({ icon: 'calendar_today', name: 'Fecha Actualización', value: customer.updatedDate ? this.dataService.getLocalDateTimeFromUTCTime(customer.updatedDate.replaceAll('"', '')) : '--' });
        this.elements.push({ icon: 'badge', name: 'Usuario Creador', value: customer.creatorUser?.name ? customer.creatorUser.name : 'N/A' });
    }

    editCustomer() {
        this.router.navigateByUrl('/customers/edit/' + this.id);
    }

    deleteCustomer() {
        if (!this.id) return;
        this.submitting = true;
        this.dataService.deleteCustomer(this.id)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Cliente eliminado', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/customers');
                },
                error: error => {
                    this.submitting = false;
                    this.alertService.error(this.dataService.getErrorMessageResponse(error, 'Error al eliminar el cliente, consulte con el administrador'));
                }
            });
    }
}
