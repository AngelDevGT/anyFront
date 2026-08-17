import { Component, OnInit } from '@angular/core';
import { first } from 'rxjs/operators';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AccountService, AlertService, CAPABILITIES, DataService } from '@app/services';
import { ProductForSale } from '@app/models/product/producto-for-sale.model';

/**
 * Edición del COSTO de un producto para venta. Vista exclusiva del rol Sistema.
 *
 * Solo toca `cost`: el precio de venta se muestra como referencia, en solo lectura,
 * y se edita desde la pantalla de "Editar" del producto.
 */
@Component({
    selector: 'page-edit-cost-product-for-sale',
    templateUrl: 'edit-cost-product-for-sale.component.html',
    styleUrls: ['edit-cost-product-for-sale.component.scss']
})
export class EditCostProductForSaleComponent implements OnInit {

    id?: string;
    storeID = '';
    productForSale?: ProductForSale;
    costForm!: FormGroup;
    loading = false;
    submitting = false;

    listMaxLength = {
        cost: 10
    };

    constructor(private dataService: DataService, private alertService: AlertService,
        private route: ActivatedRoute, private router: Router, private accountService: AccountService) {
    }

    ngOnInit(): void {
        // El guard de rutas solo valida la ruta, no la capacidad: aquí se corta el acceso
        // de quien no pueda editar costos. Se pide tambien costRead porque la pantalla
        // muestra el valor actual antes de cambiarlo.
        if (!this.accountService.can(CAPABILITIES.costRead) || !this.accountService.can(CAPABILITIES.costWrite)){
            this.router.navigate(['/productsForSale']);
            return;
        }

        this.id = this.route.snapshot.params['id'];
        this.route.queryParams.subscribe(params => {
            this.storeID = params['store'];
        });

        this.costForm = this.createFormGroup();

        if (this.id){
            this.loading = true;
            this.dataService.getProductForSaleByIdWithCost(this.id)
                .pipe(first())
                .subscribe({
                    next: (prod: any) => {
                        this.productForSale = this.dataService.findJsonValue(prod, 'json_result') || {};
                        this.costValue?.patchValue(this.productForSale?.cost);
                        this.loading = false;
                    },
                    error: () => {
                        this.alertService.error('Error al obtener el producto para venta, contacte con Administracion');
                        this.loading = false;
                    }
                });
        }
    }

    get f() {
        return this.costForm.controls;
    }

    get costValue() {
        return this.costForm.get('cost');
    }

    get formatedPrice() {
        return this.productForSale?.price != null
            ? this.dataService.getFormatedPrice(Number(this.productForSale.price))
            : '';
    }

    createFormGroup() {
        return new FormGroup({
            cost: new FormControl('', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)])
        });
    }

    onSaveForm() {
        this.alertService.clear();
        this.submitting = true;
        this.dataService.updateProductForSaleCost(this.id!, this.costValue?.value)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Costo actualizado', { keepAfterRouteChange: true });
                    this.router.navigate(['/productsForSale'], {
                        queryParams: { store: this.storeID }
                    });
                },
                error: () => {
                    this.alertService.error('Error al actualizar el costo, contacte con Administracion');
                    this.submitting = false;
                }
            });
    }

    onCancel() {
        this.router.navigate(['/productsForSale'], {
            queryParams: { store: this.storeID }
        });
    }

}
