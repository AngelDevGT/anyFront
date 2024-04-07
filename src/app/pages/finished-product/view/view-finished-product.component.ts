import { Component, OnInit} from '@angular/core';
import { from, of } from 'rxjs';
import { concatMap, first, last } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { RawMaterialBase } from '@app/models/raw-material/raw-material-base.model';
import { FinishedProduct } from '@app/models/product/finished-product.model';

@Component({ 
    selector: 'page-view-finished-product',
    templateUrl: 'view-finished-product.component.html',
    styleUrls: ['view-finished-product.component.scss']
})
export class ViewFinishedProductComponent implements OnInit{

    id?: string;
    product?: FinishedProduct;
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
            this.dataService.getFinishedProductById(this.id)
            .pipe(first())
            .subscribe({
                next: (prod: any) => {
                        let product = prod.getFinishedProductResponse.FinishedProduct;
                        if (product){
                            this.product = product;
                            this.setProductElements(product);
                        }
                        this.loading = false;
                    }
                });
        }
    }


    deleteProduct() {
        this.submitting = true;
        this.dataService.deleteFinishedProduct(this.product)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Producto Terminado eliminado', { keepAfterRouteChange: true });
                this.router.navigateByUrl('/finishedProducts');
                },
                error: error => {
                    this.alertService.error('Error al eliminar el producto, contacte con Administracion');
                }});
    }

    setProductElements(product: FinishedProduct){
        this.elements.push({icon : "scale", name : "Medida", value : product.measure?.identifier});
        this.elements.push({icon : "feed", name : "Descripción", value : product.description});
        this.elements.push({icon : "info", name : "Estado", value : product.status?.identifier});
        this.elements.push({icon : "today", name : "Fecha Creación", value : this.dataService.getLocalDateTimeFromUTCTime(product.creationDate!)});
        this.elements.push({icon : "edit_calendar", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(product.updateDate!)});
        this.elements.push({icon : "badge", name : "Usuario Creador", value : product.creatorUser?.name ? product.creatorUser.name : 'N/A'});
    }

}