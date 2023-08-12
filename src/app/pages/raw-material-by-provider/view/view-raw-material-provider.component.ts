import { Component, OnInit} from '@angular/core';
import { from, of } from 'rxjs';
import { concatMap, first, last } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { RawMaterialBase } from '@app/models/raw-material/raw-material-base.model';
import { RawMaterialByProvider } from '@app/models/raw-material/raw-material-by-provider.model';

@Component({ 
    selector: 'page-view-raw-material-provider',
    templateUrl: 'view-raw-material-provider.component.html',
    styleUrls: ['view-raw-material-provider.component.scss']
})
export class ViewRawMaterialByProviderComponent implements OnInit{

    id?: string;
    rawMaterial?: RawMaterialByProvider;
    submitting = false;
    loading = false;
    elements: any = [];
    cardPhoto = undefined;

    constructor(private dataService: DataService, private alertService: AlertService,
        private route: ActivatedRoute, private router: Router) {
    }

    ngOnInit(): void {
        this.id = this.route.snapshot.params['id'];

        this.loading = true;

        if (this.id){
            this.dataService.getRawMaterialByProviderById(this.id)
                .pipe(
                    concatMap((rawMat: any) => {
                        let rawMaterial = rawMat.GetRawMaterialByProviderResponse.rawMaterialBase;
                        if (rawMaterial){
                            this.rawMaterial = rawMaterial;
                            this.setRawMaterialElements(rawMaterial);
                            if(rawMaterial.rawMaterialBase.photo){
                                return this.dataService.getImageById(rawMaterial.rawMaterialBase.photo);
                            }
                        }
                        this.loading = false;
                        return of(null);
                    })
                )
                .subscribe((img: any) => {
                    if(img){
                        this.cardPhoto = img.getImageResponse.image.image;
                    }
                    this.loading = false;
                });
        }
    }


    deleteRawMaterial() {
        this.submitting = true;
        this.dataService.deleteRawMaterial(this.rawMaterial)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Materia Prima eliminada', { keepAfterRouteChange: true });
                this.router.navigateByUrl('/rawMaterials');
                },
                error: error => {
                    this.alertService.error('Error al eliminar la materia prima, contacte con Administracion');
                }});
    }

    setRawMaterialElements(rawMaterial: RawMaterialByProvider){
        this.elements.push({icon : "person", name : "Proveedor", value : rawMaterial.provider?.name + " ( " + rawMaterial.provider?.email + " ) " });
        this.elements.push({icon : "monetization_on", name : "Precio", value : rawMaterial.price});
        this.elements.push({icon : "scale", name : "Medida", value : rawMaterial.rawMaterialBase?.measure});
        this.elements.push({icon : "feed", name : "Descripción", value : rawMaterial.rawMaterialBase?.description});
        this.elements.push({icon : "info", name : "Estado", value : rawMaterial.status?.identifier});
        this.elements.push({icon : "today", name : "Fecha Creación", value : this.dataService.getLocalDateTimeFromUTCTime(rawMaterial.creationDate!)});
        this.elements.push({icon : "edit_calendar", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(rawMaterial.updateDate!)});
        this.elements.push({icon : "badge", name : "Usuario Creador", value : "Pendiente..."});
    }

}