import { Component, OnInit} from '@angular/core';
import { first } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { Establishment } from '@app/models/establishment.model';

@Component({ 
    selector: 'page-establishment-provider',
    templateUrl: 'view-establishment.component.html',
    styleUrls: ['view-establishment.component.scss']
})
export class ViewEstablishmentComponent implements OnInit{

    id?: string;
    establishment?: Establishment;
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
            this.dataService.getEstablishmentById(this.id)
                .pipe(first())
                .subscribe((establ: any) =>{
                    let establishment = establ.findEstablishmentResponse?.establishment;
                    if (establishment){
                        if (establishment.length > 0){
                            this.establishment = establishment[0];
                            this.setEstablishmentElements(this.establishment!);
                            this.loading = false;
                        }
                    }
                });
        }
    }


    deleteEstablishment() {
        this.submitting = true;
        this.establishment!.status = 3;
        this.dataService.deleteEstablishment(this.establishment)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Establecimiento eliminado', { keepAfterRouteChange: true });
                this.router.navigateByUrl('/establishments');
                },
                error: error => {
                    this.alertService.error('Error al eliminar el establecimiento, contacte con Administracion');
            }});
    }

    setEstablishmentElements(establishment: Establishment){
        this.elements.push({icon : "pin_drop", name : "Direccion", value : establishment.address});
        this.elements.push({icon : "description", name : "Descripción", value : establishment.description});
        this.elements.push({icon : "info", name : "Estado", value : this.dataService.getStatusByNumber(establishment.status!)});
        this.elements.push({icon : "calendar_today", name : "Fecha Creación", value : this.dataService.getLocalDateTimeFromUTCTime(establishment.creationDate!.replaceAll("\"",""))});
        this.elements.push({icon : "calendar_today", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(establishment.updateDate!.replaceAll("\"",""))});
        this.elements.push({icon : "badge", name : "Usuario Creador", value : "Pendiente..."});
    }

}