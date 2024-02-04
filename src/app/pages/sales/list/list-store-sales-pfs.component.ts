import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
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
import { forkJoin } from 'rxjs';
import { MovementWarehouseToFactory } from '@app/models/inventory/movement-store-to-factory.model';
import { ActivatedRoute, Router } from '@angular/router';
import { ShopResume } from '@app/models/store/shop-resume.model';

@Component({ 
    templateUrl: 'list-store-sales-pfs.component.html',
    styleUrls: ['list-store-sales-pfs.component.scss']
})
export class ListStoreSalesPFSComponent implements OnInit {

    id?: string;
    submitting = false;
    storeName?: string;
    shopResumes?: ShopResume[];
    allShopResumes?: ShopResume[];
    selectedInventoryElement?: ShopResume;
    rawMaterialForm!: FormGroup;
    selectedMeasure?: Measure;
    elements: any = [];
    measureOptions?: Measure[];
    inventoryUnitBase?: UnitBase;
    currentMeasureQuantity = 0;
    filteredMeasureOptions?: Measure[];
    selectedQuantity = 0;
    formQuantity = 0;
    modalSelectedQuantity = 0;
    modalUnitBaseTotalQuantity = 0;
    searchTerm?: string;
    entries = [5, 10, 20, 50];
    pageSize = 5;
    page = 1;
    tableElementsValues?: any;
    tableHeaders = [
        {
            style: "width: 20%",
            name: "Producto"
        },
        {
            style: "width: 10%",
            name: "Medida"
        },
        {
            style: "width: 10%",
            name: "Cantidad"
        },
        {
            style: "width: 15%",
            name: "Estado"
        },
        {
            style: "width: 10%",
            name: "Acciones"
        }
    ];

    constructor(private dataService: DataService, private route: ActivatedRoute, private alertService: AlertService, private router: Router) {}

    ngOnInit() {
        this.id = this.route.snapshot.params['id'];
        this.route.queryParams.subscribe(params => {
            this.storeName = params['opt'];
        });
        let requestArray = [];

        requestArray.push(this.dataService.getAllInventoryByFilter({ _id: "65bf467e008f7e88678d3927"}));
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "measure", enableElements: "true"})); // measureRequest

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.shopResumes = result[0].retrieveShopHistoryResponse?.FinishedProducts;
                this.allShopResumes = this.shopResumes;
                this.measureOptions = result[1].retrieveCatalogGenericResponse.elements;
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.setTableElements(this.shopResumes);
            }
        });
        this.rawMaterialForm = this.createMaterialFormGroup();
    }

    search(value: any): void {
        if (this.allShopResumes){
            this.shopResumes = this.allShopResumes?.filter((val) => {
                if(this.searchTerm){
                    return true;
                    // const nameMatch = val.finishedProduct?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const measureMatch = val.finishedProduct?.measure?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());

                    // return nameMatch || measureMatch;
                }
                return true;
            });
        }
        this.setTableElements(this.shopResumes);
    }

    setTableElements(elements?: ShopResume[]){
        this.tableElementsValues = {
            headers: this.tableHeaders,
            rows: []
        }
        elements?.forEach((element: ShopResume) => {
            const curr_row = {
                row: [
                    { type: "text", value: element.itemsList?.x.finishedProduct?.name, header_name: "Producto" },
                    { type: "text", value: element.measure?.identifier, header_name: "Medida" },
                    { type: "text", value: element.quantity, header_name: "Cantidad" },
                    // { type: "text", value: this.dataService.getFormatedPrice(Number(element.rawMaterialByProvider?.price)), header_name: "Precio" },
                    { type: "text", value: element.status?.identifier, header_name: "Estado" },
                    // { type: "text", value: element.paymentStatus.identifier, header_name: "Estado de pago" },
                    // { type: "text", value: this.dataService.getFormatedPrice(Number(element.pendingAmount)), header_name: "Monto pendiente" },
                    {
                        type: "modal_button",
                        style: "white-space: nowrap",
                        data: element,
                        button: [
                            {
                                type: "button",
                                data_bs_target: "#removeInventoryRawMaterialModal",
                                class: "btn btn-danger btn-sm pb-0 mx-1",
                                icon: {
                                    class: "material-icons",
                                    icon: "delete_sweep"
                                }
                            }
                        ]
                    }
                  ],
            }
            this.tableElementsValues.rows.push(curr_row);
        });
    }

    get r() {
        return this.rawMaterialForm.controls;
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
        this.calculateModalQuantity();
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

    calculateModalQuantity() {
        let totalQuantity = Number(this.formQuantity)*Number(this.currentMeasureQuantity) || 0;
        this.modalUnitBaseTotalQuantity = Number(this.inventoryUnitBase?.quantity) * Number(this.selectedInventoryElement?.quantity);
        if(totalQuantity > this.modalUnitBaseTotalQuantity){
            this.quantityInput?.setValue('0');
            this.formQuantity = 0;
            totalQuantity = 0;
        }
        this.modalSelectedQuantity = totalQuantity;
    }

    onMoveMaterialForm(){
        this.submitting = true;
        let newMoveStoreToFactory: MovementWarehouseToFactory = {
            rawMaterialByProviderID: this.selectedInventoryElement?.rawMaterialByProvider?._id,
            factoryInventoryID: "64d7240f838808573bd7e9ee",
            quantity: String(this.formQuantity),
            measure: this.selectedMeasure
        }
        this.dataService.moveStoreToFactory(newMoveStoreToFactory)
        .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Movimiento de inventario realizado correctamente', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/inventory/warehouse/rawMaterialByProvider');
                },
                error: error => {
                    this.alertService.error('Error en movimiento de inventario, contacte con Administracion');
            }});
    }

    onDeleteMaterialForm(){

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
        // this.elements.push({icon : "scale", name : "Medida", value : rawMaterial.rawMaterialBase?.measure});
        this.elements.push({icon : "format_size", name : "Nombre", value : this.selectedInventoryElement?.rawMaterialByProvider?.rawMaterialBase?.name});
        this.elements.push({icon : "feed", name : "Descripción", value : this.selectedInventoryElement?.rawMaterialByProvider?.rawMaterialBase?.description});
        // this.elements.push({icon : "shelves", name : "Disponible (" + this.inventoryElementMeasure?.unitBase?.name + ")", value : Number(this.inventoryElementMeasure?.unitBase?.quantity) * Number(this.selectedInventoryElement?.quantity) });
    }

    closeRawMaterialDialog(){
        this.onResetMaterialForm();
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

    createMaterialFormGroup() {
        return new FormGroup({
            quantity: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/)]),
            measure: new FormControl('', [Validators.required])
        });
    }

}