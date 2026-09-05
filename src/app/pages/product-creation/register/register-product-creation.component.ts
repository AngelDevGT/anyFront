import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { first } from 'rxjs/operators';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AccountService, AlertService, DataService, actionTypeValues } from '@app/services';
import { Measure } from '@app/models';
import { FinishedProduct } from '@app/models/product/finished-product.model';
import { QuantityPickerItem, QuantityPickerSelection } from '@app/components/element-quantity-picker/element-quantity-picker.component';

/**
 * Registrar producto terminado / abarrote en el inventario de bodega.
 *
 * Versión nueva de `AddEditProductCreationComponent`, que queda intacto y sin ruta
 * (mismo criterio aditivo que se usa para las queries: se clona, no se edita lo que
 * está en uso). Para volver atrás basta apuntar las rutas `productCreation` y
 * `abarroteCreation` al componente viejo — ver el comentario en admin-layout.routing.ts.
 *
 * Diferencias con la versión anterior:
 *   - Cantidad en línea en la tabla, en vez de un modal por producto.
 *   - Sin modo edición: para corregir se reescribe la fila. Eso elimina de raíz el
 *     bug de `isFPEditMode` (cerrar el modal con la X dejaba el índice de edición
 *     puesto y el siguiente producto sobrescribía la fila anterior).
 *   - El comentario del movimiento lo escribe el usuario; antes iba quemado.
 */
@Component({
    selector: 'page-register-product-creation',
    templateUrl: 'register-product-creation.component.html',
    styleUrls: ['register-product-creation.component.scss']
})
export class RegisterProductCreationComponent implements OnInit {

    orderForm!: FormGroup;
    loading = true;
    submitting = false;

    /** 1 = producto terminado, 2 = abarrote. Viene de `data` en la ruta. */
    productType = 1;
    title = 'Registrar Producto Terminado en Inventario';
    availableLabel = 'Producto terminado';
    selectedLabel = 'Producto terminado fabricado';
    registerLabel = 'Registrar Producto Terminado';
    inventoryRoute = '/inventory/factory/finishedProduct';

    pickerItems: QuantityPickerItem[] = [];
    selection: QuantityPickerSelection[] = [];

    constructor(private dataService: DataService, private route: ActivatedRoute,
        private alertService: AlertService, private accountService: AccountService,
        private router: Router) { }

    ngOnInit(): void {
        this.productType = this.route.snapshot.data['productType'] ?? 1;
        const isAbarrote = this.productType === 2;
        this.title = isAbarrote ? 'Registrar Abarrote en Inventario' : 'Registrar Producto Terminado en Inventario';
        this.availableLabel = isAbarrote ? 'Abarrotes' : 'Productos terminados';
        this.selectedLabel = isAbarrote ? 'Abarrotes a registrar' : 'Productos terminados a registrar';
        this.registerLabel = isAbarrote ? 'Registrar Abarrote' : 'Registrar Producto Terminado';
        this.inventoryRoute = isAbarrote ? '/inventory/factory/abarrote' : '/inventory/factory/finishedProduct';

        this.orderForm = this.createFormGroup();

        forkJoin([
            this.dataService.getAnyComponent({}, 'getMeasure'),
            this.dataService.getAllFinishedProductByFilter({ status_id: 36 })
        ]).subscribe({
            next: (result: any) => {
                const measures: Measure[] = this.dataService.findJsonValue(result[0], 'json_result') || [];
                const products: FinishedProduct[] = this.dataService.findJsonValue(result[1], 'json_result') || [];
                this.pickerItems = products
                    .filter((product: any) => (product.finishedProductTypeId ?? 1) === this.productType)
                    .map(product => ({
                        id: product.id,
                        title: product.name,
                        subtitle: product.description,
                        // Misma regla de compatibilidad que usaba el modal: las medidas
                        // cuya unidad base coincide con la del producto.
                        measures: measures.filter(measure =>
                            product.measure?.identifier?.includes(measure.unitBase?.name!)
                        )
                    }));
            },
            error: (e) => console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => this.loading = false
        });
    }

    createFormGroup() {
        return new FormGroup({
            comment: new FormControl('', [Validators.required, Validators.maxLength(254)]),
        });
    }

    get f() {
        return this.orderForm.controls;
    }

    onSelectionChange(selection: QuantityPickerSelection[]) {
        this.selection = selection;
    }

    onSaveForm() {
        this.alertService.clear();
        this.submitting = true;

        const elementsToRegister = this.selection.map(element => ({
            inventoryType: 'finished_product',
            unitName: 'bodega',
            elementId: element.id,
            measureId: element.measure?.id,
            quantity: String(element.quantity),
            creatorUserId: this.accountService.userValue.uuid,
            comment: this.orderForm.get('comment')?.value,
            actionTypeId: actionTypeValues.register_fp_by_creation.actionType.id,
        }));

        this.dataService.multiAddRemoveInventoryElement(elementsToRegister)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Producto(s) registrado(s) en inventario correctamente', { keepAfterRouteChange: true });
                    this.router.navigateByUrl(this.inventoryRoute);
                },
                error: error => {
                    let errorMessage = this.dataService.getErrorMessageResponse(error, 'Error al registrar producto(s) en inventario');
                    this.alertService.error(errorMessage);
                    this.submitting = false;
                }
            });
    }
}
