import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { concatMap, first } from 'rxjs/operators';
import {map, startWith} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';

import { AccountService, AlertService, DataService} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Establishment } from '@app/models/establishment.model';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import { Inventory } from '@app/models/inventory/inventory.model';
import { InventoryElement } from '@app/models/inventory/inventory-element.model';
import { RawMaterialByProvider } from '@app/models/raw-material/raw-material-by-provider.model';
import { Measure } from '@app/models';
import { UnitBase } from '@app/models/auxiliary/unit-base.model';
import { BehaviorSubject, forkJoin } from 'rxjs';
import { MovementWarehouseToFactory } from '@app/models/inventory/movement-store-to-factory.model';
import { Router } from '@angular/router';
import { UpdateInventoryElement } from '@app/models/inventory/update-inventory-element.model';
import { ActivityLog } from '@app/models/system/activity-log';

@Component({ 
    templateUrl: 'list-factory-inventory-rm.component.html',
    styleUrls: ['list-factory-inventory-rm.component.scss']
})
export class ListFactoryInventoryRMComponent implements OnInit {

    submitting = false;
    inventory?: Inventory;
    inventoryElements?: InventoryElement[];
    allInventoryElements?: InventoryElement[];
    selectedInventoryElement?: InventoryElement;
    rawMaterialForm!: FormGroup;
    operationRawMaterialForm!: FormGroup;
    selectedMeasure?: Measure;
    elements: any = [];
    measureOptions?: Measure[];
    inventoryUnitBase?: UnitBase;
    unitMeasureOptions?: Measure[];
    weightMeasureOptions?: Measure[];
    selectedUnitMeasure?: Measure;
    selectedUnitMeasureSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedWeightMeasure?: Measure;
    selectedWeightMeasureSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    currentMeasureQuantity = 0;
    filteredMeasureOptions?: Measure[];
    selectedQuantity = 0;
    formQuantity = 0;
    modalFinalQuantity = 0;
    modalSelectedQuantity = 0;
    modalUnitBaseTotalQuantity = 0;
    searchTerm?: string;
    entries = [5, 10, 20, 50];
    pageSize = 5;
    page = 1;
    tableElementsValues?: any;
    activityLogName = "Acciones de Materia Prima en Inventario de Fabrica";

    constructor(private dataService: DataService, private alertService: AlertService, private router: Router) {}

