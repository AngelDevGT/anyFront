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
    selector: 'page-add-edit-product-creation',
    templateUrl: 'add-edit-product-creation.component.html',
    styleUrls: ['add-edit-product-creation.component.scss']
})
export class AddEditProductCreationComponent implements OnInit{

    //Form
    orderForm!: FormGroup;
    finishedProductForm!: FormGroup;
    rawMaterialForm!: FormGroup;
    rawMaterialOrder?: RawMaterialOrder;
    selectedMeasure?: Measure;
    selectedMeasureSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    modalSelectedMeasure?: Measure;
    currentMeasurePrice?: number;
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
    finishedProductMeasureQuantity = 0;
    modalFinishedProductSelectedMeasure?: Measure;
    activityLogName = "Acciones de Producto en Inventario de Bodega";
    productType = 1;
    inventoryRoute = '/inventory/factory/finishedProduct';
    productLabel = 'Producto terminado';
    productFabricadoLabel = 'Producto terminado fabricado';
    registerLabel = 'Registrar Producto Terminado';


    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute,
        private imageCompress: NgxImageCompressService, private alertService: AlertService, private accountService: AccountService,
        private router: Router, private formBuilder: FormBuilder, private modalService: NgbModal) {

            this.selectedMeasureSubject.subscribe(value => {
                this.setMeasure(String(value));
            });

    }


    ngOnInit(): void {

        this.productType = this.route.snapshot.data['productType'] ?? 1;
        this.inventoryRoute = this.productType === 2 ? '/inventory/factory/abarrote' : '/inventory/factory/finishedProduct';
        this.title = this.productType === 2 ? 'Registrar Abarrote en Inventario' : 'Registrar Producto Terminado en Inventario';
        this.productLabel = this.productType === 2 ? 'Abarrote' : 'Producto terminado';
        this.productFabricadoLabel = this.productType === 2 ? 'Abarrote registrado' : 'Producto terminado fabricado';
        this.registerLabel = this.productType === 2 ? 'Registrar Abarrote' : 'Registrar Producto Terminado';
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

        requestArray.push(this.dataService.getAnyComponent({}, 'getMeasure')); // measureRequest
        // requestArray.push(this.dataService.getInventory({ _id: "64d7240f838808573bd7e9ee"}));
        requestArray.push(this.dataService.getAllFinishedProductByFilter({ status_id: 36}));

        if (this.id){
            requestArray.push(this.dataService.getRawMaterialOrderById(this.id));
        }

        let inventory: Inventory;

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.measureOptions = this.dataService.findJsonValue(result[0], 'json_result') || [];
                this.finishedProductMeasureOptions = this.dataService.findJsonValue(result[0], 'json_result') || [];
                this.filteredMeasureOptions = this.dataService.findJsonValue(result[0], 'json_result') || [];
                this.filteredFinishedProductMeasureOptions = this.dataService.findJsonValue(result[0], 'json_result') || [];
                // inventory = result[2].getInventoryResponse?.Inventory;
                // this.filteredRawMaterials = result[2].retrieveRawMaterialByProviderResponse?.rawMaterial;
                // this.finishedProducts = result[3].retrieveFinishedProductResponse.FinishedProducts;
                const allProducts = this.dataService.findJsonValue(result[1], 'json_result') || [];
                this.finishedProducts = allProducts.filter((p: any) => (p.finishedProductTypeId ?? 1) === this.productType);
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                // this.inventoryElements = inventory.inventoryElements;
                this.loading = false;
            }
        });

    }

    setEditOptions(){
        if(this.editOption != null){
            switch(this.editOption){
                case 'edit':
                    this.title = 'Actualizar Pedido de Materia Prima';
                    this.isEditOption = true;
                    break;
                case 'receive':
                    this.title = 'Recibir Pedido de Materia Prima';
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

        let inventoryElementsToConsume = this.finishedProductCreationProducedElements?.map(fpcElement => {
            return {
                inventoryType: 'finished_product',
                unitName: 'bodega',
                elementId: fpcElement.finishedProductID,
                measureId: fpcElement.measure?.id,
                quantity: fpcElement.quantity,
                creatorUserId: this.accountService.userValue.uuid,
                comment: "Registro de Producto Terminado en Inventario de Bodega",
                actionTypeId: actionTypeValues.register_fp_by_creation.actionType.id,
            };
        });

        this.dataService.multiAddRemoveInventoryElement(inventoryElementsToConsume)
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

    onSaveMaterialForm(){
        console.log(this.selectedIE);
        let newFinishedProductCreationConsumedElement: FinishedProductCreationConsumedElement = {
            rawMaterialID: this.selectedIE?.rawMaterialBase?.id,
            rawMaterialName: this.selectedIE?.rawMaterialBase?.name,
            measure: this.modalSelectedMeasure,
            quantity: this.modalQuantity.toFixed(2)
        }
        this.finishedProductCreationConsumedElements?.push(newFinishedProductCreationConsumedElement);
        this.findAndMoveInventoryElementById(true, this.selectedIE?.rawMaterialBase?.id);
        this.onResetMaterialForm();
    }

    onSaveFinishedProductForm(){
        console.log("selectedFinishedProduct: " + this.selectedFinishedProduct);
        let newFinishedProductCreationProducedElement: FinishedProductCreationProducedElement = {
            finishedProductID: this.selectedFinishedProduct?.id,
            finishedProductName: this.selectedFinishedProduct?.name,
            measure: this.modalFinishedProductSelectedMeasure,
            quantity: String(this.modalFinishedProductQuantity)
        }
        this.finishedProductCreationProducedElements?.push(newFinishedProductCreationProducedElement);
        this.findAndMoveFinishedProductById(true, this.selectedFinishedProduct?.id);
        this.onResetFinishedProductForm();
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
        console.log(this.finishedProductCreationConsumedElements);
        console.log(this.unselectedInventoryElements);
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
        console.log(this.finishedProductCreationProducedElements);
        console.log(this.unselectedFinishedProductElements);
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