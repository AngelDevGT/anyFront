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
import { ActivatedRoute, Router } from '@angular/router';
import { UpdateInventoryElement } from '@app/models/inventory/update-inventory-element.model';
import { ActivityLog } from '@app/models/system/activity-log';

@Component({ 
    templateUrl: 'list-store-inventory-pfs.component.html',
    styleUrls: ['list-store-inventory-pfs.component.scss']
})
export class ListStoreInventoryPFSComponent implements OnInit {

    establishment?: Establishment;
    submitting = false;
    storeName?: string;
    inventory?: Inventory;
    inventoryElements?: InventoryElement[];
    allInventoryElements?: InventoryElement[];
    selectedInventoryElement?: InventoryElement;
    productForSaleForm!: FormGroup;
    selectedMeasure?: Measure;
    elements: any = [];
    measureOptions?: Measure[];
    generalMeasureOptions?: Measure[];
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
    selectedMeasureTable?: Measure;
    weightMeasureOptions?: Measure[];
    selectedMeasureTableSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedWeightMeasure?: Measure;
    selectedWeightMeasureSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    pageSize = 5;
    page = 1;
    tableElementsValues?: any;
    activityLogName = "Acciones de Producto para Venta en tienda";

    constructor(private accountService: AccountService, private dataService: DataService, private route: ActivatedRoute, private alertService: AlertService, private router: Router) {}