    ngOnInit() {

        this.selectedUnitMeasureSubject.subscribe(value => {
            this.setMeasure(String(value));
        });

        this.selectedWeightMeasureSubject.subscribe(value => {
            this.setWeightMeasure(String(value));
        });

        this.inventory = undefined;
        let requestArray = [];

        requestArray.push(this.dataService.getAllInventoryByFilter({ _id: "64d7240f838808573bd7e9ee"}));
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "measure", enableElements: "true"})); // measureRequest

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.inventory = result[0].retrieveInventoryResponse?.Inventorys[0];
                this.measureOptions = result[1].retrieveCatalogGenericResponse.elements;
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.unitMeasureOptions = this.measureOptions?.filter(meas => meas.unitBase?.name === "Unidad");
                this.weightMeasureOptions = this.measureOptions?.filter(meas => meas.unitBase?.name === "Libra");
                if(this.unitMeasureOptions)
                        this.selectedUnitMeasure = this.unitMeasureOptions[1];
                if(this.weightMeasureOptions)
                    this.selectedWeightMeasure = this.weightMeasureOptions[1];
                // console.log('complete')
                if (this.inventory){
                    console.log(this.inventory);
                    this.inventoryElements = this.inventory?.inventoryElements;
                    this.allInventoryElements = this.inventoryElements;
                    this.setTableElements(this.inventoryElements);
                }
            }
        });
        this.rawMaterialForm = this.createMaterialFormGroup();
        this.operationRawMaterialForm = this.createOperationMaterialFormGroup();
    }

    search(value: any): void {
        if (this.allInventoryElements){
            this.inventoryElements = this.allInventoryElements?.filter((val) => {
                if(this.searchTerm){
                    const nameMatch = val.rawMaterialBase?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const measureMatch = val.measure?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());

                    return nameMatch || measureMatch;
                }
                return true;
            });
        }
        this.setTableElements(this.inventoryElements);
    }

    setTableElements(elements?: InventoryElement[]){
        this.tableElementsValues = [];
        elements?.forEach((element: InventoryElement) => {
            const curr_row = [
                    { type: "text", value: element.rawMaterialBase?.name, header_name: "Producto", style: "width: 25%", id: element.rawMaterialBase?._id },
                    { type: "text", value: this.dataService.getConvertedMeasureName(this.selectedUnitMeasure, this.selectedWeightMeasure, element.measure), header_name: "Medida", style: "width: 20%" },
                    { type: "text", value: this.dataService.getConvertedMeasure(Number(element.quantity), this.selectedUnitMeasure, this.selectedWeightMeasure, element.measure), header_name: "Cantidad", style: "width: 20%" },
                    // { type: "text", value: this.dataService.getFormatedPrice(Number(element.rawMaterialByProvider?.price)), header_name: "Precio" },
                    // { type: "text", value: element.paymentStatus.identifier, header_name: "Estado de pago" },
                    // { type: "text", value: this.dataService.getFormatedPrice(Number(element.pendingAmount)), header_name: "Monto pendiente" },
                    {
                        type: "modal_button",
                        style: "white-space: nowrap",
                        header_name: "Acciones",
                        data: element,
                        button: [
                            // {
                            //     type: "button",
                            //     data_bs_target: "#moveFactoryInventoryRawMaterialModal",
                            //     class: "btn btn-primary mx-1",
                            //     icon: {
                            //         class: "material-icons",
                            //         icon: "content_paste_go"
                            //     },
                            //     text: "Mover"
                            // },
                            {
                                type: "button",
                                data_bs_target: "#addInventoryRawMaterialModal",
                                class: "btn btn-success mx-1",
                                icon: {
                                    class: "material-icons",
                                    icon: "add_circle"
                                },
                                text: "Agregar"
                            },
                            {
                                type: "button",
                                data_bs_target: "#removeInventoryRawMaterialModal",
                                class: "btn btn-danger mx-1",
                                icon: {
                                    class: "material-icons",
                                    icon: "remove_circle"
                                },
                                text: "Eliminar"
                            }
                        ]
                    }
            ];
            this.tableElementsValues.push(curr_row);
        });
    }

    get r() {
        return this.rawMaterialForm.controls;
    }

    get or() {
        return this.operationRawMaterialForm.controls;
    }

    selectMeasure(measureId?: string){
        return this.measureOptions?.find(measure => String(measure.id) === measureId);
    }

    changeMeasure(measureId: any){
        if(measureId){
            if(this.selectedMeasure){
                this.elements.pop();
            }
            this.selectedMeasure = this.selectMeasure(measureId);
            this.currentMeasureQuantity = Number(this.selectedMeasure?.unitBase?.quantity);
            this.elements.push({icon : "inbox", name : "Cantidad (" + this.inventoryUnitBase?.name + ")", value : this.currentMeasureQuantity});
        }
        this.calculateModalQuantity('rest');
    }

    setQuantityValue(event: Event){
        if (event.target instanceof HTMLInputElement) {
            this.formQuantity = Number(event.target.value) || 0;
        }
        this.calculateModalQuantity();
    }

    get quantityInput(){
        return this.rawMaterialForm.get('quantity');
    }

    get measureSelect(){
        return this.rawMaterialForm.get('measure');
    }

    get operationQuantityInput(){
        return this.operationRawMaterialForm.get('quantity');
    }

    get operationReasonInput(){
        return this.operationRawMaterialForm.get('reason');
    }

    restQuantityValue(event: Event){
        if (event.target instanceof HTMLInputElement) {
            this.formQuantity = Number(event.target.value) || 0;
        }
        this.selectedMeasure = this.selectedInventoryElement?.measure;
        this.currentMeasureQuantity = Number(this.selectedMeasure?.unitBase?.quantity);
        this.calculateModalQuantity('rest');
    }

    sumQuantityValue(event: Event){
        if (event.target instanceof HTMLInputElement) {
            this.formQuantity = Number(event.target.value) || 0;
        }
        this.selectedMeasure = this.selectedInventoryElement?.measure;
        this.currentMeasureQuantity = Number(this.selectedMeasure?.unitBase?.quantity);
        this.calculateModalQuantity('sum');
    }

    calculateModalQuantity(actionType?: string) {
        this.setInventoryElementElements();
        let totalQuantity = Number(this.formQuantity)*Number(this.currentMeasureQuantity) || 0;
        this.modalUnitBaseTotalQuantity = Number(this.inventoryUnitBase?.quantity) * Number(this.selectedInventoryElement?.quantity);
        if(actionType === 'rest'){
            if(totalQuantity > this.modalUnitBaseTotalQuantity){
                this.quantityInput?.setValue('0');
                this.operationQuantityInput?.setValue('0');
                this.formQuantity = 0;
                totalQuantity = 0;
            }
            this.modalFinalQuantity = this.modalUnitBaseTotalQuantity - totalQuantity;

        } else if(actionType === 'sum'){
            this.modalFinalQuantity = this.modalUnitBaseTotalQuantity + totalQuantity;
        }
        this.modalSelectedQuantity = totalQuantity;
    }

    onMoveMaterialForm(){
        this.tableElementsValues.forEach((curr_row: any) => {
            if(curr_row[0].id === this.selectedInventoryElement?.rawMaterialBase?._id){
                let buttons = curr_row[3].button;
                buttons[0].submitting = true;
                buttons.forEach((btn: any) => {
                    btn.disabled = true;
                });
            }
        });
        let newMoveStoreToFactory: MovementWarehouseToFactory = {
            rawMaterialByProviderID: this.selectedInventoryElement?.rawMaterialBase?._id,
            factoryInventoryID: "64d7240f838808573bd7e9ee",
            quantity: String(this.formQuantity),
            measure: this.selectedMeasure
        }
        this.dataService.moveStoreToFactory(newMoveStoreToFactory)
        .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Movimiento de inventario realizado correctamente', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/inventory/factory/rawMaterial');
                },
                error: error => {
                    this.alertService.error('Error en movimiento de inventario, contacte con Administracion');
            }});
    }

    onDeleteMaterialForm(){
        this.tableElementsValues.forEach((curr_row: any) => {
            if(curr_row[0].id === this.selectedInventoryElement?.rawMaterialBase?._id){
                let buttons = curr_row[3].button;
                buttons[1].submitting = true;
                buttons.forEach((btn: any) => {
                    btn.disabled = true;
                });
            }
        });
        let deleteFromInventory: UpdateInventoryElement = {
            inventoryID: "64d7240f838808573bd7e9ee",
            inventoryTypeID: "1",
            elementID: this.selectedInventoryElement?.rawMaterialBase?._id,
            newQuantity: String(this.modalFinalQuantity),
        }
        let activityLog: ActivityLog = {
            action: "remove",
            section: this.activityLogName,
            description: "Retiro de Materia Prima '" + this.selectedInventoryElement?.rawMaterialBase?.name + "' del inventario de fabrica",
            extra: {
                inventoryElement: this.selectedInventoryElement,
                reason: this.operationReasonInput?.value
            },
            request: deleteFromInventory
        }

        this.dataService.updateInventoryElement(deleteFromInventory)
        .pipe(concatMap((result: any) => {
            activityLog.response = result;
            activityLog.status = result.updateInventoryElementResponse.AcknowledgementIndicator;
            return this.dataService.addActivityLog(activityLog);
        }))
        .subscribe({
            next: () => {
                this.router.navigateByUrl('/').then(() => {
                    this.alertService.success('Movimiento de inventario realizado correctamente', { keepAfterRouteChange: true });
                    this.router.navigate(['/inventory/factory/rawMaterial']); 
                });},
            error: error => {
                this.alertService.error('Error en movimiento de inventario, contacte con Administracion');
        }});
    }

    onAddMaterialForm(){
        this.tableElementsValues.forEach((curr_row: any) => {
            if(curr_row[0].id === this.selectedInventoryElement?.rawMaterialBase?._id){
                let buttons = curr_row[3].button;
                buttons[0].submitting = true;
                buttons.forEach((btn: any) => {
                    btn.disabled = true;
                });
            }
        });
        let addToInventory: UpdateInventoryElement = {
            inventoryID: "64d7240f838808573bd7e9ee",
            inventoryTypeID: "1",
            elementID: this.selectedInventoryElement?.rawMaterialBase?._id,
            newQuantity: String(this.modalFinalQuantity),
        }

        let activityLog: ActivityLog = {
            action: "add",
            section: this.activityLogName,
            description: "Adicion de Materia Prima '" + this.selectedInventoryElement?.rawMaterialBase?.name + "' al inventario de fabrica",
            extra: {
                inventoryElement: this.selectedInventoryElement,
                reason: this.operationReasonInput?.value
            },
            request: addToInventory
        }

        console.log(addToInventory);
        this.dataService.updateInventoryElement(addToInventory)
        .pipe(concatMap((result: any) => {
            activityLog.response = result;
            activityLog.status = result.updateInventoryElementResponse.AcknowledgementIndicator;
            return this.dataService.addActivityLog(activityLog);
        }))
        .subscribe({
            next: () => {
                this.router.navigateByUrl('/').then(() => {
                    this.alertService.success('Movimiento de inventario realizado correctamente', { keepAfterRouteChange: true });
                    this.router.navigate(['/inventory/factory/rawMaterial']); 
                });},
            error: error => {
                this.alertService.error('Error en movimiento de inventario, contacte con Administracion');
        }});    
    }

    setMeasure(measureId: string){
        if(measureId){
            this.selectedUnitMeasure = this.measureOptions?.find(meas => String(meas.id) === measureId);
            this.setTableElements(this.inventoryElements);
        }
    }

    setWeightMeasure(measureId: string){
        if(measureId){
            this.selectedWeightMeasure = this.measureOptions?.find(meas => String(meas.id) === measureId);
            this.setTableElements(this.inventoryElements);
        }
    }

    goToActionsHistory(){
        this.router.navigate(['/activityLog/view'], { queryParams: { sec: this.activityLogName } });
    }

    receiveData(data: any){
        this.selectedInventoryElement = data;
        this.inventoryUnitBase = this.selectedInventoryElement?.measure?.unitBase;
        this.elements = [];
        this.setInventoryElementElements();
        this.filteredMeasureOptions = this.measureOptions?.filter(item => this.selectedInventoryElement?.rawMaterialByProvider?.rawMaterialBase?.measure?.identifier?.includes(item.unitBase?.name!));
        this.measureSelect?.setValue('');
    }

    setInventoryElementElements(){
        this.elements = [];
        // this.elements.push({icon : "scale", name : "Medida", value : rawMaterial.rawMaterialBase?.measure});
        this.elements.push({icon : "format_size", name : "Nombre", value : this.selectedInventoryElement?.rawMaterialBase?.name});
        this.elements.push({icon : "feed", name : "Descripción", value : this.selectedInventoryElement?.rawMaterialBase?.description});
        if(this.currentMeasureQuantity){
            this.elements.push({icon : "inbox", name : "Cantidad (" + this.inventoryUnitBase?.name + ")", value : this.currentMeasureQuantity});
        }
        // this.elements.push({icon : "shelves", name : "Disponible (" + this.inventoryElementMeasure?.unitBase?.name + ")", value : Number(this.inventoryElementMeasure?.unitBase?.quantity) * Number(this.selectedInventoryElement?.quantity) });
    }

    closeRawMaterialDialog(){
        this.onResetMaterialForm();
    }

    closeOperationRawMaterialDialog(){
        this.onResetOperationMaterialForm();
    }

    onResetMaterialForm(){
        this.rawMaterialForm.reset();
        this.selectedInventoryElement = undefined;
        this.selectedMeasure = undefined;
        this.currentMeasureQuantity = 0;
        this.formQuantity = 0;
        this.modalSelectedQuantity = 0;
        this.modalUnitBaseTotalQuantity = 0;
        this.elements = [];
    }

    onResetOperationMaterialForm(){
        this.operationRawMaterialForm.reset();
        this.selectedInventoryElement = undefined;
        this.selectedMeasure = undefined;
        this.currentMeasureQuantity = 0;
        this.formQuantity = 0;
        this.modalSelectedQuantity = 0;
        this.modalUnitBaseTotalQuantity = 0;
        this.elements = [];
    }

    createMaterialFormGroup() {
        return new FormGroup({
            quantity: new FormControl('', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
            measure: new FormControl('', [Validators.required])
        });
    }

    createOperationMaterialFormGroup() {
        return new FormGroup({
            quantity: new FormControl('', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
            reason: new FormControl('', [Validators.required, Validators.maxLength(50)])
        });
    }

}