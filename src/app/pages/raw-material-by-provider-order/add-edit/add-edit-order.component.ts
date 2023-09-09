import { Component, OnInit } from '@angular/core';
import {BehaviorSubject, Observable, forkJoin, of} from 'rxjs';
import {concatMap, first, map, startWith} from 'rxjs/operators';
import {
    DataUrl,
    DOC_ORIENTATION,
    NgxImageCompressService,
    UploadResponse,
} from 'ngx-image-compress';

import { AccountService, AlertService, DataService } from '@app/services';
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
    selectedRawMaterials?: InventoryElement[];
    rawMaterialOrderElements?: RawMaterialOrderElement[];
    totalDiscount = 0;
    subtotal = 0;
    total = 0;
    modalQuantity = 0;
    modalDiscount = 0;
    modalTotalDiscount = 0;
    modalSubtotal = 0;
    modalTotal = 0;
    modalTotalDiscountText?: string;
    modalSubtotalText?: string;
    modalTotalText?: string;
    id?: string;
    title!: string;
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
        private router: Router, private formBuilder: FormBuilder) {

        this.selectedProviderSubject.subscribe(value => {
            this.setProvider(value);
        });

        this.selectedPaymentTypeSubject.subscribe(value => {
            this.setPaymentType(value);
        });
    }


    ngOnInit(): void {

        this.id = this.route.snapshot.params['id'];

        this.orderForm = this.createFormGroup();
        this.rawMaterialForm = this.createMaterialFormGroup();
        this.title = 'Crear Pedido de Materia Prima';

        if (this.id){
            this.title = 'Actualizar Orden';
        }

        this.rawMaterials = [];
        this.filteredRawMaterials = this.rawMaterials;
        this.selectedRawMaterials = [];
        this.rawMaterialOrderElements = [];

        const providerRequest = this.dataService.getAllProvidersByFilter({"status": 1});
        const paymentTypeRequest = this.dataService.getAllConstantsByFilter({fc_id_catalog: "paymentType", enableElements: "true"});
        const measureRequest = this.dataService.getAllConstantsByFilter({fc_id_catalog: "measure", enableElements: "true"});
        const rawMaterialByProviderRequest = this.dataService.getAllRawMaterialsByProviderByFilter({"status": { "id": 2}});

        forkJoin([providerRequest, paymentTypeRequest, measureRequest, rawMaterialByProviderRequest]).subscribe({
            next: (result: any) => { 
                this.providerOptions = result[0].retrieveProviderResponse?.providers;
                this.paymentTypeOptions = result[1].retrieveCatalogGenericResponse.elements;
                this.measureOptions = result[2].retrieveCatalogGenericResponse.elements;
                this.filteredMeasureOptions = result[2].retrieveCatalogGenericResponse.elements;
                this.rawMaterials = result[3].retrieveRawMaterialByProviderResponse?.rawMaterial;
                this.filteredRawMaterials = result[3].retrieveRawMaterialByProviderResponse?.rawMaterial;
                // console.log(respuestaPeticion1, respuestaPeticion2, respuestaPeticion3);
            },
            error: (e) =>  console.error('Error en una de las peticiones', e),
            complete: () => {
                // console.log('complete')
                this.loading = false;
            }
        });

        // this.dataService.getAllProvidersByFilter({"status": 1})
        // .pipe(
        //     concatMap((providers: any) => {
        //         this.providerOptions = providers.retrieveProviderResponse?.providers;
        //         return this.dataService.getAllConstantsByFilter({fc_id_catalog: "paymentType", enableElements: "true"});
        //     }),
        //     concatMap((paymentTypes: any) => {
        //         this.paymentTypeOptions = paymentTypes.retrieveCatalogGenericResponse.elements;
        //         return this.dataService.getAllConstantsByFilter({fc_id_catalog: "measure", enableElements: "true"});
        //     }),
        //     concatMap((measures: any) => {
        //         this.measureOptions = measures.retrieveCatalogGenericResponse.elements;
        //         this.filteredMeasureOptions = measures.retrieveCatalogGenericResponse.elements;
        //         return this.dataService.getAllRawMaterialsByProviderByFilter({"status": { "id": 2}});
        //     })
        // )
        // .subscribe((rawMaterials: any) => {
        //     this.rawMaterials = rawMaterials.retrieveRawMaterialByProviderResponse?.rawMaterial;
        //     this.filteredRawMaterials = rawMaterials.retrieveRawMaterialByProviderResponse?.rawMaterial;
        //     if(this.id){
        //         return this.dataService.getRawMaterialByProviderById(this.id);
        //     }
        //     this.loading = false;
        //     return of(null);  
        // });

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
        this.rawMaterialOrder = {
            ...this.orderForm.value,
            paymentType: this.selectedPaymentType,
            provider: this.selectedProvider,
            rawMaterialOrderElements: this.rawMaterialOrderElements,
            pendingAmount: this.total,
            finalAmount: this.total
        }
        this.dataService.addRawMaterialOrder(this.rawMaterialOrder!)
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

    onSaveMaterialForm(){
        let newOrderElement: RawMaterialOrderElement = {
            rawMaterialByProvider: this.selectedRMP,
            ...this.rawMaterialForm.value,
            price: this.currentMeasurePrice,
            measure: this.selectedMeasure,
            subtotalPrice: this.modalSubtotal,
            totalDiscount: this.modalTotalDiscount,
            totalPrice: this.modalTotal,
        };
        console.log(newOrderElement);
        this.rawMaterialOrderElements?.push(newOrderElement);
        this.onResetMaterialForm();
        this.filteredRawMaterials?.splice(this.rawMaterialIndexToRemove!, 1);
    }

    selectMeasure(measureId?: string){
        return this.measureOptions?.find(measure => String(measure.id) === measureId);
    }

    findProvider(providerId?: string){
        return this.providerOptions?.find(provider => String(provider._id) === providerId);
    }

    findPaymentType(paymentId?: string){
        return this.paymentTypeOptions?.find(payment => String(payment.id) === paymentId);
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

    get measureSelect(){
        return this.rawMaterialForm.get('measure');
    }

    get discountInput(){
        return this.rawMaterialForm.get('discount');
    }

    setProvider(provider: any){
        this.rawMaterialOrderElements = [];
        this.selectedProvider = this.findProvider(provider);
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


    changeProvider(e: any){
        this.providertSelect!.setValue(e.target.value, {
        onlySelf: true
        });
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
        this.rawMaterialIndexToRemove = indexToRemove;
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
        this.filteredRawMaterials?.push(orderElement.rawMaterialByProvider!);
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
          provider: new FormControl('', [Validators.required]),
          paymentType: new FormControl('', [Validators.required]),
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

    // onQuantityKeydown(event: KeyboardEvent) {
    //     // Obtener el código de la tecla presionada
    //     const key = event.key;
    
    //     // Permitir solo teclas numéricas y las teclas de navegación
    //     if (!/^[0-9]$/.test(key) && key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'Backspace' && key !== 'Delete') {
    //         event.preventDefault();
    //     }
    // }

    // onDiscountKeydown(event: KeyboardEvent) {
    //     const key = event.key;
    
    //     // Permitir solo teclas numéricas, punto decimal, teclas de navegación y eliminación
    //     if (!/^[0-9.]$/.test(key) && key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'Backspace' && key !== 'Delete') {
    //         event.preventDefault();
    //     }
    
    //     // Si ya hay un punto decimal en el input, no permitir otro
    //     if (key === '.' && (event.target as HTMLInputElement).value.includes('.')) {
    //         event.preventDefault();
    //     }
    // }

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