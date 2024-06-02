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
    templateUrl: 'list-inventory-rmp-bodega.component.html',
    styleUrls: ['list-inventory-rmp-bodega.component.scss']
})
export class ListWarehouseInventoryRMPComponent implements OnInit {

    inventory?: Inventory;
    inventoryElements?: InventoryElement[];
    allInventoryElements?: InventoryElement[];
    selectedInventoryElement?: InventoryElement;
    rawMaterialForm!: FormGroup;
    operationRawMaterialForm!: FormGroup;
    selectedMeasure?: Measure;
    generalMeasureOptions?: Measure[];
    weightMeasureOptions?: Measure[];
    selectedMeasureTable?: Measure;
    selectedMeasureTableSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedWeightMeasure?: Measure;
    selectedWeightMeasureSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    elements: any = [];
    measureOptions?: Measure[];
    inventoryUnitBase?: UnitBase;
    currentMeasureQuantity = 0;
    filteredMeasureOptions?: Measure[];
    selectedQuantity = 0;
    formQuantity = 0;
    modalSelectedQuantity = 0;
    modalFinalQuantity = 0;
    modalUnitBaseTotalQuantity = 0;
    searchTerm?: string;
    entries = [5, 10, 20, 50];
    pageSize = 5;
    page = 1;
    tableElementsValues?: any;
    activityLogName = "Acciones de Materia Prima por Proveedor en Inventario de Bodega";

    constructor(private accountService: AccountService, private dataService: DataService, private alertService: AlertService, private router: Router) {}

