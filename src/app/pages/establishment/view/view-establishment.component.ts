import { Component, OnInit} from '@angular/core';
import { first } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { Establishment } from '@app/models/establishment.model';
import pdfMake from "pdfmake/build/pdfmake";  
import pdfFonts from "pdfmake/build/vfs_fonts";  
import { TDocumentDefinitions } from 'pdfmake/interfaces';
pdfMake.vfs = pdfFonts.pdfMake.vfs;

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
                    let establishment = establ.getEstablishmentResponse.establishment;
                    if (establishment){
                        this.establishment = establishment;
                        this.setEstablishmentElements(this.establishment!);
                        this.loading = false;
                    }
                });
        }
    }


    deleteEstablishment() {
        this.submitting = true;
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
      console.log(establishment)
        this.elements.push({icon : "pin_drop", name : "Direccion", value : establishment.address});
        this.elements.push({icon : "description", name : "Descripción", value : establishment.description});
        this.elements.push({icon : "info", name : "Estado", value : establishment.status?.identifier});
        this.elements.push({icon : "calendar_today", name : "Fecha Creación", value : this.dataService.getLocalDateTimeFromUTCTime(establishment.creationDate!.replaceAll("\"",""))});
        this.elements.push({icon : "calendar_today", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(establishment.updateDate!.replaceAll("\"",""))});
        this.elements.push({icon : "badge", name : "Usuario Creador", value : establishment.creatorUser?.name ? establishment.creatorUser.name : 'N/A'});
    }

    generatePDF() {  
        let docDefinition:TDocumentDefinitions = {
            header: 'C#Corner PDF Header',
            content: [
                {  
                    columns: [ 
                        [
                            {
                                qr: 'sdflkasdf', fit: 50
                            }
                        ]
                    ]  
                },  
              {
                text: 'Información del Establecimiento',
                style: 'header',
              },
              {
                text: `Nombre: ${this.establishment?.name || 'N/A'}`,
                margin: [0, 10],
              },
              {
                text: `Dirección: ${this.establishment?.address || 'N/A'}`,
                margin: [0, 5],
              },
              {
                text: `Descripción: ${this.establishment?.description || 'N/A'}`,
                margin: [0, 5],
              },
              {
                text: `Fecha de Creación: ${this.establishment?.creationDate || 'N/A'}`,
                margin: [0, 5],
              },
              {
                text: `Fecha de Actualización: ${this.establishment?.updateDate || 'N/A'}`,
                margin: [0, 5],
              },
              {
                text: `Creador del Usuario: ${this.establishment?.creatorUser || 'N/A'}`,
                margin: [0, 5],
              },
              {
                text: `Estado: ${this.establishment?.status || 'N/A'}`,
                margin: [0, 10],
              }
            ],
            styles: {
              header: {
                fontSize: 18,
                bold: true,
                margin: [0, 0, 0, 10],
              },
            },
          };
        // let docDefinition = {  
        //     header: 'C#Corner PDF Header',  
        //     content: 'Sample PDF generated with Angular and PDFMake for C#Corner Blog'  
        // };  
        
        pdfMake.createPdf(docDefinition).open();  
    }  

}