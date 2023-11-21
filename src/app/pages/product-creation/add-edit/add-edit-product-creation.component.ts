import { Component, OnInit } from '@angular/core';
import {BehaviorSubject, Observable, forkJoin, of} from 'rxjs';
import {concatMap, first, map, startWith} from 'rxjs/operators';
import {
    DataUrl,
    DOC_ORIENTATION,
    NgxImageCompressService,
    UploadResponse,
} from 'ngx-image-compress';

import { AccountService, statusValues, AlertService, DataService, paymentStatusValues } from '@app/services';
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
import { FinishedProductCreationElement } from '@app/models/product/finished-product-creation-element.model';
import { FinishedProductCreation } from '@app/models/product/finished-product-creation.model';

@Component({ 
    selector: 'page-add-edit-product-creation',
    templateUrl: 'add-edit-product-creation.component.html',
    styleUrls: ['add-edit-product-creation.component.scss']
})
export class AddEditProductCreationComponent implements OnInit{

    //Form
    orderForm!: FormGroup;
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
    elements: any = [];
    measureOptions?: Measure[];
    filteredMeasureOptions?: Measure[];
    rawMaterialIndexToRemove?: number;
    cardPhoto = undefined;
    finishedProductMeasureOptions?: Measure[];
    filteredFinishedProductMeasureOptions?: Measure[];
    selectedFinishedProduct?: FinishedProduct;
    finishedProducts?: FinishedProduct[];
    finishedProductsElements?: any;
    finishedProductQuantity = 0;
    inventoryElements?: InventoryElement[];
    finishedProductCreationElements?: FinishedProductCreationElement[];
    currentMeasureQuantity = 0;
    modalSelectedQuantity = 0;
    unselectedInventoryElements?: InventoryElement[];


    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute,
        private imageCompress: NgxImageCompressService, private alertService: AlertService,
        private router: Router, private formBuilder: FormBuilder, private modalService: NgbModal) {

            this.selectedMeasureSubject.subscribe(value => {
                this.setMeasure(String(value));
            });

    }


    ngOnInit(): void {

        this.title = 'Registrar Producto Terminado en Inventario';
        this.id = this.route.snapshot.params['id'];
        this.route.queryParams.subscribe(params => {
            this.editOption = params['opt'];
        });
        this.setEditOptions();

        this.orderForm = this.createFormGroup();
        this.rawMaterialForm = this.createMaterialFormGroup();

        this.rawMaterials = [];
        this.finishedProducts = [];
        this.filteredRawMaterials = this.rawMaterials;
        this.unselectedRawMaterials = [];
        this.selectedRawMaterials = [];
        this.rawMaterialOrderElements = [];
        this.finishedProductCreationElements = [];
        this.unselectedInventoryElements = [];

        let requestArray = [];

        requestArray.push(this.dataService.getAllProvidersByFilter({"status": 1})); // providerRequest
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "measure", enableElements: "true"})); // measureRequest
        requestArray.push(this.dataService.getInventory({ _id: "64d7240f838808573bd7e9ee"}));
        requestArray.push(this.dataService.getAllFinishedProductByFilter({ status: { id: 2}}));

        if (this.id){
            requestArray.push(this.dataService.getRawMaterialOrderById(this.id));
        }

        let inventory: Inventory;

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.providerOptions = result[0].retrieveProviderResponse?.providers;
                this.measureOptions = result[1].retrieveCatalogGenericResponse.elements;
                this.finishedProductMeasureOptions = result[1].retrieveCatalogGenericResponse.elements;
                this.filteredMeasureOptions = result[1].retrieveCatalogGenericResponse.elements;
                this.filteredFinishedProductMeasureOptions = result[1].retrieveCatalogGenericResponse.elements;
                inventory = result[2].getInventoryResponse?.Inventory;
                this.filteredRawMaterials = result[2].retrieveRawMaterialByProviderResponse?.rawMaterial;
                this.finishedProducts = result[3].retrieveFinishedProductResponse.FinishedProducts;
                if (this.id){
                    this.rawMaterialOrder = result[4].GetRawMaterialOrderResponse?.rawMaterial;
                }
                // console.log(respuestaPeticion1, respuestaPeticion2, respuestaPeticion3);
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.inventoryElements = inventory.inventoryElements;
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
            this.findAndMoveRawMaterialById(true, rawMaterialOrder.rawMaterialByProvider?._id);
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

    onSaveForm() {
        this.alertService.clear();
        this.submitting = true;
        let finishedProductCreation: FinishedProductCreation = {
            destinyFinishedProductInventoryID: "64d7dae896457636c3f181e9",
            originRawMaterialInventoryID: "64d7240f838808573bd7e9ee",
            finishedProductCreatedID: this.selectedFinishedProduct?._id,
            quantity: String(this.finishedProductQuantity),
            measure: this.selectedMeasure
        }
        finishedProductCreation.rawMaterialList = this.finishedProductCreationElements;
        console.log(finishedProductCreation);
        // this.saveOrder()
        this.dataService.registerFinishedProductCreation(finishedProductCreation)
            .pipe(first())
                .subscribe({
                    next: () => {
                        this.alertService.success('Producto registrado en inventario correctamente', { keepAfterRouteChange: true });
                        this.router.navigateByUrl('/inventory/factory/finishedProduct');
                    },
                    error: error => {
                        let errorResponse = error.error;
                        errorResponse = errorResponse.addProductResponse ? errorResponse.addProductResponse : errorResponse.updateRawMaterial ? errorResponse.updateRawMaterial : 'Error, consulte con el administrador';
                        this.alertService.error(errorResponse.AcknowledgementDescription);
                        this.submitting = false;
                    }
                });
    }

    private saveOrder(){
        if(this.id){
            let updatedRawMaterialOrder: RawMaterialOrder = {
                ...this.rawMaterialOrder,
                ...this.orderForm.value
            }
            switch(this.editOption){
                case 'edit':
                    break;
                case 'receive':
                    if(this.paidAmount >= this.total){
                        updatedRawMaterialOrder.pendingAmount = "0";
                        updatedRawMaterialOrder.paidAmount = String(this.total.toFixed(2));
                        updatedRawMaterialOrder.paymentStatus = paymentStatusValues.pagado.paymentStatus;
                    } else {
                        updatedRawMaterialOrder.paidAmount = String(this.paidAmount.toFixed(2));
                        updatedRawMaterialOrder.pendingAmount = String(this.pendingAmount.toFixed(2));
                        updatedRawMaterialOrder.paymentStatus = paymentStatusValues.abonado.paymentStatus;
                    }
                    updatedRawMaterialOrder.paymentType = this.rawMaterialOrder?.paymentType;
                    updatedRawMaterialOrder.rawMaterialOrderElements = this.rawMaterialOrderElements;
                    updatedRawMaterialOrder.finalAmount = String(this.total);
                    updatedRawMaterialOrder.status = statusValues.recibido.status;
                    break;
            }
            return this.dataService.updateRawMaterialOrder(updatedRawMaterialOrder);
        } else {
            let newRawMaterialOrder = {
                ...this.orderForm.value,
                rawMaterialOrderElements: this.rawMaterialOrderElements,
                pendingAmount: this.total.toFixed(2),
                paidAmount: "0",
                finalAmount: this.total.toFixed(2)
            }
            return this.dataService.addRawMaterialOrder(newRawMaterialOrder);
        }
    }

    onSaveMaterialForm(){
        console.log(this.selectedIE);
        let newFinishedProductCreationElement: FinishedProductCreationElement = {
            rawMaterialID: this.selectedIE?.rawMaterialBase?._id,
            rawMaterialName: this.selectedIE?.rawMaterialBase?.name,
            measure: this.modalSelectedMeasure,
            quantity: String(this.modalQuantity)
        }
        console.log(newFinishedProductCreationElement);
        this.finishedProductCreationElements?.push(newFinishedProductCreationElement);
        console.log(this.finishedProductCreationElements);
        this.findAndMoveInventoryElementById(true, this.selectedIE?.rawMaterialBase?._id);
        console.log(this.unselectedInventoryElements);
        this.onResetMaterialForm();
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
        return this.providerOptions?.find(provider => String(provider._id) === providerId);
    }

    findPaymentType(paymentId?: string){
        return this.paymentTypeOptions?.find(payment => String(payment.id) === paymentId);
    }

    findAndMoveRawMaterialById(isSelect: boolean, rawMaterialId?: string){
        if (isSelect){
            let rawMaterialResult = this.filteredRawMaterials?.find(rawMaterial => rawMaterial._id === rawMaterialId);
            if (rawMaterialResult) {
                this.filteredRawMaterials = this.filteredRawMaterials?.filter(rawMaterial => rawMaterial._id !== rawMaterialId);
                this.unselectedRawMaterials?.push(rawMaterialResult);
            }
        } else { // unselect
            let rawMaterialResult = this.unselectedRawMaterials?.find(rawMaterial => rawMaterial._id === rawMaterialId);
            if (rawMaterialResult){
                this.unselectedRawMaterials = this.unselectedRawMaterials?.filter(rawMaterial => rawMaterial._id !== rawMaterialId);
                this.filteredRawMaterials?.push(rawMaterialResult);
            }
        }
    }

    findAndMoveInventoryElementById(isSelect: boolean, inventoryElementId?: string){
        if(isSelect){
            let inventoryElementResult = this.inventoryElements?.find(invElement => invElement.rawMaterialBase?._id === inventoryElementId);
            if(inventoryElementResult){
                this.inventoryElements = this.inventoryElements?.filter(invElement => invElement.rawMaterialBase?._id !== inventoryElementId);
                this.unselectedInventoryElements?.push(inventoryElementResult);
            }
        } else {
            let inventoryElementResult = this.unselectedInventoryElements?.find(invElement => invElement.rawMaterialBase?._id === inventoryElementId);
            if(inventoryElementResult){
                this.unselectedInventoryElements = this.unselectedInventoryElements?.filter(invElement => invElement.rawMaterialBase?._id !== inventoryElementId);
                this.inventoryElements?.push(inventoryElementResult);
            }
        }
    }

    get f() {
        return this.orderForm.controls;
    }

    get r() {
        return this.rawMaterialForm.controls;
    }

    get modalMeasureSelect(){
        return this.rawMaterialForm.get('measure');
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

    unselectInventoryElement(fpcElement: FinishedProductCreationElement, indexToRemove: number){
        this.finishedProductCreationElements?.splice(indexToRemove, 1);
        this.findAndMoveInventoryElementById(false, fpcElement.rawMaterialID);
        console.log(this.finishedProductCreationElements);
        console.log(this.unselectedInventoryElements);
    }

    unselectRawMaterial(orderElement: RawMaterialOrderElement, indexToRemove: number){
        this.rawMaterialOrderElements?.splice(indexToRemove, 1);
        this.findAndMoveRawMaterialById(false, orderElement.rawMaterialByProvider?._id);
        // this.filteredRawMaterials?.push(orderElement.rawMaterialByProvider!);
    }

    selectFinishedProduct(finishedProduct: FinishedProduct){
        this.selectedFinishedProduct = finishedProduct;
        this.finishedProductsElements = [];
        this.setFinishedProductsElements(finishedProduct);
        this.filteredFinishedProductMeasureOptions = this.finishedProductMeasureOptions?.filter(item => this.selectedFinishedProduct?.measure?.identifier?.includes(item.unitBase?.name!));
    }

    unselectFinishedProduct(){
        this.measureSelect?.setValue('');
        this.quantityInput?.setValue('');
        this.selectedMeasure = undefined;
        this.selectedFinishedProduct = undefined;
        this.elements = [];
        this.cardPhoto = undefined;
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

    setInventoryElementElements(invElement: InventoryElement){
        // this.elements.push({icon : "scale", name : "Medida", value : rawMaterial.rawMaterialBase?.measure});
        this.elements.push({icon : "format_size", name : "Nombre", value : invElement?.rawMaterialBase?.name});
        this.elements.push({icon : "feed", name : "Descripción", value : invElement.rawMaterialBase?.description});
        // this.elements.push({icon : "monetization_on", name : "Cantidad (" + invElement.measure?.identifier + ")", value : invElement.quantity});
    }

    setFinishedProductsElements(finishedProduct: FinishedProduct){
        this.finishedProductsElements.push({icon : "inventory_2", name : "Nombre", value : finishedProduct.name});
        this.finishedProductsElements.push({icon : "scale", name : "Medida", value : finishedProduct.measure?.identifier});
        this.finishedProductsElements.push({icon : "feed", name : "Descripción", value : finishedProduct.description});
    }

    closeRawMaterialDialog(){
        this.onResetMaterialForm();
    }

}