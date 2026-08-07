import { Component, OnInit } from '@angular/core';
import {BehaviorSubject, Observable, forkJoin, of} from 'rxjs';
import {concatMap, first, map, startWith} from 'rxjs/operators';
import {
    DataUrl,
    DOC_ORIENTATION,
    NgxImageCompressService,
    UploadResponse,
} from 'ngx-image-compress';

import { AccountService, statusValues, AlertService, DataService, paymentStatusValues, actionTypeValues } from '@app/services';
import {
AbstractControl,
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';
import { Establishment } from '@app/models/establishment.model';
import { ActivatedRoute, Router } from '@angular/router';
import { Provider } from '@app/models/system/provider.model';
import { InventoryElement } from '@app/models/inventory/inventory-element.model';
import { RawMaterialOrderElement } from '@app/models/raw-material/raw-material-order-element.model';
import { RawMaterialByProvider } from '@app/models/raw-material/raw-material-by-provider.model';
import { Constant } from '@app/models/auxiliary/constant.model';
import { MatDialog } from '@angular/material/dialog';
import { Measure, PaymentStatus, PaymentType } from '@app/models';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FinishedProduct } from '@app/models/product/finished-product.model';
import { RawMaterialBase } from '@app/models/raw-material/raw-material-base.model';
import { Inventory } from '@app/models/inventory/inventory.model';
import { FinishedProductCreationConsumedElement } from '@app/models/product/fp-creation-consumed-element.model';
import { FinishedProductCreation } from '@app/models/product/finished-product-creation.model';
import { FinishedProductCreationProducedElement } from '@app/models/product/fp-creation-produced-element.model';
import { ActivityLog } from '@app/models/system/activity-log';

@Component({ 
    selector: 'page-consume-raw-material',
    templateUrl: 'consume-raw-material.component.html',
    styleUrls: ['consume-raw-material.component.scss']
})
export class ConsumeRawMaterialComponent implements OnInit{

    //Form
    orderForm!: FormGroup;
    finishedProductForm!: FormGroup;
    rawMaterialForm!: FormGroup;
    rawMaterialOrder?: RawMaterialOrder;
    selectedMeasure?: Measure;
    selectedMeasureSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    modalSelectedMeasure?: Measure;
    currentMeasurePrice?: number;
    providerOptions?: Provider[];
    paymentTypeOptions?: PaymentType[];
    constantes?: Constant[];
    rawMaterials?: RawMaterialBase[];
    filteredRawMaterials?: RawMaterialBase[];
    unselectedRawMaterials?: RawMaterialBase[];
    selectedRawMaterials?: InventoryElement[];
    rawMaterialOrderElements?: RawMaterialOrderElement[];
    totalDiscount = 0;
    subtotal = 0;
    total = 0;
    paidAmount = 0;
    pendingAmount = 0;
    modalQuantity = 0;
    modalDiscount = 0;
    modalTotalDiscount = 0;
    modalSubtotal = 0;
    modalTotal = 0;
    modalTotalDiscountText?: string;
    modalSubtotalText?: string;
    modalTotalText?: string;
    id?: string;
    editOption?: string;
    isEditOption?: Boolean = false;
    isReceiveOption?: Boolean = false;
    title!: string;
    confirmDialogTitle = '...';
    confirmDialogText = '...';
    warningDialogText?: string;
    confirmDialogId = 0;
    loading = true;
    submitting = false;
    hasErrors = false;
    displayStyle = false;
    selectedRMP?: RawMaterialByProvider;
    selectedIE?: InventoryElement;
    inventory?: Inventory;
    elements: any = [];
    measureOptions?: Measure[];
    filteredMeasureOptions?: Measure[];
    rawMaterialIndexToRemove?: number;
    cardPhoto = undefined;
    finishedProductMeasureOptions?: Measure[];
    filteredFinishedProductMeasureOptions?: Measure[];
    selectedFinishedProduct?: FinishedProduct;
    finishedProducts?: FinishedProduct[];
    modalFinishedProductsElements?: any;
    finishedProductQuantity = 0;
    inventoryElements?: InventoryElement[];
    finishedProductCreationConsumedElements?: FinishedProductCreationConsumedElement[];
    finishedProductCreationProducedElements?: FinishedProductCreationProducedElement[];
    finishedProductElements?: FinishedProduct[];
    unselectedFinishedProductElements?: FinishedProduct[];
    currentMeasureQuantity = 0;
    modalSelectedQuantity = 0;
    unselectedInventoryElements?: InventoryElement[];
    modalFinishedProductQuantity = 0;
    rmSearchTerm?: string;
    isEditMode = false;
    editingIndex?: number;

