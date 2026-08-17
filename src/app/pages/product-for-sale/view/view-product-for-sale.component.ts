import { Component, OnInit} from '@angular/core';
import { from, of } from 'rxjs';
import { concatMap, first, last } from 'rxjs/operators';

import { AccountService, AlertService, CAPABILITIES, DataService } from '@app/services';
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
    storeID = '';

    constructor(private dataService: DataService, private alertService: AlertService,
        private route: ActivatedRoute, private router: Router, private accountService: AccountService) {
    }

    /** Ver el costo. Define ademas que endpoint se pide: solo uno de los dos trae el costo. */
    get canReadCost(): boolean {
        return this.accountService.can(CAPABILITIES.costRead);
    }

    /** El boton EDITAR COSTO. Sin canReadCost la pantalla de edicion no muestra el valor actual. */
    get canWriteCost(): boolean {
        return this.canReadCost && this.accountService.can(CAPABILITIES.costWrite);
    }

    ngOnInit(): void {
        this.id = this.route.snapshot.params['id'];
        this.route.queryParams.subscribe(params => {
            this.storeID = params['store'];
        });

        this.loading = true;

        if (this.id){
            const request = this.canReadCost
                ? this.dataService.getProductForSaleByIdWithCost(this.id)
                : this.dataService.getProductForSaleById(this.id);
            request
            .pipe(first())
            .subscribe({
                next: (prod: any) => {
                        let productForSale = this.dataService.findJsonValue(prod, 'json_result') || {};
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
                this.router.navigate(['/productsForSale'], { 
                    queryParams: { store: this.storeID } 
                });
                },
                error: error => {
                    this.alertService.error('Error al eliminar el producto para venta, contacte con Administracion');
                }});
    }

    setProductForSaleElements(product: ProductForSale){
        this.elements.push({icon : "person", name : "Establecimiento", value : product.establishment?.name });
        this.elements.push({icon : "monetization_on", name : "Precio", value : this.dataService.getFormatedPrice(Number(product.price))});
        if (this.canReadCost && product.cost != null){
            this.elements.push({icon : "payments", name : "Costo", value : this.dataService.getFormatedPrice(Number(product.cost))});
        }

        this.elements.push({icon : "scale", name : "Medida", value : product.finishedProduct?.measure?.identifier});
        this.elements.push({icon : "feed", name : "Descripción", value : product.finishedProduct?.description});
        this.elements.push({icon : "info", name : "Estado", value : product.status?.identifier});
        this.elements.push({icon : "today", name : "Fecha Creación", value : this.dataService.getLocalDateTimeFromUTCTime(product.creationDate!)});
        this.elements.push({icon : "edit_calendar", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(product.updatedDate!)});
        this.elements.push({icon : "badge", name : "Usuario Creador", value : product.creatorUser?.name ? product.creatorUser.name : 'N/A'});
    }

}