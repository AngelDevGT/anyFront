import { Component, OnInit} from '@angular/core';
import { from, of } from 'rxjs';
import { concatMap, first, last } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { RawMaterialBase } from '@app/models/raw-material/raw-material-base.model';
import { RawMaterialByProvider } from '@app/models/raw-material/raw-material-by-provider.model';
import { ProductForSale } from '@app/models/product/producto-for-sale.model';

@Component({ 
    selector: 'page-view-product-for-sale',
    templateUrl: 'view-product-for-sale.component.html',
    styleUrls: ['view-product-for-sale.component.scss']
})
export class ViewProductForSaleComponent implements OnInit{

    id?: string;
    productForSale?: ProductForSale;
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
            this.dataService.getProductForSaleById(this.id)
            .pipe(first())
            .subscribe({
                next: (prod: any) => {
                        let productForSale = prod.getProductForSaleResponse.productForSale;
                        if (prod){
                            this.productForSale = productForSale;
                            this.setProductForSaleElements(productForSale);
                        }
                        this.loading = false;
                    }
                });
        }
    }


    deleteProductForSale() {
        this.submitting = true;
        this.dataService.deleteProductForSale(this.productForSale)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Producto para venta eliminado', { keepAfterRouteChange: true });
                this.router.navigateByUrl('/productsForSale');
                },
                error: error => {
                    this.alertService.error('Error al eliminar el producto para venta, contacte con Administracion');
                }});
    }

    setProductForSaleElements(product: ProductForSale){
        this.elements.push({icon : "person", name : "Establecimiento", value : product.establishment?.name });
        this.elements.push({icon : "monetization_on", name : "Precio", value : this.dataService.getFormatedPrice(Number(product.price))});
        
        this.elements.push({icon : "scale", name : "Medida", value : product.finishedProduct?.measure?.identifier});
        this.elements.push({icon : "feed", name : "Descripción", value : product.finishedProduct?.description});
        this.elements.push({icon : "info", name : "Estado", value : product.status?.identifier});
        this.elements.push({icon : "today", name : "Fecha Creación", value : this.dataService.getLocalDateTimeFromUTCTime(product.creationDate!)});
        this.elements.push({icon : "edit_calendar", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(product.updateDate!)});
        this.elements.push({icon : "badge", name : "Usuario Creador", value : product.creatorUser?.name ? product.creatorUser.name : 'N/A'});
    }

}