    get filteredInventoryElements(): InventoryElement[] | undefined {
        if (!this.rmSearchTerm) return this.inventoryElements;
        const term = this.rmSearchTerm.toLowerCase();
        return this.inventoryElements?.filter(el =>
            el.rawMaterialBase?.name?.toLowerCase().includes(term)
        );
    }
    finishedProductMeasureQuantity = 0;
    modalFinishedProductSelectedMeasure?: Measure;
    activityLogName = "Acciones de Materia Prima en Inventario de Bodega";
    materialType = 1;
    redirectRoute = '/inventory/factory/rawMaterial';


    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute,
        private imageCompress: NgxImageCompressService, private alertService: AlertService, private accountService: AccountService,
        private router: Router, private formBuilder: FormBuilder, private modalService: NgbModal) {

            this.selectedMeasureSubject.subscribe(value => {
                this.setMeasure(String(value));
            });

    }


    ngOnInit(): void {

        this.materialType = this.route.snapshot.data['materialType'] ?? 1;
        if (this.materialType === 2) {
            this.title = 'Consumir material de empaque de inventario';
            this.activityLogName = 'Acciones de Material de Empaque en Inventario de Bodega';
            this.redirectRoute = '/inventory/warehouse/packagingMaterial';
        } else {
            this.title = 'Consumir materia prima de inventario';
        }
        this.id = this.route.snapshot.params['id'];
        this.route.queryParams.subscribe(params => {
            this.editOption = params['opt'];
        });
        this.setEditOptions();

        this.orderForm = this.createFormGroup();
        this.rawMaterialForm = this.createMaterialFormGroup();
        this.finishedProductForm = this.createFinishedProductFormGroup();

        this.rawMaterials = [];
        this.finishedProducts = [];
        this.filteredRawMaterials = this.rawMaterials;
        this.unselectedRawMaterials = [];
        this.selectedRawMaterials = [];
        this.rawMaterialOrderElements = [];
        this.finishedProductCreationConsumedElements = [];
        this.finishedProductCreationProducedElements = [];
        this.finishedProductElements = [];
        this.unselectedInventoryElements = [];
        this.unselectedFinishedProductElements = [];

        let requestArray = [];

        const inventoryQuery = this.materialType === 2 ? 'retrievePackagingMaterialInventoryV3' : 'retrieveRawMaterialInventoryV3';
        requestArray.push(this.dataService.getAllProvidersByFilter({"status_id": 30})); // providerRequest
        requestArray.push(this.dataService.getAnyComponent({}, 'getMeasure')); // measureRequest
        requestArray.push(this.dataService.getInventoryByType({}, inventoryQuery));
        // requestArray.push(this.dataService.getAllFinishedProductByFilter({ status: { id: 2}}));

        // if (this.id){
        //     requestArray.push(this.dataService.getRawMaterialOrderById(this.id));
        // }

        let inventory: Inventory;

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.providerOptions = result[0].retrieveProviderResponse?.data[0]?.json_result || null;
                this.measureOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];
                this.finishedProductMeasureOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];
                this.filteredMeasureOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];
                this.filteredFinishedProductMeasureOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];
                inventory = this.dataService.findJsonValue(result[2], 'json_result') || {};
                this.filteredRawMaterials = this.dataService.findJsonValue(inventory, 'json_result') || [];
                // this.finishedProducts = result[3].retrieveFinishedProductResponse.FinishedProducts;
                // console.log(respuestaPeticion1, respuestaPeticion2, respuestaPeticion3);
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.inventory = inventory;
                this.inventoryElements = inventory.inventoryElements;
                this.loading = false;
            }
        });

    }

    setEditOptions(){
        if(this.editOption != null){
            const materialLabel = this.materialType === 2 ? 'Material de Empaque' : 'Materia Prima';
            switch(this.editOption){
                case 'edit':
                    this.title = `Actualizar Pedido de ${materialLabel}`;
                    this.isEditOption = true;
                    break;
                case 'receive':
                    this.title = `Recibir Pedido de ${materialLabel}`;
                    this.isReceiveOption = true;
                    break;
            }
        }
    }

    loadRawMaterialOrder(){
        this.orderForm.patchValue(this.rawMaterialOrder!);
        this.rawMaterialOrderElements = this.rawMaterialOrder?.rawMaterialOrderElements;
        this.rawMaterialOrder?.rawMaterialOrderElements?.forEach(rawMaterialOrder => {
            this.findAndMoveRawMaterialById(true, rawMaterialOrder.rawMaterialByProvider?.id);
        });
    }

    onResetForm() {
        this.orderForm.reset();
    }

    onResetMaterialForm(){
        this.rawMaterialForm.reset();
        this.selectedIE = undefined;
        this.modalSelectedMeasure = undefined;
        this.modalQuantity = 0;
        this.currentMeasureQuantity = 0;
        this.elements = [];
        this.isEditMode = false;
        this.editingIndex = undefined;
    }

    onResetFinishedProductForm(){
        this.finishedProductForm.reset();
        this.selectedFinishedProduct = undefined;
        this.modalFinishedProductSelectedMeasure = undefined;
        this.modalFinishedProductQuantity = 0;
        this.finishedProductMeasureQuantity = 0;
        this.modalFinishedProductsElements = [];
    }

    onSaveForm() {
        this.alertService.clear();
        this.submitting = true;

        let inventoryElementsToConsume = this.finishedProductCreationConsumedElements?.map(fpcElement => {
            return {
                inventoryType: this.inventory?.inventoryType,
                unitName: this.inventory?.unitName,
                elementId: fpcElement.rawMaterialID,
                measureId: fpcElement.measure?.id,
                quantity: fpcElement.quantity,
                creatorUserId: this.accountService.userValue.uuid,
                comment: this.orderForm.get('comment')?.value,
                actionTypeId: actionTypeValues.remove_rm_by_consume.actionType.id,
            };
        });

        const successMessage = this.materialType === 2
            ? 'Material(es) de empaque consumido(s) correctamente'
            : 'Materia(s) prima(s) consumida(s) correctamente';
        const errorMessage = this.materialType === 2
            ? 'Error al consumir material de empaque'
            : 'Error al consumir materia prima';

        this.dataService.multiAddRemoveInventoryElement(inventoryElementsToConsume)
            .pipe(first())
                .subscribe({
                    next: () => {
                        this.alertService.success(successMessage, { keepAfterRouteChange: true });
                        this.router.navigateByUrl(this.redirectRoute);
                    },
                    error: error => {
                        let errorResponse = this.dataService.getErrorMessageResponse(error, errorMessage);
                        this.alertService.error(errorResponse);
                        this.submitting = false;
                    }
                });
    }

    // private saveOrder(){
    //     if(this.id){
    //         let updatedRawMaterialOrder: RawMaterialOrder = {
    //             ...this.rawMaterialOrder,
    //             ...this.orderForm.value
    //         }
    //         switch(this.editOption){
    //             case 'edit':
    //                 break;
    //             case 'receive':
    //                 if(this.paidAmount >= this.total){
    //                     updatedRawMaterialOrder.pendingAmount = "0";
    //                     updatedRawMaterialOrder.paidAmount = String(this.total.toFixed(2));
    //                     updatedRawMaterialOrder.paymentStatus = paymentStatusValues.pagado.status;
    //                 } else {
    //                     updatedRawMaterialOrder.paidAmount = String(this.paidAmount.toFixed(2));
    //                     updatedRawMaterialOrder.pendingAmount = String(this.pendingAmount.toFixed(2));
    //                     updatedRawMaterialOrder.paymentStatus = paymentStatusValues.abonado.status;
    //                 }
    //                 updatedRawMaterialOrder.paymentType = this.rawMaterialOrder?.paymentType;
    //                 updatedRawMaterialOrder.rawMaterialOrderElements = this.rawMaterialOrderElements;
    //                 updatedRawMaterialOrder.finalAmount = String(this.total);
    //                 updatedRawMaterialOrder.status = statusValues.recibido.status;
    //                 break;
    //         }
    //         return this.dataService.updateRawMaterialOrder(updatedRawMaterialOrder);
    //     } else {
    //         let newRawMaterialOrder = {
    //             ...this.orderForm.value,
    //             rawMaterialOrderElements: this.rawMaterialOrderElements,
    //             pendingAmount: this.total.toFixed(2),
    //             paidAmount: "0",
    //             finalAmount: this.total.toFixed(2)
    //         }
    //         return this.dataService.addRawMaterialOrder(newRawMaterialOrder);
    //     }
    // }

    onSaveMaterialForm(){
        if (this.isEditMode && this.editingIndex !== undefined) {
            let updatedElement: FinishedProductCreationConsumedElement = {
                rawMaterialID: this.selectedIE?.rawMaterialBase?.id,
                rawMaterialName: this.selectedIE?.rawMaterialBase?.name,
                measure: this.modalSelectedMeasure,
                quantity: this.modalQuantity.toFixed(2)
            };
            this.finishedProductCreationConsumedElements![this.editingIndex] = updatedElement;
        } else {
            let newFinishedProductCreationConsumedElement: FinishedProductCreationConsumedElement = {
                rawMaterialID: this.selectedIE?.rawMaterialBase?.id,
                rawMaterialName: this.selectedIE?.rawMaterialBase?.name,
                measure: this.modalSelectedMeasure,
                quantity: this.modalQuantity.toFixed(2)
            };
            this.finishedProductCreationConsumedElements?.push(newFinishedProductCreationConsumedElement);
            this.findAndMoveInventoryElementById(true, this.selectedIE?.rawMaterialBase?.id);
        }
        this.onResetMaterialForm();
    }

    selectInventoryElementForEdit(fpcElement: FinishedProductCreationConsumedElement, index: number){
        const invElement = this.unselectedInventoryElements?.find(
            el => el.rawMaterialBase?.id === fpcElement.rawMaterialID
        );
        if (!invElement) return;

        this.isEditMode = true;
        this.editingIndex = index;
        this.selectedIE = invElement;
        this.elements = [];
        this.setInventoryElementElements(invElement);
        this.filteredMeasureOptions = this.measureOptions?.filter(
            item => invElement.rawMaterialBase?.measure?.identifier?.includes(item.unitBase?.name!)
        );
        this.modalMeasureSelect?.setValue(String(fpcElement.measure?.id));
        this.changeMeasure(String(fpcElement.measure?.id));
        this.rawMaterialForm.get('quantity')?.setValue(fpcElement.quantity);
        this.modalQuantity = Number(fpcElement.quantity);
        this.calculateModalQuantity();
    }

    setMeasure(measureId: string){
        if(measureId){
            this.selectedMeasure = this.measureOptions?.find(meas => String(meas.id) === measureId);
        }
    }

    onReceiveDialog(){
        this.confirmDialogTitle = 'Recibir Pedido';
        if(this.pendingAmount < 0){
            this.confirmDialogText = 'El monto abonado (Q. ' + this.paidAmount + ') es mayor al total (Q. ' + this.total + '). ¿Deseas marcar el pedido como recibido?';
            this.warningDialogText = 'IMPORTANTE: EL MONTO ABONADO CAMBIARA A SER EL MISMO QUE EL MONTO FINAL';
        } else {
            this.confirmDialogText = '¿Deseas marcar el pedido como recibido?';
            this.warningDialogText = undefined;
        }
        this.confirmDialogId = 1;
    }

    onConfirmDialog(){
        this.submitting = true;
        if(this.confirmDialogId == 1){
            this.onSaveForm();
        }
    }

    selectMeasure(measureId?: string){
        return this.measureOptions?.find(measure => String(measure.id) === measureId);
    }

    findProviderById(providerId?: string){
        return this.providerOptions?.find(provider => String(provider.id) === providerId);
    }

    findPaymentType(paymentId?: string){
        return this.paymentTypeOptions?.find(payment => String(payment.id) === paymentId);
    }

    findAndMoveRawMaterialById(isSelect: boolean, rawMaterialId?: string){
        if (isSelect){
            let rawMaterialResult = this.filteredRawMaterials?.find(rawMaterial => rawMaterial.id === rawMaterialId);
            if (rawMaterialResult) {
                this.filteredRawMaterials = this.filteredRawMaterials?.filter(rawMaterial => rawMaterial.id !== rawMaterialId);
                this.unselectedRawMaterials?.push(rawMaterialResult);
            }
        } else { // unselect
            let rawMaterialResult = this.unselectedRawMaterials?.find(rawMaterial => rawMaterial.id === rawMaterialId);
            if (rawMaterialResult){
                this.unselectedRawMaterials = this.unselectedRawMaterials?.filter(rawMaterial => rawMaterial.id !== rawMaterialId);
                this.filteredRawMaterials?.push(rawMaterialResult);
            }
        }
    }

    findAndMoveInventoryElementById(isSelect: boolean, inventoryElementId?: string){
        if(isSelect){
            let inventoryElementResult = this.inventoryElements?.find(invElement => invElement.rawMaterialBase?.id === inventoryElementId);
            if(inventoryElementResult){
                this.inventoryElements = this.inventoryElements?.filter(invElement => invElement.rawMaterialBase?.id !== inventoryElementId);
                this.unselectedInventoryElements?.push(inventoryElementResult);
            }
        } else {
            let inventoryElementResult = this.unselectedInventoryElements?.find(invElement => invElement.rawMaterialBase?.id === inventoryElementId);
            if(inventoryElementResult){
                this.unselectedInventoryElements = this.unselectedInventoryElements?.filter(invElement => invElement.rawMaterialBase?.id !== inventoryElementId);
                this.inventoryElements?.push(inventoryElementResult);
            }
        }
    }

    findAndMoveFinishedProductById(isSelect: boolean, finishedProductId?: string){
        if(isSelect){
            let finishedProductResult = this.finishedProducts?.find(fpElement => fpElement?.id === finishedProductId);
            if(finishedProductResult){
                this.finishedProducts = this.finishedProducts?.filter(fpElement => fpElement?.id !== finishedProductId);
                this.unselectedFinishedProductElements?.push(finishedProductResult);
            }
        } else {
            let finishedProductResult = this.unselectedFinishedProductElements?.find(fpElement => fpElement?.id === finishedProductId);
            if(finishedProductResult){
                this.unselectedFinishedProductElements = this.unselectedFinishedProductElements?.filter(fpElement => fpElement?.id !== finishedProductId);
                this.finishedProducts?.push(finishedProductResult);
            }
        }
    }

    get f() {
        return this.orderForm.controls;
    }

    get r() {
        return this.rawMaterialForm.controls;
    }

    get fp() {
        return this.finishedProductForm.controls;
    }

    get modalMeasureSelect(){
        return this.rawMaterialForm.get('measure');
    }

    get modalFinishedProductMeasureSelect(){
        return this.finishedProductForm.get('measure');
    }

    get measureSelect(){
        return this.orderForm.get('measure');
    }

    get quantityInput(){
        return this.orderForm.get('quantity');
    }

    get modalQuantityInput(){
        return this.rawMaterialForm.get('quantity');
    }

    get discountInput(){
        return this.rawMaterialForm.get('discount');
    }

    changeMeasure(measureId: any){
        if(measureId){
            if(this.modalSelectedMeasure){
                this.elements.pop();
            }
            this.modalSelectedMeasure = this.selectMeasure(measureId);
            this.currentMeasureQuantity = Number(this.modalSelectedMeasure?.unitBase?.quantity);
            this.elements.push({icon : "inbox", name : "Cantidad (" + this.selectedIE?.measure?.identifier + ")", value : this.currentMeasureQuantity});
        }
        this.calculateModalQuantity();
    }

    changeFinishedProductMeasure(measureId: any){
        if(measureId){
            if(this.modalFinishedProductSelectedMeasure){
                this.modalFinishedProductsElements.pop();
            }
            this.modalFinishedProductSelectedMeasure = this.selectMeasure(measureId);
            this.finishedProductMeasureQuantity = Number(this.modalFinishedProductSelectedMeasure?.unitBase?.quantity);
            this.modalFinishedProductsElements.push({icon : "inbox", name : "Cantidad (" + this.selectedFinishedProduct?.measure?.identifier + ")", value : this.finishedProductMeasureQuantity});
        }
    }

    selectInventoryElement(invElement: InventoryElement, indexToRemove: number){
        // this.selectedRMP = rawMaterial;
        this.selectedIE = invElement;
        this.elements = [];
        this.setInventoryElementElements(invElement);
        this.filteredMeasureOptions = this.measureOptions?.filter(item => invElement.rawMaterialBase?.measure?.identifier?.includes(item.unitBase?.name!));
        this.modalMeasureSelect?.setValue('');
        // this.rawMaterialIndexToRemove = indexToRemove;
        // let newOrderElement: RawMaterialOrderElement = {
        //     rawMaterialByProvider: rawMaterial,
        //     price: rawMaterial.price,
        //     discount: "0",
        //     quantity: "1"
        // };
        // this.rawMaterialOrderElements?.push(newOrderElement);
    }

    unselectInventoryElement(fpcElement: FinishedProductCreationConsumedElement, indexToRemove: number){
        this.finishedProductCreationConsumedElements?.splice(indexToRemove, 1);
        this.findAndMoveInventoryElementById(false, fpcElement.rawMaterialID);
        // console.log(this.finishedProductCreationConsumedElements);
        // console.log(this.unselectedInventoryElements);
    }

    unselectRawMaterial(orderElement: RawMaterialOrderElement, indexToRemove: number){
        this.rawMaterialOrderElements?.splice(indexToRemove, 1);
        this.findAndMoveRawMaterialById(false, orderElement.rawMaterialByProvider?.id);
        // this.filteredRawMaterials?.push(orderElement.rawMaterialByProvider!);
    }

    selectFinishedProduct(finishedProduct: FinishedProduct){
        this.selectedFinishedProduct = finishedProduct;
        this.modalFinishedProductsElements = [];
        this.setFinishedProductsElements(finishedProduct);
        this.filteredFinishedProductMeasureOptions = this.finishedProductMeasureOptions?.filter(item => this.selectedFinishedProduct?.measure?.identifier?.includes(item.unitBase?.name!));
        this.modalFinishedProductMeasureSelect?.setValue('');
    }

    unselectFinishedProduct(fppElement: FinishedProductCreationProducedElement, indexToRemove: number){
        this.finishedProductCreationProducedElements?.splice(indexToRemove, 1);
        this.findAndMoveFinishedProductById(false, fppElement.finishedProductID);
        // console.log(this.finishedProductCreationProducedElements);
        // console.log(this.unselectedFinishedProductElements);
    }

    calculateSubtotal() {
        let subtotal = 0;
        if (this.rawMaterialOrderElements){
            for(const orderElement of this.rawMaterialOrderElements){
                subtotal += Number(orderElement.price)*Number(orderElement.quantity) || 0;
            }
        }
        this.subtotal = subtotal;
        return subtotal;
    }

    calculateTotalDiscount() {
        let totalDiscount = 0;
        if (this.rawMaterialOrderElements){
            for (const orderElement of this.rawMaterialOrderElements) {
                totalDiscount += Number(orderElement.discount)*Number(orderElement.quantity) || 0;
            }
        }
        this.totalDiscount = totalDiscount;
        return totalDiscount;
    }

    calculateTotal(){
        this.total = this.subtotal - this.totalDiscount;
        return this.total;
    }

    calculatePaidAmount(){
        this.paidAmount = Number(this.rawMaterialOrder!.paidAmount);
        return this.paidAmount;
    }

    calculatePendingAmount(){
        this.pendingAmount = this.total - this.paidAmount;
        return this.pendingAmount;
    }

    calculateModalSubtotal() {
        let subtotal = 0;
        if (this.rawMaterialOrderElements){
            for(const orderElement of this.rawMaterialOrderElements){
                subtotal += Number(orderElement.price)*Number(orderElement.quantity) || 0;
            }
        }
        this.subtotal = subtotal;
        return subtotal;
    }

    calculateModalTotalDiscount() {
        let totalDiscount = 0;
        if (this.rawMaterialOrderElements){
            for (const orderElement of this.rawMaterialOrderElements) {
                totalDiscount += Number(orderElement.discount)*Number(orderElement.quantity) || 0;
            }
        }
        this.totalDiscount = totalDiscount;
        return totalDiscount;
    }

    calculateModalTotal(){
        this.total = this.subtotal - this.totalDiscount;
        return this.total;
    }

    setQuantityValue(event: Event){
        if (event.target instanceof HTMLInputElement) {
            this.finishedProductQuantity = Number(event.target.value) || 0;
        }
    }

    setModalQuantityValue(event: Event){
        if (event.target instanceof HTMLInputElement) {
            this.modalQuantity = Number(event.target.value) || 0;
        }
        this.calculateModalQuantity();
    }

    setFinishedProductModalQuantityValue(event: Event){
        if (event.target instanceof HTMLInputElement) {
            this.modalFinishedProductQuantity = Number(event.target.value) || 0;
        }
    }

    calculateModalQuantity() {
        let totalQuantity = Number(this.modalQuantity)*Number(this.currentMeasureQuantity) || 0;
        let unitBaseTotalQuantity = Number(this.selectedIE?.measure?.unitBase?.quantity) * Number(this.selectedIE?.quantity);
        if(totalQuantity > unitBaseTotalQuantity){
            this.modalQuantityInput?.setValue('0');
            this.modalQuantity = 0;
            totalQuantity = 0;
        }
        this.modalSelectedQuantity = totalQuantity;
    }

    createFormGroup() {
        return new FormGroup({
            measure: new FormControl('', [Validators.required]),
            quantity: new FormControl('', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
            comment: new FormControl('', [Validators.required, Validators.maxLength(254)]),
        });
    }

    createMaterialFormGroup() {
        return new FormGroup({
            quantity: new FormControl('', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
            measure: new FormControl('', [Validators.required])
        });
    }

    createFinishedProductFormGroup() {
        return new FormGroup({
            quantity: new FormControl('', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
            measure: new FormControl('', [Validators.required])
        });
    }

    setInventoryElementElements(invElement: InventoryElement){
        // this.elements.push({icon : "scale", name : "Medida", value : rawMaterial.rawMaterialBase?.measure});
        this.elements.push({icon : "format_size", name : "Nombre", value : invElement?.rawMaterialBase?.name});
        this.elements.push({icon : "feed", name : "Descripción", value : invElement.rawMaterialBase?.description});
        // this.elements.push({icon : "monetization_on", name : "Cantidad (" + invElement.measure?.identifier + ")", value : invElement.quantity});
    }

    setFinishedProductsElements(finishedProduct: FinishedProduct){
        this.modalFinishedProductsElements.push({icon : "inventory_2", name : "Nombre", value : finishedProduct.name});
        this.modalFinishedProductsElements.push({icon : "scale", name : "Medida", value : finishedProduct.measure?.identifier});
        this.modalFinishedProductsElements.push({icon : "feed", name : "Descripción", value : finishedProduct.description});
    }

    closeRawMaterialDialog(){
        this.onResetMaterialForm();
    }

    closeFinishedProductoDialog(){
        this.onResetFinishedProductForm();
    }

}