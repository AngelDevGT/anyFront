import { Component, OnInit} from '@angular/core';
import { first } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { Provider } from '@app/models/provider.model';

@Component({ 
    selector: 'page-view-provider',
    templateUrl: 'view-provider.component.html',
    styleUrls: ['view-provider.component.scss']
})
export class ViewProviderComponent implements OnInit{

    id?: string;
    provider?: Provider;
    submitting = false;
    loading = false;
    elements: any = [];

    constructor(private dataService: DataService, private alertService: AlertService,
        private route: ActivatedRoute, private router: Router) {
    }

    ngOnInit(): void {
        this.id = this.route.snapshot.params['id'];

        this.loading = true;

        if (this.id){
            this.dataService.getProviderById(this.id)
                .pipe(first())
                .subscribe((prov: any) => {
                    let provider = prov.getProviderResponse?.provider;
                    if (provider){
                        if (provider){
                            this.provider = provider;
                            this.setProviderElements(provider);
                            this.loading = false;
                        }
                    }
                });
        }
    }


    deleteProvider() {
        this.submitting = true;
        this.provider!.status = 2;
        this.dataService.deleteProvider(this.provider)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Proveedor eliminado', { keepAfterRouteChange: true });
                this.router.navigateByUrl('/providers');
                },
                error: error => {
                    this.alertService.error('Error al eliminar el proveedor, contacte con Administracion');
                }});
    }

    setProviderElements(provider: Provider){
        this.elements.push({icon : "store", name : "Empresa", value : provider.company});
        this.elements.push({icon : "mail", name : "Correo Electronico", value : provider.email});
        this.elements.push({icon : "call", name : "Numero de teléfono", value : provider.phoneNumber});
        this.elements.push({icon : "feed", name : "Descripción", value : provider.description});
        this.elements.push({icon : "info", name : "Estado", value : this.dataService.getStatusByNumber(provider.status ? provider.status : -1)});
        this.elements.push({icon : "calendar_today", name : "Fecha Creación", value : this.dataService.getLocalDateTimeFromUTCTime(provider.creationDate!.replaceAll("\"",""))});
        this.elements.push({icon : "calendar_today", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(provider.updateDate!.replaceAll("\"",""))});
        this.elements.push({icon : "badge", name : "Usuario Creador", value : "Pendiente..."});
    }

}