    ngOnInit() {

        this.selectedMeasureTableSubject.subscribe(value => {
            this.setMeasure(String(value));
        });

        this.selectedWeightMeasureSubject.subscribe(value => {
            this.setWeightMeasure(String(value));
        });

        this.inventory = undefined;
        let requestArray = [];

        requestArray.push(this.dataService.getInventory({ _id: "64d7b118440275e2da6384c5"}));
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "measure", enableElements: "true"})); // measureRequest

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.inventory = result[0].getInventoryResponse?.Inventory;
                this.measureOptions = result[1].retrieveCatalogGenericResponse.elements;
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.generalMeasureOptions = this.measureOptions?.filter(meas => meas.unitBase?.name === "Unidad");
                this.weightMeasureOptions = this.measureOptions?.filter(meas => meas.unitBase?.name === "Libra");
                if(this.generalMeasureOptions)
                        this.selectedMeasureTable = this.generalMeasureOptions[1];
                if(this.weightMeasureOptions)
                    this.selectedWeightMeasure = this.weightMeasureOptions[1];
                // console.log('complete')
                if (this.inventory){
                    this.inventoryElements = this.inventory?.inventoryElements;
                    this.allInventoryElements = this.inventoryElements;
                    this.setTableElements(this.inventoryElements);
                }
            }
        });

        this.rawMaterialForm = this.createMaterialFormGroup();
        this.operationRawMaterialForm = this.createOperationMaterialFormGroup();
    }

    setWeightMeasure(measureId: string){
        if(measureId){
            this.selectedWeightMeasure = this.measureOptions?.find(meas => String(meas.id) === measureId);
            this.setTableElements(this.inventoryElements);
        }
    }

    setMeasure(measureId: string){
        if(measureId){
            this.selectedMeasureTable = this.measureOptions?.find(meas => String(meas.id) === measureId);
            this.setTableElements(this.inventoryElements);
        }
    }

    search(value: any): void {
        if (this.allInventoryElements){
            this.inventoryElements = this.allInventoryElements?.filter((val) => {
                if(this.searchTerm){
                    const nameMatch = val.rawMaterialByProvider?.rawMaterialBase?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const commentMatch = val.comment?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const providerMatch = val.rawMaterialByProvider?.provider?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const paymentTypeMatch = val.paymentType?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const paymentStatusMatch = val.paymentStatus?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const finalAmountMatch = val.finalAmount?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const pendingAmountMatch = val.pendingAmount?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return nameMatch || providerMatch;
                }
                return true;
            });
        }
        this.setTableElements(this.inventoryElements);
    }

    isAdmin(){
        return this.accountService.isAdminUser();
    }

    setTableElements(elements?: InventoryElement[]){
        this.tableElementsValues = [];
        elements?.forEach((element: InventoryElement) => {
            const curr_row = [
                    { type: "text", value: element.rawMaterialByProvider?.rawMaterialBase?.name, header_name: "Producto", style: "width: 25%", id: element.rawMaterialByProvider?._id },
                    { type: "text", value: element.rawMaterialByProvider?.provider?.name, header_name: "Proveedor", style: "width: 15%" },
                    { type: "text", value: this.dataService.getConvertedMeasureName(this.selectedMeasureTable, this.selectedWeightMeasure, element.measure), header_name: "Medida", style: "width: 15%" },
                    { type: "text", value: this.dataService.getConvertedMeasure(Number(element.quantity), this.selectedMeasureTable, this.selectedWeightMeasure, element.measure), header_name: "Cantidad", style: "width: 15%" },
                    // { type: "text", value: element.status?.identifier, header_name: "Estado", style: "width: 15%" },
                    {
                        type: "modal_button",
                        style: "white-space: nowrap",
                        header_name: "Acciones",
                        data: element,
                        button: 
                        this.isAdmin() ?
                        [
                            {
                                type: "button",
                                data_bs_target: "#moveInventoryRawMaterialModal",
                                class: "btn btn-primary mx-1",
                                icon: {
                                    class: "material-icons",
                                    icon: "content_paste_go"
                                },
                                text: "Mover"
                            },
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
                        ] : [
                            {
                                type: "button",
                                data_bs_target: "#moveInventoryRawMaterialModal",
                                class: "btn btn-primary mx-1",
                                icon: {
                                    class: "material-icons",
                                    icon: "content_paste_go"
                                },
                                text: "Mover"
                            }
                        ]
                    }
            ];
                // id: element.rawMaterialByProvider?._id
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
        }
        this.calculateModalQuantity('rest');
    }

    setQuantityValue(event: Event){
        if (event.target instanceof HTMLInputElement) {
            this.formQuantity = Number(event.target.value) || 0;
        }
        this.calculateModalQuantity('rest');
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
            if(curr_row[0].id === this.selectedInventoryElement?.rawMaterialByProvider?._id){
                let buttons = curr_row[4].button;
                buttons[0].submitting = true;
                buttons.forEach((btn: any) => {
                    btn.disabled = true;
                });
            }
        });
        let newMoveStoreToFactory: MovementWarehouseToFactory = {
            rawMaterialByProviderID: this.selectedInventoryElement?.rawMaterialByProvider?._id,
            factoryInventoryID: "64d7240f838808573bd7e9ee",
            quantity: String(this.formQuantity),
            measure: this.selectedMeasure
        }
        let activityLog: ActivityLog = {
            action: "movement",
            section: this.activityLogName,
            description: "Movimiento de Materia Prima por Proveedor '" + this.selectedInventoryElement?.rawMaterialByProvider?.rawMaterialBase?.name + "' de inventario de bodega a inventario de fabrica",
            extra: {
                inventoryElement: this.selectedInventoryElement
            },
            request: newMoveStoreToFactory
        }
        this.dataService.moveStoreToFactory(newMoveStoreToFactory)
        .pipe(concatMap((result: any) => {
            activityLog.response = result;
            activityLog.status = result.moveStoreToFactoryResponse.AcknowledgementIndicator;
            return this.dataService.addActivityLog(activityLog);
        }))
        .subscribe({
            next: () => {
                this.router.navigateByUrl('/').then(() => {
                    this.alertService.success('Movimiento de inventario realizado correctamente', { keepAfterRouteChange: true });
                    this.router.navigate(['/inventory/warehouse/rawMaterialByProvider']); 
                });},
            error: error => {
                this.alertService.error('Error en movimiento de inventario, contacte con Administracion');
        }});
    }

    onDeleteMaterialForm(){
        this.tableElementsValues.forEach((curr_row: any) => {
            if(curr_row[0].id === this.selectedInventoryElement?.rawMaterialByProvider?._id){
                let buttons = curr_row[4].button;
                buttons[2].submitting = true;
                buttons.forEach((btn: any) => {
                    btn.disabled = true;
                });
            }
        });
        let deleteFromInventory: UpdateInventoryElement = {
            inventoryID: "64d7b118440275e2da6384c5",
            inventoryTypeID: "2",
            elementID: this.selectedInventoryElement?.rawMaterialByProvider?._id,
            newQuantity: String(this.modalFinalQuantity),
        }
        let activityLog: ActivityLog = {
            action: "remove",
            section: this.activityLogName,
            description: "Retiro de Materia Prima por Proveedor '" + this.selectedInventoryElement?.rawMaterialByProvider?.rawMaterialBase?.name + "' del inventario de bodega",
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
                    this.alertService.success('Resta de inventario realizado correctamente', { keepAfterRouteChange: true });
                    this.router.navigate(['/inventory/warehouse/rawMaterialByProvider']); 
                });},
            error: error => {
                this.alertService.error('Error en movimiento de inventario, contacte con Administracion');
        }});
    }

    onAddMaterialForm(){
        this.tableElementsValues.forEach((curr_row: any) => {
            if(curr_row[0].id === this.selectedInventoryElement?.rawMaterialByProvider?._id){
                let buttons = curr_row[4].button;
                buttons[1].submitting = true;
                buttons.forEach((btn: any) => {
                    btn.disabled = true;
                });
            }
        });
        let addToInventory: UpdateInventoryElement = {
            inventoryID: "64d7b118440275e2da6384c5",
            inventoryTypeID: "2",
            elementID: this.selectedInventoryElement?.rawMaterialByProvider?._id,
            newQuantity: String(this.modalFinalQuantity),
        }
        let activityLog: ActivityLog = {
            action: "add",
            section: this.activityLogName,
            description: "Adicion de Materia Prima por Proveedor " + this.selectedInventoryElement?.rawMaterialByProvider?.rawMaterialBase?.name + " al inventario de bodega.",
            extra: {
                inventoryElement: this.selectedInventoryElement,
                reason: this.operationReasonInput?.value
            },
            request: addToInventory
        }
        this.dataService.updateInventoryElement(addToInventory)
        .pipe(concatMap((result: any) => {
            activityLog.response = result;
            activityLog.status = result.updateInventoryElementResponse.AcknowledgementIndicator;
            return this.dataService.addActivityLog(activityLog);
        }))
        .subscribe({
            next: () => {
                this.router.navigateByUrl('/').then(() => {
                    this.alertService.success('Adicion de inventario realizado correctamente', { keepAfterRouteChange: true });
                    this.router.navigate(['/inventory/warehouse/rawMaterialByProvider']); 
                });},
            error: error => {
                this.alertService.error('Error en movimiento de inventario, contacte con Administracion');
        }});    
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
        this.elements.push({icon : "format_size", name : "Nombre", value : this.selectedInventoryElement?.rawMaterialByProvider?.rawMaterialBase?.name});
        this.elements.push({icon : "feed", name : "Descripción", value : this.selectedInventoryElement?.rawMaterialByProvider?.rawMaterialBase?.description});
        if(this.currentMeasureQuantity){
            this.elements.push({icon : "inbox", name : "Cantidad (" + this.inventoryUnitBase?.name + ")", value : this.currentMeasureQuantity});
        }
        console.log(this.selectedInventoryElement);
        console.log(this.elements);
        // this.elements.push({icon : "shelves", name : "Disponible (" + this.inventoryElementMeasure?.unitBase?.name + ")", value : Number(this.inventoryElementMeasure?.unitBase?.quantity) * Number(this.selectedInventoryElement?.quantity) });
    }

    closeRawMaterialDialog(){
        this.onResetMaterialForm();
    }

    closeOperationRawMaterialDialog(){
        this.onResetOperationMaterialForm();
    }

    goToActionsHistory(){
        this.router.navigate(['/activityLog/view'], { queryParams: { sec: this.activityLogName } });
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