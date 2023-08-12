import { Component, OnInit} from '@angular/core';
import { from, of } from 'rxjs';
import { concatMap, first, last } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { RawMaterialBase } from '@app/models/raw-material/raw-material-base.model';

@Component({ 
    selector: 'page-view-raw-material',
    templateUrl: 'view-raw-material.component.html',
    styleUrls: ['view-raw-material.component.scss']
})
export class ViewRawMaterialComponent implements OnInit{

    id?: string;
    rawMaterial?: RawMaterialBase;
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
            this.dataService.getRawMaterialById(this.id)
                .pipe(
                    concatMap((rawMat: any) => {
                        let rawMaterial = rawMat.GetRawMaterialResponse.rawMaterial;
                        if (rawMaterial){
                            this.rawMaterial = rawMaterial;
                            this.setRawMaterialElements(rawMaterial);
                            if(rawMaterial.photo){
                                return this.dataService.getImageById(rawMaterial.photo);
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

    setRawMaterialElements(rawMaterial: RawMaterialBase){
        this.elements.push({icon : "scale", name : "Medida", value : rawMaterial.measure});
        this.elements.push({icon : "info", name : "Estado", value : rawMaterial.status?.identifier});
        this.elements.push({icon : "feed", name : "Descripción", value : rawMaterial.description});
        this.elements.push({icon : "today", name : "Fecha Creación", value : this.dataService.getLocalDateTimeFromUTCTime(rawMaterial.creationDate!)});
        this.elements.push({icon : "edit_calendar", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(rawMaterial.updateDate!)});
        this.elements.push({icon : "badge", name : "Usuario Creador", value : "Pendiente..."});
    }

}