import { Component, OnInit} from '@angular/core';
import { from, of } from 'rxjs';
import { concatMap, first, last } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductForSale } from '@app/models/producto-for-sale.model';

@Component({ 
    selector: 'page-view-product',
    templateUrl: 'view-product.component.html',
    styleUrls: ['view-product.component.scss']
})
export class ViewProductComponent implements OnInit{

    id?: string;
    product?: ProductForSale;
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
            this.dataService.getProductById(this.id).pipe(
                concatMap((prod: any) => {
                  let product = prod.getProductResponse?.product;
                  if (product) {
                    console.log(product)
                    this.product = product;
                    this.setProductElements(product);
                    return this.dataService.getEstablishmentById(product.establishment).pipe(
                        concatMap((establ: any) => {
                            console.log(establ)
                            let establishment_name = "No encontrado"
                            if(establ){
                                let establishment = establ.findEstablishmentResponse?.establishment;
                                if (establishment){
                                    if ( establishment.length > 0){
                                        establishment_name = this.dataService.getShortEstablishmentInfo(establishment[0]);
                                    }
                                }
                            }
                            this.elements.unshift({icon : "storefront", name : "Establecimiento", value : establishment_name});
                            if (product.photo){
                                return this.dataService.getImageById(product.photo).pipe(
                                    concatMap((img: any) => {
                                        console.log(img);
                                        this.cardPhoto = img.getImageResponse.image.image;
                                        this.loading = false;
                                        return of(null);
                                    }));
                            }
                            this.loading = false;
                            return of(null);
                        })
                        )
                  }
                  return of(null);
                }),
              ).subscribe(
                msg => console.log(msg)
              );
        }
    }


    deleteProduct() {
        this.submitting = true;
        this.product!.status = 2;
        this.dataService.deleteProduct(this.product)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Producto eliminado', { keepAfterRouteChange: true });
                this.router.navigateByUrl('/products');
                },
                error: error => {
                    this.alertService.error('Error al eliminar el proveedor, contacte con Administracion');
                }});
    }

    setProductElements(product: ProductForSale){
        this.elements.push({icon : "scale", name : "Medida", value : this.dataService.getMeasureByName(product.measure!)});
        this.elements.push({icon : "monetization_on", name : "Precio", value : this.dataService.getFormatedPrice(product.price!)});
        if (product.pricePerDozen){
            this.elements.push({icon : "payments", name : "Precio docena", value : this.dataService.getFormatedPrice(product.pricePerDozen)});
        }
        this.elements.push({icon : "info", name : "Estado", value : this.dataService.getStatusByNumber(product.status ? product.status : -1)});
        this.elements.push({icon : "event_available", name : "Fecha de aplicación", value : this.dataService.getLocalDateFromUTCTime(product.applyDate!)});
        this.elements.push({icon : "today", name : "Fecha Creación", value : this.dataService.getLocalDateTimeFromUTCTime(product.creationDate!)});
        this.elements.push({icon : "edit_calendar", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(product.updateDate!)});
        this.elements.push({icon : "badge", name : "Usuario Creador", value : "Pendiente..."});
    }

}