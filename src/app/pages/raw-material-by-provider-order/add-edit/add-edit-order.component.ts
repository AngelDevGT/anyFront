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
// import { DynamicDialogComponent } from '@app/components/dynamic-dialog/dynamic-dialog.component';

@Component({ 
    selector: 'page-add-edit-order',
    templateUrl: 'add-edit-order.component.html',
    styleUrls: ['add-edit-order.component.scss']
})
export class AddEditRawMaterialByProviderOrderComponent implements OnInit{

    //Form
    orderForm!: FormGroup;
    rawMaterialForm!: FormGroup;
    rawMaterialOrder?: RawMaterialOrder;
    selectedProvider?: Provider;
    selectedProviderSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedMeasure?: Measure;
    selectedPaymentType?: PaymentType;
    selectedPaymentTypeSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    currentMeasurePrice?: number;
    providerOptions?: Provider[];
    paymentTypeOptions?: PaymentType[];
    constantes?: Constant[];
    rawMaterials?: RawMaterialByProvider[];
    filteredRawMaterials?: RawMaterialByProvider[];
    unselectedRawMaterials?: RawMaterialByProvider[];
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
    elements: any = [];
    measureOptions?: Measure[];
    filteredMeasureOptions?: Measure[];
    rawMaterialIndexToRemove?: number;

    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute,
        private imageCompress: NgxImageCompressService, private alertService: AlertService,
        private router: Router, private formBuilder: FormBuilder, private modalService: NgbModal) {

        this.selectedProviderSubject.subscribe(value => {
            this.setProvider(value);
        });

        this.selectedPaymentTypeSubject.subscribe(value => {
            this.setPaymentType(value);
        });
    }


    ngOnInit(): void {

        this.title = 'Crear Pedido de Materia Prima';
        this.id = this.route.snapshot.params['id'];
        this.route.queryParams.subscribe(params => {
            this.editOption = params['opt'];
        });
        this.setEditOptions();

        this.orderForm = this.createFormGroup();
        this.rawMaterialForm = this.createMaterialFormGroup();

        this.rawMaterials = [];
        this.filteredRawMaterials = this.rawMaterials;
        this.unselectedRawMaterials = [];
        this.selectedRawMaterials = [];
        this.rawMaterialOrderElements = [];

        let requestArray = [];

        requestArray.push(this.dataService.getAllProvidersByFilter({"status": 1})); // providerRequest
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "paymentType", enableElements: "true"})); // paymentTypeRequest
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "measure", enableElements: "true"})); // measureRequest
        requestArray.push(this.dataService.getAllRawMaterialsByProviderByFilter({"status": { "id": 2}})); //rawMaterialByProviderRequest

        if (this.id){
            requestArray.push(this.dataService.getRawMaterialOrderById(this.id));
        }

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.providerOptions = result[0].retrieveProviderResponse?.providers;
                this.paymentTypeOptions = result[1].retrieveCatalogGenericResponse.elements;
                this.measureOptions = result[2].retrieveCatalogGenericResponse.elements;
                this.filteredMeasureOptions = result[2].retrieveCatalogGenericResponse.elements;
                this.rawMaterials = result[3].retrieveRawMaterialByProviderResponse?.rawMaterial;
                this.filteredRawMaterials = result[3].retrieveRawMaterialByProviderResponse?.rawMaterial;
                if (this.id){
                    this.rawMaterialOrder = result[4].GetRawMaterialOrderResponse?.rawMaterial;
                }
                // console.log(respuestaPeticion1, respuestaPeticion2, respuestaPeticion3);
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                // console.log('complete')
                if (this.rawMaterialOrder){
                    // console.log(this.providerOptions);
                    // console.log(this.rawMaterialOrder);
                    this.loadRawMaterialOrder();
                }
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
                    this.title = 'Recibir y Validar Pedido de Materia Prima';
                    this.isReceiveOption = true;
                    break;
            }
        }
    }

    loadRawMaterialOrder(){
        // this.setProvider(this.rawMaterialOrder?.provider?._id);
        this.orderForm.patchValue(this.rawMaterialOrder!);
        // this.providertSelect?.patchValue(String(this.rawMaterialOrder?.provider?._id));
        this.selectedProviderSubject.next(this.rawMaterialOrder?.provider?._id);
        this.paymentTypeSelect?.patchValue(String(this.rawMaterialOrder?.paymentType?.id));
        this.selectedPaymentTypeSubject.next(String(this.rawMaterialOrder?.paymentType?.id));
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
        this.selectedRMP = undefined;
        this.selectedMeasure = undefined;
        this.currentMeasurePrice = 0;
        this.modalDiscount = 0;
        this.modalQuantity = 0;
        this.elements = [];
    }

    onSaveForm() {
        this.alertService.clear();
        this.submitting = true;
        this.saveOrder()
            .pipe(first())
                .subscribe({
                    next: () => {
                        this.alertService.success('Orden de materia prima guardada', { keepAfterRouteChange: true });
                        this.router.navigateByUrl('/rawMaterialByProvider/order');
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
                    updatedRawMaterialOrder.paymentType = this.selectedPaymentType;
                    break;
                case 'receive':
                    if(this.paidAmount >= this.total){
                        updatedRawMaterialOrder.pendingAmount = "0";
                        updatedRawMaterialOrder.paidAmount = String(this.total.toFixed(2));
                        updatedRawMaterialOrder.paymentStatus = paymentStatusValues.pagado.paymentStatus;
                    } else {
                        updatedRawMaterialOrder.paidAmount = String(this.paidAmount.toFixed(2));
                        updatedRawMaterialOrder.pendingAmount = String(this.pendingAmount.toFixed(2));
                        if(this.paidAmount != 0){
                            updatedRawMaterialOrder.paymentStatus = paymentStatusValues.abonado.paymentStatus;
                        }
                    }
                    updatedRawMaterialOrder.paymentType = this.rawMaterialOrder?.paymentType;
                    updatedRawMaterialOrder.rawMaterialOrderElements = this.rawMaterialOrderElements;
                    updatedRawMaterialOrder.finalAmount = String(this.total);
                    updatedRawMaterialOrder.status = statusValues.verificado.status;
                    return this.dataService.updateRawMaterialOrder(updatedRawMaterialOrder).pipe(
                        concatMap((result: any) => {
                            return this.dataService.verifyRawMaterialOrder(this.rawMaterialOrder?._id!);
                        })
                    );
            }
            return this.dataService.updateRawMaterialOrder(updatedRawMaterialOrder);
        } else {
            let newRawMaterialOrder = {
                ...this.orderForm.value,
                paymentType: this.selectedPaymentType,
                provider: this.selectedProvider,
                rawMaterialOrderElements: this.rawMaterialOrderElements,
                pendingAmount: this.total.toFixed(2),
                paidAmount: "0",
                finalAmount: this.total.toFixed(2)
            }
            return this.dataService.addRawMaterialOrder(newRawMaterialOrder);
        }
    }

    onSaveMaterialForm(){
        let newOrderElement: RawMaterialOrderElement = {
            rawMaterialByProvider: this.selectedRMP,
            ...this.rawMaterialForm.value,
            price: this.currentMeasurePrice,
            measure: this.selectedMeasure,
            subtotalPrice: this.modalSubtotal.toFixed(2),
            totalDiscount: this.modalTotalDiscount.toFixed(2),
            totalPrice: this.modalTotal.toFixed(2),
        };
        this.rawMaterialOrderElements?.push(newOrderElement);
        this.findAndMoveRawMaterialById(true, this.selectedRMP?._id);
        this.onResetMaterialForm();
        // this.filteredRawMaterials?.splice(this.rawMaterialIndexToRemove!, 1);
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

    get f() {
        return this.orderForm.controls;
    }

    get r() {
        return this.rawMaterialForm.controls;
    }

    get providertSelect(){
        return this.orderForm.get('provider');
    }

    get paymentTypeSelect(){
        return this.orderForm.get('paymentType');
    }

    get measureSelect(){
        return this.rawMaterialForm.get('measure');
    }

    get discountInput(){
        return this.rawMaterialForm.get('discount');
    }

    setProvider(provider: any){
        this.rawMaterialOrderElements = [];
        this.unselectedRawMaterials = [];
        this.selectedProvider = this.findProviderById(provider);
        this.filterByProvider(provider);
    }

    setPaymentType(payment: any){
        this.selectedPaymentType = this.findPaymentType(payment);
    }

    filterByProvider(providerId: string){
        if(providerId){
            this.filteredRawMaterials = this.rawMaterials?.filter((val) => {
                return providerId === val.provider?._id;
            });
        }
    }

    changeMeasure(measureId: any){
        if(measureId){
            if(this.selectedMeasure){
                this.elements.pop();
            }
            this.selectedMeasure = this.selectMeasure(measureId);
            this.currentMeasurePrice = Number(this.selectedRMP?.price) * Number(this.selectedMeasure?.unitBase?.quantity);
            this.elements.push({icon : "payments", name : "Precio (" + this.selectedMeasure?.identifier + ")", value : this.dataService.getFormatedPrice(Number(this.currentMeasurePrice))});
        }
        this.calculateModalTotals();
    }

    selectRawMaterial(rawMaterial: RawMaterialByProvider, indexToRemove: number){
        // this.openPopup();
        this.selectedRMP = rawMaterial;
        this.elements = [];
        this.setRawMaterialElements(this.selectedRMP!);
        this.filteredMeasureOptions = this.measureOptions?.filter(item => this.selectedRMP?.rawMaterialBase?.measure?.identifier?.includes(item.unitBase?.name!));
        this.measureSelect?.setValue('');
        // this.rawMaterialIndexToRemove = indexToRemove;
        // let newOrderElement: RawMaterialOrderElement = {
        //     rawMaterialByProvider: rawMaterial,
        //     price: rawMaterial.price,
        //     discount: "0",
        //     quantity: "1"
        // };
        // this.rawMaterialOrderElements?.push(newOrderElement);
    }

    unselectRawMaterial(orderElement: RawMaterialOrderElement, indexToRemove: number){
        this.rawMaterialOrderElements?.splice(indexToRemove, 1);
        this.findAndMoveRawMaterialById(false, orderElement.rawMaterialByProvider?._id);
        // this.filteredRawMaterials?.push(orderElement.rawMaterialByProvider!);
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
            this.modalQuantity = Number(event.target.value) || 0;
        }
        this.calculateModalTotals();
    }

    setDiscountValue(event: Event){
        if (event.target instanceof HTMLInputElement) {
            this.modalDiscount =  Number(event.target.value) || 0;
        }
        this.calculateModalTotals();
    }

    calculateModalTotals() {
        let subtotal = Number(this.modalQuantity)*Number(this.currentMeasurePrice) || 0;
        let totalDiscount = Number(this.modalDiscount)*Number(this.modalQuantity) || 0;
        let total = subtotal - totalDiscount || 0;
        if(total < 0){
            this.discountInput?.setValue('0');
            this.modalDiscount = 0;
            totalDiscount = 0;
            total = subtotal - totalDiscount || 0;
        }
        this.modalSubtotal = subtotal;
        this.modalTotalDiscount = totalDiscount;
        this.modalTotal = total;
        this.modalSubtotalText = this.dataService.getFormatedPrice(subtotal);
        this.modalTotalDiscountText = this.dataService.getFormatedPrice(totalDiscount);
        this.modalTotalText = this.dataService.getFormatedPrice(total);
    }

    createFormGroup() {
        return new FormGroup({
            name: new FormControl('', [
            Validators.required,
            Validators.minLength(1),
            Validators.maxLength(50),
          ]),
          comment: new FormControl('', [
            Validators.minLength(1),
            Validators.maxLength(100),
            ]),
          provider: new FormControl('', [this.id ? Validators.nullValidator : Validators.required]),
          paymentType: new FormControl('', [this.isReceiveOption ? Validators.nullValidator : Validators.required]),
        //   applyDate: new FormControl('', [Validators.required])
        });
    }

    createMaterialFormGroup() {
        return new FormGroup({
            quantity: new FormControl('', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
            discount: new FormControl('', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
            measure: new FormControl('', [Validators.required])
        });
    }

    onDiscountInput(event: any, orderElement: RawMaterialOrderElement) {
        const input = event.target.value;
        let finalValue = "0";
    
        let maxValue = Number(orderElement.rawMaterialByProvider?.price);
        // const maxValue = 100; // Cambia este valor según tu necesidad
        const numericValue = parseFloat(input);
        if (!isNaN(numericValue) && numericValue > maxValue) {
            // event.target.value = maxValue.toFixed(2);
            finalValue = maxValue.toFixed(2);
        } else {
            // Limitar a dos decimales
            const match = input.match(/^\d*\.?\d{0,2}$/);
            if (match) {
                finalValue = match[0];
                // event.target.value = match[0];
            } else {
                finalValue = '';
                // event.target.value = ''; // Solo reiniciar si no hay coincidencia
            }
        }
        event.target.value = finalValue;
        orderElement.discount = finalValue;
    }

    setRawMaterialElements(rawMaterial: RawMaterialByProvider){
        // this.elements.push({icon : "scale", name : "Medida", value : rawMaterial.rawMaterialBase?.measure});
        this.elements.push({icon : "feed", name : "Descripción", value : rawMaterial.rawMaterialBase?.description});
        this.elements.push({icon : "monetization_on", name : "Precio (" + rawMaterial.rawMaterialBase?.measure?.identifier + ")", value : this.dataService.getFormatedPrice(Number(rawMaterial.price))});
    }

    closeRawMaterialDialog(){
        this.onResetMaterialForm();
    }

}