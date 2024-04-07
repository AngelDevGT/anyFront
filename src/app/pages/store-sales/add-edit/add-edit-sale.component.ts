import { Component, OnInit } from '@angular/core';
import {BehaviorSubject, forkJoin} from 'rxjs';
import {first} from 'rxjs/operators';
import { NgxImageCompressService } from 'ngx-image-compress';

import { statusValues, AlertService, DataService, paymentStatusValues } from '@app/services';
import {
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryElement } from '@app/models/inventory/inventory-element.model';
import { RawMaterialOrderElement } from '@app/models/raw-material/raw-material-order-element.model';
import { RawMaterialByProvider } from '@app/models/raw-material/raw-material-by-provider.model';
import { Constant } from '@app/models/auxiliary/constant.model';
import { Measure, PaymentType } from '@app/models';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Inventory } from '@app/models/inventory/inventory.model';
import { ItemsList } from '@app/models/store/item-list.model';
import { ShopResume } from '@app/models/store/shop-resume.model';
import { Establishment } from '@app/models/establishment.model';

@Component({ 
    selector: 'page-add-edit-sale',
    templateUrl: 'add-edit-sale.component.html',
    styleUrls: ['add-edit-sale.component.scss']
})
export class AddEditSaleComponent implements OnInit{

    //Form
    orderForm!: FormGroup;
    inventory?: Inventory;
    inventoryElements?: InventoryElement[];
    allInventoryElements?: InventoryElement[];
    rawMaterialForm!: FormGroup;
    rawMaterialOrder?: RawMaterialOrder;
    selectedMeasure?: Measure;
    selectedPaymentType?: PaymentType;
    selectedPaymentTypeSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    currentMeasurePrice?: number;
    paymentTypeOptions?: PaymentType[];
    constantes?: Constant[];
    unselectedInventoryElements?: InventoryElement[];
    itemsList?: ItemsList[];
    totalDiscount = 0;
    delivery = 0;
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
    establishment?: Establishment;
    isEditOption?: boolean = false;
    isReceiveOption?: boolean = false;
    title!: string;
    confirmDialogTitle = '...';
    confirmDialogText = '...';
    warningDialogText?: string;
    confirmDialogId = 0;
    loading = true;
    submitting = false;
    hasErrors = false;
    displayStyle = false;
    selectedIE?: InventoryElement;
    elements: any = [];
    measureOptions?: Measure[];
    filteredMeasureOptions?: Measure[];
    currentMeasureQuantity = 0;
    selectedQuantity = 0;
    id?: string;
    shopResume?: ShopResume;

    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute,
        private imageCompress: NgxImageCompressService, private alertService: AlertService,
        private router: Router, private formBuilder: FormBuilder, private modalService: NgbModal) {

        this.selectedPaymentTypeSubject.subscribe(value => {
            this.setPaymentType(value);
        });
    }


    ngOnInit(): void {

        this.id = this.route.snapshot.params['id'];

        let establishmentId = '';
        this.route.queryParams.subscribe(params => {
            establishmentId = params['strId'];
        });
        
        this.title = 'Registrar Venta';

        this.orderForm = this.createFormGroup();
        this.rawMaterialForm = this.createMaterialFormGroup();

        this.inventoryElements = [];
        this.allInventoryElements = this.inventoryElements;
        this.unselectedInventoryElements = [];
        this.itemsList = [];

        this.inventory = undefined;
        let requestArray = [];

        if (this.id){
            this.title = 'Actualizar Venta';
            this.isEditOption = true;
            this.dataService.getShopHistory({_id: this.id})
                .pipe(first())
                .subscribe((shopResumRes: any) => {
                    let shopRes = shopResumRes.retrieveShopHistoryResponse?.FinishedProducts;
                    if (shopRes[0]){
                        this.shopResume = shopRes[0];
                        this.orderForm.patchValue(this.shopResume!);
                        console.log(this.shopResume);
                        this.loading = false;
                    }
                });
        } else {

            requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "paymentType", enableElements: "true"})); // paymentTypeRequest
            requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "measure", enableElements: "true"})); // measureRequest
            requestArray.push(this.dataService.getAllInventoryByFilter({ _id: "65bf467e008f7e88678d3927"}));
            requestArray.push(this.dataService.getEstablishmentById(establishmentId));
    
            forkJoin(requestArray).subscribe({
                next: (result: any) => {
                    this.paymentTypeOptions = result[0].retrieveCatalogGenericResponse.elements;
                    this.measureOptions = result[1].retrieveCatalogGenericResponse.elements;
                    this.filteredMeasureOptions = result[1].retrieveCatalogGenericResponse.elements;
                    this.inventory = result[2].retrieveInventoryResponse?.Inventorys[0];
                    this.establishment = result[3].getEstablishmentResponse.establishment;
                },
                error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
                complete: () => {
                    if (this.inventory){
                        this.inventoryElements = this.inventory?.inventoryElements;
                        this.inventoryElements = this.inventoryElements?.filter(invElem =>invElem.productForSale?.establishment?._id === String(this.establishment?._id));
                        this.allInventoryElements = this.inventoryElements;
                        console.log(this.inventoryElements);
                        console.log(this.inventory)
                    }
                    this.loading = false;
                    this.title = 'Registrar Venta (' + this.establishment?.name + ')';
                }
            });
        }


    }

    loadRawMaterialOrder(){
        this.orderForm.patchValue(this.rawMaterialOrder!);
        this.paymentTypeSelect?.patchValue(String(this.rawMaterialOrder?.paymentType?.id));
        this.selectedPaymentTypeSubject.next(String(this.rawMaterialOrder?.paymentType?.id));
        // this.rawMaterialOrderElements = this.rawMaterialOrder?.rawMaterialOrderElements;
        this.rawMaterialOrder?.rawMaterialOrderElements?.forEach(rawMaterialOrder => {
            this.findAndMoveInventoryElementById(true, rawMaterialOrder.rawMaterialByProvider?._id);
        });
    }

    onResetForm() {
        this.orderForm.reset();
    }

    onResetMaterialForm(){
        this.rawMaterialForm.reset();
        this.selectedIE = undefined;
        this.selectedMeasure = undefined;
        this.currentMeasurePrice = 0;
        this.currentMeasureQuantity = 0;
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
                        this.alertService.success('Venta guardada', { keepAfterRouteChange: true });
                        if(this.isEditOption){
                            this.router.navigateByUrl('/store/sales/history/' + this.shopResume?.establecimiento?._id);
                        } else {
                            this.router.navigateByUrl('/store/sales/history/' + this.establishment?._id);
                        }
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
        if(this.isEditOption){
            let updatedShopResume: ShopResume = {
                ...this.shopResume!,
                ...this.orderForm.value,
            }
            return this.dataService.updateShopHistory(updatedShopResume);
        } else {
            let newShopResume: ShopResume = {
                ...this.orderForm.value,
                establecimiento: this.establishment,
                total: this.total.toFixed(2),
                subtotal: this.subtotal.toFixed(2),
                totalDiscount: this.totalDiscount.toFixed(2),
                paymentType: this.selectedPaymentType,
                itemsList: this.itemsList,
            }
            return this.dataService.registerShop(newShopResume);
        }
    }

    onSaveMaterialForm(){
        let newItemList: ItemsList = {
            productForSale: this.selectedIE?.productForSale,
            ...this.rawMaterialForm.value,
            price: this.currentMeasurePrice,
            measure: this.selectedMeasure,
            subtotal: this.modalSubtotal,
            totalDiscount: this.modalTotalDiscount,
            total: this.modalTotal,
        };
        this.itemsList?.push(newItemList);
        this.findAndMoveInventoryElementById(true, this.selectedIE?.productForSale?._id);
        this.onResetMaterialForm();
        // this.filteredRawMaterials?.splice(this.rawMaterialIndexToRemove!, 1);
    }

    selectMeasure(measureId?: string){
        return this.measureOptions?.find(measure => String(measure.id) === measureId);
    }

    findPaymentType(paymentId?: string){
        return this.paymentTypeOptions?.find(payment => String(payment.id) === paymentId);
    }

    findAndMoveInventoryElementById(isSelect: boolean, productForSaleId?: string){
        if (isSelect){
            let invElementResult = this.inventoryElements?.find(invElement => invElement.productForSale?._id === productForSaleId);
            if (invElementResult) {
                this.inventoryElements = this.inventoryElements?.filter(invElement => invElement.productForSale?._id !== productForSaleId);
                this.unselectedInventoryElements?.push(invElementResult);
            }
        } else { // unselect
            let invElementResult = this.unselectedInventoryElements?.find(invElement => invElement.productForSale?._id === productForSaleId);
            if (invElementResult){
                this.unselectedInventoryElements = this.unselectedInventoryElements?.filter(invElement => invElement.productForSale?._id !== productForSaleId);
                this.inventoryElements?.push(invElementResult);
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

    get modalQuantityInput(){
        return this.rawMaterialForm.get('quantity');
    }

    setPaymentType(payment: any){
        this.selectedPaymentType = this.findPaymentType(payment);
    }

    changeMeasure(measureId: any){
        if(measureId){
            if(this.selectedMeasure){
                this.elements.pop();
            }
            this.selectedMeasure = this.selectMeasure(measureId);
            this.currentMeasureQuantity = Number(this.selectedMeasure?.unitBase?.quantity);
            this.currentMeasurePrice = Number(this.selectedIE?.productForSale?.price) * Number(this.selectedMeasure?.unitBase?.quantity);
            this.elements.push({icon : "payments", name : "Precio (" + this.selectedMeasure?.identifier + ")", value : this.dataService.getFormatedPrice(Number(this.currentMeasurePrice))});
        }
        this.calculateModalTotals();
    }

    selectInventoryElement(invElement: InventoryElement, indexToRemove: number){
        // this.openPopup();
        this.selectedIE = invElement
        this.elements = [];
        this.setInventoryElemElements(this.selectedIE!);
        this.filteredMeasureOptions = this.measureOptions?.filter(item => this.selectedIE?.productForSale?.finishedProduct?.measure?.identifier?.includes(item.unitBase?.name!));
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

    unselectItemList(itemList: ItemsList, indexToRemove: number){
        this.itemsList?.splice(indexToRemove, 1);
        this.findAndMoveInventoryElementById(false, itemList?.productForSale?._id);
        // this.filteredRawMaterials?.push(orderElement.rawMaterialByProvider!);
    }

    calculateSubtotal() {
        let subtotal = 0;
        if (this.itemsList){
            for(const itemList of this.itemsList){
                subtotal += Number(itemList.price)*Number(itemList.quantity) || 0;
            }
        }
        this.subtotal = subtotal;
        return subtotal;
    }

    calculateTotalDiscount() {
        let totalDiscount = 0;
        if (this.itemsList){
            for (const itemList of this.itemsList) {
                totalDiscount += Number(itemList.discount)*Number(itemList.quantity) || 0;
            }
        }
        this.totalDiscount = totalDiscount;
        return totalDiscount;
    }
    
    setDeliveryValue(event: Event){
        if (event.target instanceof HTMLInputElement) {
            this.delivery =  Number(event.target.value) || 0;
        }
    }

    calculateTotal(){
        this.total = this.subtotal - this.totalDiscount + this.delivery;
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
        if (this.itemsList){
            for(const itemList of this.itemsList){
                subtotal += Number(itemList.price)*Number(itemList.quantity) || 0;
            }
        }
        this.subtotal = subtotal;
        return subtotal;
    }

    calculateModalTotalDiscount() {
        let totalDiscount = 0;
        if (this.itemsList){
            for (const itemList of this.itemsList) {
                totalDiscount += Number(itemList.discount)*Number(itemList.quantity) || 0;
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
        let totalQuantity = Number(this.modalQuantity)*Number(this.currentMeasureQuantity) || 0;
        let unitBaseTotalQuantity = Number(this.selectedIE?.measure?.unitBase?.quantity) * Number(this.selectedIE?.quantity);
        let subtotal = Number(this.modalQuantity)*Number(this.currentMeasurePrice) || 0;
        let totalDiscount = Number(this.modalDiscount)*Number(this.modalQuantity) || 0;
        let total = subtotal - totalDiscount || 0;
        if(total < 0 || totalQuantity > unitBaseTotalQuantity){
            this.discountInput?.setValue('0');
            this.modalQuantityInput?.setValue('0');
            this.modalQuantity = 0;
            totalQuantity = 0;
            this.modalDiscount = 0;
            totalDiscount = 0;
            total = 0;
            subtotal = 0;
        }
        this.selectedQuantity = totalQuantity;
        this.modalSubtotal = subtotal;
        this.modalTotalDiscount = totalDiscount;
        this.modalTotal = total;
        this.modalSubtotalText = this.dataService.getFormatedPrice(subtotal);
        this.modalTotalDiscountText = this.dataService.getFormatedPrice(totalDiscount);
        this.modalTotalText = this.dataService.getFormatedPrice(total);
    }

    createFormGroup() {
        return new FormGroup({
            nameClient: new FormControl('', [
            Validators.maxLength(50),
            ]),
            nitClient: new FormControl('', [ Validators.maxLength(20),]),
            nota: new FormControl('', [Validators.maxLength(100)]),
            paymentType: new FormControl('', [this.isEditOption ? Validators.required : Validators.nullValidator]),
            delivery: new FormControl('', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
        //   applyDate: new FormControl('', [Validators.required])
        });
    }

    createMaterialFormGroup() {
        return new FormGroup({
            quantity: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/)]),
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

    setInventoryElemElements(invElement: InventoryElement){
        // this.elements.push({icon : "scale", name : "Medida", value : rawMaterial.rawMaterialBase?.measure});
        this.elements.push({icon : "feed", name : "Descripción", value : invElement.productForSale?.finishedProduct?.name});
        this.elements.push({icon : "monetization_on", name : "Precio (" + invElement.productForSale?.finishedProduct?.measure?.identifier + ")", value : this.dataService.getFormatedPrice(Number(invElement.productForSale?.price))});
    }

    closeRawMaterialDialog(){
        this.onResetMaterialForm();
    }

}