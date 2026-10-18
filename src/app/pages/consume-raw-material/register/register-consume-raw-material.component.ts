import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { first } from 'rxjs/operators';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AccountService, AlertService, DataService, actionTypeValues } from '@app/services';
import { Measure } from '@app/models';
import { Inventory } from '@app/models/inventory/inventory.model';
import { InventoryElement } from '@app/models/inventory/inventory-element.model';
import { QuantityPickerItem, QuantityPickerSelection } from '@app/components/element-quantity-picker/element-quantity-picker.component';

/**
 * Consumir materia prima / material de empaque del inventario de bodega.
 *
 * Versión nueva de `ConsumeRawMaterialComponent`, que queda intacto y sin ruta (mismo criterio que
 * `RegisterProductCreationComponent`: se clona, no se edita lo que está en uso). Para volver atrás
 * basta apuntar las rutas `consumeRawMaterial` y `consumePackagingMaterial` al componente viejo —
 * ver el comentario en admin-layout.routing.ts.
 *
 * Diferencias con la versión anterior:
 *   - Medida y cantidad en línea en la tabla, en vez de un modal por material.
 *   - Sin modo edición: para corregir se reescribe la fila.
 *   - La cantidad no puede pasar de la existencia: la fila se marca en rojo con el máximo
 *     disponible y no deja consumir hasta corregirla. Antes el modal la reiniciaba a 0.
 *
 * Una sola pantalla para las dos rutas: `data.materialType` distingue materia prima (1) de
 * material de empaque (2).
 */
@Component({
    selector: 'page-register-consume-raw-material',
    templateUrl: 'register-consume-raw-material.component.html',
    styleUrls: ['register-consume-raw-material.component.scss']
})
export class RegisterConsumeRawMaterialComponent implements OnInit {

    orderForm!: FormGroup;
    loading = true;
    submitting = false;

    /** 1 = materia prima, 2 = material de empaque. Viene de `data` en la ruta. */
    materialType = 1;
    title = 'Consumir materia prima de inventario';
    availableLabel = 'Materia prima disponible';
    selectedLabel = 'Materia prima a consumir';
    consumeLabel = 'Consumir materia prima';
    successMessage = 'Materia(s) prima(s) consumida(s) correctamente';
    errorMessage = 'Error al consumir materia prima';
    redirectRoute = '/inventory/factory/rawMaterial';

    inventory?: Inventory;
    pickerItems: QuantityPickerItem[] = [];
    selection: QuantityPickerSelection[] = [];

    constructor(private dataService: DataService, private route: ActivatedRoute,
        private alertService: AlertService, private accountService: AccountService,
        private router: Router) { }

    ngOnInit(): void {
        this.materialType = this.route.snapshot.data['materialType'] ?? 1;
        const isPackaging = this.materialType === 2;
        this.title = isPackaging ? 'Consumir material de empaque de inventario' : 'Consumir materia prima de inventario';
        this.availableLabel = isPackaging ? 'Material de empaque disponible' : 'Materia prima disponible';
        this.selectedLabel = isPackaging ? 'Material de empaque a consumir' : 'Materia prima a consumir';
        this.consumeLabel = isPackaging ? 'Consumir material de empaque' : 'Consumir materia prima';
        this.successMessage = isPackaging
            ? 'Material(es) de empaque consumido(s) correctamente'
            : 'Materia(s) prima(s) consumida(s) correctamente';
        this.errorMessage = isPackaging ? 'Error al consumir material de empaque' : 'Error al consumir materia prima';
        this.redirectRoute = isPackaging ? '/inventory/warehouse/packagingMaterial' : '/inventory/factory/rawMaterial';

        this.orderForm = this.createFormGroup();

        const inventoryQuery = isPackaging ? 'retrievePackagingMaterialInventoryV3' : 'retrieveRawMaterialInventoryV3';
        forkJoin([
            this.dataService.getAnyComponent({}, 'getMeasure'),
            this.dataService.getInventoryByType({}, inventoryQuery)
        ]).subscribe({
            next: (result: any) => {
                const measures: Measure[] = this.dataService.findJsonValue(result[0], 'json_result') || [];
                this.inventory = this.dataService.findJsonValue(result[1], 'json_result') || {};
                this.pickerItems = (this.inventory?.inventoryElements || []).map(element =>
                    this.toPickerItem(element, measures));
            },
            error: (e) => console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => this.loading = false
        });
    }

    /**
     * Un material del inventario como fila de la tabla. La existencia viaja en unidad base, para
     * que el tope valga en cualquier medida que se elija (existencia en kilos, consumo en libras).
     */
    private toPickerItem(element: InventoryElement, measures: Measure[]): QuantityPickerItem {
        const stock = Number(element.quantity) || 0;
        const stockBase = stock * (Number(element.measure?.unitBase?.quantity) || 0);
        return {
            id: element.rawMaterialBase?.id,
            title: element.rawMaterialBase?.name,
            // Misma regla de compatibilidad que usaba el modal: las medidas cuya unidad base
            // coincide con la del material.
            measures: measures
                .filter(measure => element.rawMaterialBase?.measure?.identifier?.includes(measure.unitBase?.name!))
                .map(measure => ({
                    id: measure.id,
                    identifier: measure.identifier,
                    unitBaseQuantity: Number(measure.unitBase?.quantity)
                })),
            maxBase: stockBase,
            stockText: `${stock} ${element.measure?.identifier ?? ''}`.trim()
        };
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

        const elementsToConsume = this.selection.map(element => ({
            inventoryType: this.inventory?.inventoryType,
            unitName: this.inventory?.unitName,
            elementId: element.id,
            measureId: element.measure?.id,
            quantity: element.quantity.toFixed(2),
            creatorUserId: this.accountService.userValue.uuid,
            comment: this.orderForm.get('comment')?.value,
            actionTypeId: actionTypeValues.remove_rm_by_consume.actionType.id,
        }));

        this.dataService.multiAddRemoveInventoryElement(elementsToConsume)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success(this.successMessage, { keepAfterRouteChange: true });
                    this.router.navigateByUrl(this.redirectRoute);
                },
                error: error => {
                    const errorResponse = this.dataService.getErrorMessageResponse(error, this.errorMessage);
                    this.alertService.error(errorResponse);
                    this.submitting = false;
                }
            });
    }
}
