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
    templateUrl: 'list-factory-inventory-fp.component.html',
    styleUrls: ['list-factory-inventory-fp.component.scss']
})
export class ListFactoryInventoryFPComponent implements OnInit {

    submitting = false;
    inventory?: Inventory;
    inventoryElements?: InventoryElement[];
    allInventoryElements?: InventoryElement[];
    selectedInventoryElement?: InventoryElement;
    finishedProductForm!: FormGroup;
    selectedMeasure?: Measure;
    measureOptions?: Measure[];
    generalMeasureOptions?: Measure[];
    selectedMeasureTable?: Measure;
    selectedMeasureTableSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    elements: any = [];
    inventoryUnitBase?: UnitBase;
    currentMeasureQuantity = 0;
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
    activityLogName = "Acciones de Producto Terminado en Inventario de Fabrica";

    constructor(private dataService: DataService, private alertService: AlertService, private router: Router) {}

    ngOnInit() {

        this.selectedMeasureTableSubject.subscribe(value => {
            this.setMeasure(String(value));
        });

        this.inventory = undefined;
        let requestArray = [];

        requestArray.push(this.dataService.getAllInventoryByFilter({ _id: "64d7dae896457636c3f181e9"}));
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "measure", enableElements: "true"})); // measureRequest

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.inventory = result[0].retrieveInventoryResponse?.Inventorys[0];
                this.measureOptions = result[1].retrieveCatalogGenericResponse.elements;
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                // console.log('complete')
                this.generalMeasureOptions = this.measureOptions?.filter(meas => meas.unitBase?.name === "Unidad");
                if(this.generalMeasureOptions)
                        this.selectedMeasureTable = this.generalMeasureOptions[1];
                if (this.inventory){
                    console.log(this.inventory);
                    this.inventoryElements = this.inventory?.inventoryElements;
                    // const filteredInventoryElements = this.inventoryElements?.filter(
                    //     (value, index, arr) => arr.findIndex(obj => obj._id === value._id) === index
                    // )
                    // this.inventoryElements = filteredInventoryElements;
                    this.allInventoryElements = this.inventoryElements;
                    this.setTableElements(this.inventoryElements);
                }
            }
        });
        this.finishedProductForm = this.createFinishedProductFormGroup();
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
                    const nameMatch = val.finishedProduct?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const measureMatch = val.finishedProduct?.measure?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());

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
                    { type: "text", value: element.finishedProduct?.name, header_name: "Producto", style: "width: 30%", id: element.finishedProduct?._id },
                    { type: "text", value: this.dataService.getConvertedMeasureName(this.selectedMeasureTable!, element.measure!), header_name: "Medida", style: "width: 20%" },
                    { type: "text", value: this.dataService.getConvertedMeasure(Number(element.quantity), this.selectedMeasureTable!, element.measure!), header_name: "Cantidad", style: "width: 20%" },
                    // { type: "text", value: this.dataService.getFormatedPrice(Number(element.rawMaterialByProvider?.price)), header_name: "Precio" },
                    // { type: "text", value: element.status?.identifier, header_name: "Estado", style: "width: 15%" },
                    // { type: "text", value: element.paymentStatus.identifier, header_name: "Estado de pago" },
                    // { type: "text", value: this.dataService.getFormatedPrice(Number(element.pendingAmount)), header_name: "Monto pendiente" },
                    {
                        type: "modal_button",
                        style: "white-space: nowrap width: 30%",
                        header_name: "Acciones",
                        data: element,
                        button: [
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
        return this.finishedProductForm.controls;
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
        return this.finishedProductForm.get('quantity');
    }

    get operationReasonInput(){
        return this.finishedProductForm.get('reason');
    }

    calculateModalQuantity(actionType?: string) {
        this.setInventoryElementElements();
        let totalQuantity = Number(this.formQuantity)*Number(this.currentMeasureQuantity) || 0;
        this.modalUnitBaseTotalQuantity = Number(this.inventoryUnitBase?.quantity) * Number(this.selectedInventoryElement?.quantity);
        if(actionType === 'rest'){
            if(totalQuantity > this.modalUnitBaseTotalQuantity){
                this.quantityInput?.setValue('0');
                this.formQuantity = 0;
                totalQuantity = 0;
            }
            this.modalFinalQuantity = this.modalUnitBaseTotalQuantity - totalQuantity;

        } else if(actionType === 'sum'){
            this.modalFinalQuantity = this.modalUnitBaseTotalQuantity + totalQuantity;
        }
        this.modalSelectedQuantity = totalQuantity;
    }

    onAddMaterialForm(){
        this.tableElementsValues.forEach((curr_row: any) => {
            if(curr_row[0].id === this.selectedInventoryElement?.finishedProduct?._id){
                let buttons = curr_row[3].button;
                buttons[0].submitting = true;
                buttons.forEach((btn: any) => {
                    btn.disabled = true;
                });
            }
        });
        let addToInventory: UpdateInventoryElement = {
            inventoryID: "64d7dae896457636c3f181e9",
            inventoryTypeID: "3",
            elementID: this.selectedInventoryElement?.finishedProduct?._id,
            newQuantity: String(this.modalFinalQuantity),
        }
        let activityLog: ActivityLog = {
            action: "add",
            section: this.activityLogName,
            description: "Adicion de Producto Terminado '" + this.selectedInventoryElement?.finishedProduct?.name + "' al inventario de fabrica.",
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
                    this.alertService.success('Movimiento de inventario realizado correctamente', { keepAfterRouteChange: true });
                    this.router.navigate(['/inventory/factory/finishedProduct']); 
                });},
            error: error => {
                this.alertService.error('Error en movimiento de inventario, contacte con Administracion');
        }});    
    }

    onDeleteMaterialForm(){
        this.tableElementsValues.forEach((curr_row: any) => {
            if(curr_row[0].id === this.selectedInventoryElement?.finishedProduct?._id){
                let buttons = curr_row[3].button;
                buttons[1].submitting = true;
                buttons.forEach((btn: any) => {
                    btn.disabled = true;
                });
            }
        });
        let deleteFromInventory: UpdateInventoryElement = {
            inventoryID: "64d7dae896457636c3f181e9",
            inventoryTypeID: "3",
            elementID: this.selectedInventoryElement?.finishedProduct?._id,
            newQuantity: String(this.modalFinalQuantity),
        }
        let activityLog: ActivityLog = {
            action: "remove",
            section: this.activityLogName,
            description: "Retiro de Producto Terminado '" + this.selectedInventoryElement?.finishedProduct?.name + "' del inventario de fabrica",
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
                    this.router.navigate(['/inventory/factory/finishedProduct']); 
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
    }

    goToActionsHistory(){
        this.router.navigate(['/activityLog/view'], { queryParams: { sec: this.activityLogName } });
    }

    setInventoryElementElements(){
        this.elements = [];
        // this.elements.push({icon : "scale", name : "Medida", value : rawMaterial.rawMaterialBase?.measure});
        this.elements.push({icon : "format_size", name : "Nombre", value : this.selectedInventoryElement?.finishedProduct?.name});
        this.elements.push({icon : "feed", name : "Descripción", value : this.selectedInventoryElement?.finishedProduct?.description});
        if(this.currentMeasureQuantity){
            this.elements.push({icon : "inbox", name : "Cantidad (" + this.inventoryUnitBase?.name + ")", value : this.currentMeasureQuantity});
        }
        // this.elements.push({icon : "shelves", name : "Disponible (" + this.inventoryElementMeasure?.unitBase?.name + ")", value : Number(this.inventoryElementMeasure?.unitBase?.quantity) * Number(this.selectedInventoryElement?.quantity) });
    }

    closeFinishedProductlDialog(){
        this.onResetFinishedProductForm();
    }

    onResetFinishedProductForm(){
        this.finishedProductForm.reset();
        this.selectedInventoryElement = undefined;
        this.selectedMeasure = undefined;
        this.currentMeasureQuantity = 0;
        this.formQuantity = 0;
        this.modalSelectedQuantity = 0;
        this.modalUnitBaseTotalQuantity = 0;
        this.elements = [];
    }

    createFinishedProductFormGroup() {
        return new FormGroup({
            quantity: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/)]),
            reason: new FormControl('', [Validators.required, Validators.maxLength(50)])
        });
    }

}