    ngOnInit() {

        this.selectedMeasureTableSubject.subscribe(value => {
            this.setMeasure(String(value));
        });

        this.selectedWeightMeasureSubject.subscribe(value => {
            this.setWeightMeasure(String(value));
        });

        let establishmentId = this.route.snapshot.params['id'];
        this.inventory = undefined;
        let requestArray = [];

        requestArray.push(this.dataService.getInventory({ _id: "65bf467e008f7e88678d3927"}));
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "measure", enableElements: "true"})); // measureRequest
        requestArray.push(this.dataService.getEstablishmentById(establishmentId));

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.inventory = result[0].getInventoryResponse.Inventory;
                this.measureOptions = result[1].retrieveCatalogGenericResponse.elements;
                this.establishment = result[2].getEstablishmentResponse.establishment;
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                // console.log('complete')
                this.generalMeasureOptions = this.measureOptions?.filter(meas => meas.unitBase?.name === "Unidad");
                if(this.generalMeasureOptions)
                        this.selectedMeasureTable = this.generalMeasureOptions[1];
                this.weightMeasureOptions = this.measureOptions?.filter(meas => meas.unitBase?.name === "Libra");
                if(this.weightMeasureOptions)
                    this.selectedWeightMeasure = this.weightMeasureOptions[1];
                if (this.inventory){
                    this.inventoryElements = this.inventory?.inventoryElements;
                    console.log(this.inventoryElements);
                    this.inventoryElements = this.inventoryElements?.filter(invElem =>invElem.establishment?._id === String(establishmentId));
                    this.allInventoryElements = this.inventoryElements;
                    this.setTableElements(this.inventoryElements);
                    this.storeName = this.establishment?.name;
                    this.activityLogName = this.activityLogName + "|||" + this.establishment?._id;
                }
            }
        });
        this.productForSaleForm = this.createProductForSaleFormGroup();
    }

    isAdmin(){
        return this.accountService.isAdminUser();
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

    setTableElements(elements?: InventoryElement[]){
        this.tableElementsValues = [];
        elements?.forEach((element: InventoryElement) => {
            let curr_row: any = [
                    { type: "text", value: element.productForSale?.finishedProduct?.name, header_name: "Producto", style: "width: 30%", id: element.productForSale?._id },
                    { type: "text", value: this.dataService.getConvertedMeasureName(this.selectedMeasureTable, this.selectedWeightMeasure, element.measure), header_name: "Medida", style: "width: 15%" },
                    { type: "text", value: this.dataService.getConvertedMeasure(Number(element.quantity), this.selectedMeasureTable, this.selectedWeightMeasure, element.measure), header_name: "Cantidad", style: "width: 15%" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.productForSale?.price)), header_name: "Precio", style: "width: 15%" }
            ];
            if(this.isAdmin()){
                curr_row.push({
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
                });
            }
            this.tableElementsValues.push(curr_row);
        });
    }

    get r() {
        return this.productForSaleForm.controls;
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

    setQuantityValue(event: Event){
        if (event.target instanceof HTMLInputElement) {
            this.formQuantity = Number(event.target.value) || 0;
        }
        this.calculateModalQuantity();
    }

    get quantityInput(){
        return this.productForSaleForm.get('quantity');
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
            if(curr_row[0].id === this.selectedInventoryElement?.productForSale?._id){
                let buttons = curr_row[4].button;
                buttons[0].submitting = true;
                buttons.forEach((btn: any) => {
                    btn.disabled = true;
                });
            }
        });
        let addToInventory: UpdateInventoryElement = {
            inventoryID: "65bf467e008f7e88678d3927",
            inventoryTypeID: "4",
            elementID: this.selectedInventoryElement?.productForSale?._id,
            newQuantity: String(this.modalFinalQuantity),
        }
        let activityLog: ActivityLog = {
            action: "add",
            section: this.activityLogName,
            description: "Adicion del producto para venta '" + this.selectedInventoryElement?.productForSale?.finishedProduct?.name + "' al inventario de tienda",
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
                    this.alertService.success('Accion de inventario realizado correctamente', { keepAfterRouteChange: true });
                    this.router.navigate(['/establishments/inventory/' + this.establishment?._id]); 
                });},
            error: error => {
                this.alertService.error('Error en accion de inventario, contacte con Administracion');
        }});    
    }

    onDeleteMaterialForm(){
        this.tableElementsValues.forEach((curr_row: any) => {
            if(curr_row[0].id === this.selectedInventoryElement?.productForSale?._id){
                let buttons = curr_row[4].button;
                buttons[1].submitting = true;
                buttons.forEach((btn: any) => {
                    btn.disabled = true;
                });
            }
        });
        let deleteFromInventory: UpdateInventoryElement = {
            inventoryID: "65bf467e008f7e88678d3927",
            inventoryTypeID: "4",
            elementID: this.selectedInventoryElement?.productForSale?._id,
            newQuantity: String(this.modalFinalQuantity),
        }
        let activityLog: ActivityLog = {
            action: "remove",
            section: this.activityLogName,
            description: "Retiro de Producto para Venta '" + this.selectedInventoryElement?.productForSale?.finishedProduct?.name + "' del inventario de tienda",
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
                    this.router.navigate(['/establishments/inventory/' + this.establishment?._id]); 
                });},
            error: error => {
                this.alertService.error('Error en movimiento de inventario, contacte con Administracion');
        }});
    }

    goToActionsHistory(){
        this.router.navigate(['/activityLog/view'], { queryParams: { sec: this.activityLogName } });
    }

    get operationReasonInput(){
        return this.productForSaleForm.get('reason');
    }

    receiveData(data: any){
        this.selectedInventoryElement = data;
        this.inventoryUnitBase = this.selectedInventoryElement?.measure?.unitBase;
        this.elements = [];
        this.setInventoryElementElements();
    }

    setInventoryElementElements(){
        this.elements = [];
        // this.elements.push({icon : "scale", name : "Medida", value : rawMaterial.rawMaterialBase?.measure});
        this.elements.push({icon : "format_size", name : "Nombre", value : this.selectedInventoryElement?.productForSale?.finishedProduct?.name});
        this.elements.push({icon : "feed", name : "Descripción", value : this.selectedInventoryElement?.productForSale?.finishedProduct?.description});
        if(this.currentMeasureQuantity){
            this.elements.push({icon : "inbox", name : "Cantidad (" + this.inventoryUnitBase?.name + ")", value : this.currentMeasureQuantity});
        }
        // this.elements.push({icon : "shelves", name : "Disponible (" + this.inventoryElementMeasure?.unitBase?.name + ")", value : Number(this.inventoryElementMeasure?.unitBase?.quantity) * Number(this.selectedInventoryElement?.quantity) });
    }

    closeProductForSaleDialog(){
        this.onResetProductForSalelForm();
    }

    onResetProductForSalelForm(){
        this.productForSaleForm.reset();
        this.selectedInventoryElement = undefined;
        this.selectedMeasure = undefined;
        this.currentMeasureQuantity = 0;
        this.formQuantity = 0;
        this.modalSelectedQuantity = 0;
        this.modalUnitBaseTotalQuantity = 0;
        this.elements = [];
    }

    createProductForSaleFormGroup() {
        return new FormGroup({
            quantity: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/)]),
            reason: new FormControl('', [Validators.required, Validators.maxLength(50)])
        });
    }

}