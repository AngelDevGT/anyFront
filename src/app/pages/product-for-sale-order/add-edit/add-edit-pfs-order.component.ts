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
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { ProductForSale } from '@app/models/product/producto-for-sale.model';
import { ProductForSaleStoreOrderElement } from '@app/models/product-for-sale/product-for-sale-store-order-element.model';
import { Inventory } from '@app/models/inventory/inventory.model';
// import { DynamicDialogComponent } from '@app/components/dynamic-dialog/dynamic-dialog.component';

@Component({ 
    selector: 'page-add-edit-pfs-order',
    templateUrl: 'add-edit-pfs-order.component.html',
    styleUrls: ['add-edit-pfs-order.component.scss']
})
export class AddEditProductForSaleOrderComponent implements OnInit{

    //Form
    orderForm!: FormGroup;
    productForSaleForm!: FormGroup;
    productForSaleOrder?: ProductForSaleStoreOrder;
    selectedEstablishment?: Establishment;
    selectedEstablishmentSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedMeasure?: Measure;
    currentMeasurePrice?: number;
    currentMeasureQuantity = 0;
    establishmentOptions?: Establishment[];
    constantes?: Constant[];
    productsForSale?: ProductForSale[];
    filteredProductsForSale?: ProductForSale[];
    unselectedProductsForSale?: ProductForSale[];
    productForSaleOrderElements?: ProductForSaleStoreOrderElement[];
    inventoryElementsSource?: InventoryElement[];
    inventoryElements?: InventoryElement[];
    unselectedInventoryElements?: InventoryElement[];
    total = 0;
    modalQuantity = 0;
    modalSelectedQuantity = 0;
    modalTotal = 0;
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
    selectedPFS?: ProductForSale;
    selectedIE?: InventoryElement;
    elements: any = [];
    measureOptions?: Measure[];
    filteredMeasureOptions?: Measure[];
    productForSaleIndexToRemove?: number;
    viewOption = '';
    storeOption = '';
    storeName = '';
    areTablesVisible = false;

    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute,
        private imageCompress: NgxImageCompressService, private alertService: AlertService,
        private router: Router, private formBuilder: FormBuilder, private modalService: NgbModal) {

        this.selectedEstablishmentSubject.subscribe(value => {
            this.setEstablishment(value);
        });
    }


    ngOnInit(): void {

        this.title = 'Crear Pedido de Producto para Venta (Tienda)';
        this.id = this.route.snapshot.params['id'];

        this.route.queryParams.subscribe(params => {
            this.viewOption = params['opt'];
            this.storeOption = params['store'];
            this.storeName = params['name'];
        });

        this.orderForm = this.createFormGroup();
        this.productForSaleForm = this.createMaterialFormGroup();

        this.productsForSale = [];
        this.filteredProductsForSale = this.productsForSale;
        this.unselectedProductsForSale = [];
        this.productForSaleOrderElements = [];

        let requestArray = [];
        this.unselectedInventoryElements = [];
        this.inventoryElements = [];

        requestArray.push(this.dataService.getAllEstablishmentsByFilter({"status": {id: 1}})); // providerRequest
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "measure", enableElements: "true"})); // measureRequest
        requestArray.push(this.dataService.getInventory({ _id: "64d7dae896457636c3f181e9"}));
        requestArray.push(this.dataService.getAllProductForSaleByFilter({"status": { "id": 2}})); //rawMaterialByProviderRequest

        if (this.id){
            this.title = 'Actualizar Pedido de Producto para Venta'
            requestArray.push(this.dataService.getProductForSaleOrderById(this.id));
        } else {
            this.areTablesVisible = true;
        }

        let inventory: Inventory;

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.establishmentOptions = result[0].findEstablishmentResponse?.establishment;
                this.measureOptions = result[1].retrieveCatalogGenericResponse.elements;
                this.filteredMeasureOptions = result[1].retrieveCatalogGenericResponse.elements;
                inventory = result[2].getInventoryResponse?.Inventory;
                this.productsForSale = result[3].retrieveProductForSaleResponse?.productsForSale;
                this.productsForSale = this.productsForSale?.filter(pfs => pfs.establishment?._id === String(this.storeOption));
                this.filteredProductsForSale = result[3].retrieveProductForSaleResponse?.productsForSale;
                this.filteredProductsForSale = this.filteredProductsForSale?.filter(pfs => pfs.establishment?._id === String(this.storeOption));
                if (this.id){
                    this.productForSaleOrder= result[4].getProductForSaleStoreOrderResponse?.saleStoreOrder;
                }
                // console.log(respuestaPeticion1, respuestaPeticion2, respuestaPeticion3);
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.selectedEstablishment = this.findEstablishemtnById(this.storeOption);
                this.filterByEstablishment(this.storeOption);

                this.inventoryElementsSource = inventory.inventoryElements;
                this.loadProductsForSaleFromInventory();
                if (this.productForSaleOrder){
                    this.loadRawMaterialOrder();
                }
                this.loading = false;
            }
        });

    }

    loadProductsForSaleFromInventory(){
        this.inventoryElements = [];
        this.productsForSale?.map((pfsItem) => {
            const matchingFinishedProduct = this.inventoryElementsSource?.find((invElem) => pfsItem.finishedProduct?._id === invElem?.finishedProduct?._id);
            if (matchingFinishedProduct){
                this.inventoryElements?.push({
                    ...matchingFinishedProduct,
                    productForSale: pfsItem
                });             
            }
        });
        // this.filteredProductsForSale = this.productsForSale?.filter((pfsItem) => this.inventoryElements?.some((ieItem) => pfsItem.finishedProduct?._id === ieItem.finishedProduct?._id));
    }

    loadRawMaterialOrder(){
        // this.setProvider(this.rawMaterialOrder?.provider?._id);
        this.orderForm.patchValue(this.productForSaleOrder!);
        if(this.productForSaleOrder?.storeStatus?.id === 1){
            this.areTablesVisible = true;
        }
        // this.providertSelect?.patchValue(String(this.rawMaterialOrder?.provider?._id));
        this.selectedEstablishmentSubject.next(this.productForSaleOrder?._id);
        this.productForSaleOrderElements = this.productForSaleOrder?.productForSaleStoreOrderElements;
        this.productForSaleOrder?.productForSaleStoreOrderElements?.forEach(pfsOrder => {
            this.findAndMoveProductForSaleById(true, pfsOrder.productForSale?._id);
        });
    }

    onResetForm() {
        this.orderForm.reset();
    }

    onResetMaterialForm(){
        this.productForSaleForm.reset();
        this.currentMeasureQuantity = 0;
        this.selectedPFS = undefined;
        this.selectedIE = undefined;
        this.selectedMeasure = undefined;
        this.currentMeasurePrice = 0;
        this.currentMeasureQuantity = 0;
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
                        this.alertService.success('Orden de producto para venta guardada', { keepAfterRouteChange: true });
                        if(this.viewOption){
                            this.router.navigate(['/productsForSale/order'], {
                                queryParams: {
                                    opt: this.viewOption,
                                    store: this.storeOption,
                                    name: this.storeName
                                }
                            });
                        } else {
                            this.router.navigateByUrl('/productsForSale/order');
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
        if(this.id){
            let updatedProductForSaleOrder: ProductForSaleStoreOrder = {
                ...this.productForSaleOrder,
                ...this.orderForm.value
            }
            return this.dataService.updateProductForSaleOrder(updatedProductForSaleOrder);
        } else {
            let newProductForSaleOrder: ProductForSaleStoreOrder = {
                ...this.orderForm.value,
                establishmentID: this.selectedEstablishment?._id,
                inventoryID: "64d7dae896457636c3f181e9",
                productForSaleStoreOrderElements: this.productForSaleOrderElements,
                finalAmount: this.total.toFixed(2)
            }
            return this.dataService.addProductForSaleOrder(newProductForSaleOrder);
        }
    }

    onSaveMaterialForm(){
        let newOrderElement: ProductForSaleStoreOrderElement = {
            productForSale: this.selectedIE?.productForSale,
            ...this.productForSaleForm.value,
            price: this.currentMeasurePrice,
            measure: this.selectedMeasure,
            quantity: String(this.modalQuantity),
            totalPrice: this.modalTotal,
        };
        this.productForSaleOrderElements?.push(newOrderElement);
        this.findAndMoveProductForSaleById(true, this.selectedIE?.productForSale?._id);
        this.onResetMaterialForm();
        // this.filteredProductsForSale?.splice(this.productForSaleIndexToRemove!, 1);
    }

    // onReceiveDialog(){
    //     this.confirmDialogTitle = 'Recibir Pedido';
    //     if(this.pendingAmount < 0){
    //         this.confirmDialogText = 'El monto abonado (Q. ' + this.paidAmount + ') es mayor al total (Q. ' + this.total + '). ¿Deseas marcar el pedido como recibido?';
    //         this.warningDialogText = 'IMPORTANTE: EL MONTO ABONADO CAMBIARA A SER EL MISMO QUE EL MONTO FINAL';
    //     } else {
    //         this.confirmDialogText = '¿Deseas marcar el pedido como recibido?';
    //         this.warningDialogText = undefined;
    //     }
    //     this.confirmDialogId = 1;
    // }

    onConfirmDialog(){
        this.submitting = true;
        if(this.confirmDialogId == 1){
            this.onSaveForm();
        }
    }

    selectInventoryElement(invElement: InventoryElement, indexToRemove: number){
        // this.selectedRMP = rawMaterial;
        this.selectedIE = invElement;
        this.elements = [];
        this.setInventoryElementElements(invElement);
        this.filteredMeasureOptions = this.measureOptions?.filter(item => invElement.finishedProduct?.measure?.identifier?.includes(item.unitBase?.name!));
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

    unselectInventoryElement(orderElement: ProductForSaleStoreOrderElement, indexToRemove: number){
        this.productForSaleOrderElements?.splice(indexToRemove, 1);
        this.findAndMoveProductForSaleById(false, orderElement.productForSale?._id);
    }


    setInventoryElementElements(invElement: InventoryElement){
        // this.elements.push({icon : "scale", name : "Medida", value : rawMaterial.rawMaterialBase?.measure});
        this.elements.push({icon : "format_size", name : "Nombre", value : invElement?.finishedProduct?.name});
        this.elements.push({icon : "feed", name : "Descripción", value : invElement.finishedProduct?.description});
        // this.elements.push({icon : "monetization_on", name : "Cantidad (" + invElement.measure?.identifier + ")", value : invElement.quantity});
    }

    selectMeasure(measureId?: string){
        return this.measureOptions?.find(measure => String(measure.id) === measureId);
    }

    findEstablishemtnById(establishmentId?: string){
        return this.establishmentOptions?.find(establishment => String(establishment._id) === establishmentId);
    }

    findAndMoveProductForSaleById(isSelect: boolean, inventoryElementId?: string){
        if (isSelect){
            let inventoryElementResult = this.inventoryElements?.find(invElement => invElement.productForSale?._id === inventoryElementId);
            if (inventoryElementResult) {
                this.inventoryElements = this.inventoryElements?.filter(invElement => invElement.productForSale?._id !== inventoryElementId);
                this.unselectedInventoryElements?.push(inventoryElementResult);
            }
        } else { // unselect
            let inventoryElementResult = this.unselectedInventoryElements?.find(invElement => invElement.productForSale?._id === inventoryElementId);
            if (inventoryElementResult){
                this.unselectedInventoryElements = this.unselectedInventoryElements?.filter(invElement => invElement.productForSale?._id !== inventoryElementId);
                this.inventoryElements?.push(inventoryElementResult);
            }
        }
    }

    get f() {
        return this.orderForm.controls;
    }

    get r() {
        return this.productForSaleForm.controls;
    }

    get providertSelect(){
        return this.orderForm.get('provider');
    }

    get measureSelect(){
        return this.productForSaleForm.get('measure');
    }

    get modalQuantityInput(){
        return this.productForSaleForm.get('quantity');
    }

    setEstablishment(establishment: any){
        this.productForSaleOrderElements = [];
        this.unselectedProductsForSale = [];
        this.selectedEstablishment = this.findEstablishemtnById(establishment);
        this.filterByEstablishment(establishment);
    }

    filterByEstablishment(establishmentId: string){
        if(establishmentId){
            console.log(establishmentId);
            this.filteredProductsForSale = this.productsForSale?.filter((val) => {
                return establishmentId === val.establishment?._id;
            });
            console.log(this.filteredProductsForSale);
        }
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
        this.calculateModalQuantity();
        this.calculateModalTotals();
    }

    selectProductForSale(productForSale: ProductForSale, indexToRemove: number){
        // this.openPopup();
        this.selectedPFS = productForSale;
        this.elements = [];
        this.setProductElements(this.selectedPFS!);
        this.filteredMeasureOptions = this.measureOptions?.filter(item => this.selectedPFS?.finishedProduct?.measure?.identifier?.includes(item.unitBase?.name!));
        this.measureSelect?.setValue('');
        // this.productForSaleIndexToRemove = indexToRemove;
        // let newOrderElement: RawMaterialOrderElement = {
        //     rawMaterialByProvider: rawMaterial,
        //     price: rawMaterial.price,
        //     discount: "0",
        //     quantity: "1"
        // };
        // this.productForSaleOrderElements?.push(newOrderElement);
    }

    unselectProductForSale(orderElement: ProductForSaleStoreOrderElement, indexToRemove: number){
        this.productForSaleOrderElements?.splice(indexToRemove, 1);
        this.findAndMoveProductForSaleById(false, orderElement.productForSale?._id);
        // this.filteredProductsForSale?.push(orderElement.rawMaterialByProvider!);
    }

    calculateTotal(){
        let total = 0;
        if (this.productForSaleOrderElements){
            for(const orderElement of this.productForSaleOrderElements){
                total += Number(orderElement.price)*Number(orderElement.quantity) || 0;
            }
        }
        this.total = total
        return total;
    }

    calculateModalTotal(){
        let total = 0;
        if (this.productForSaleOrderElements){
            for(const orderElement of this.productForSaleOrderElements){
                total += Number(orderElement.price)*Number(orderElement.quantity) || 0;
            }
        }
        this.total = total
        return total;
    }

    setQuantityValue(event: Event){
        if (event.target instanceof HTMLInputElement) {
            this.modalQuantity = Number(event.target.value) || 0;
        }
        this.calculateModalQuantity();
        this.calculateModalTotals();
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

    calculateModalTotals() {
        let total = Number(this.modalQuantity)*Number(this.currentMeasurePrice) || 0;
        this.modalTotal = total;
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
            Validators.required,
            Validators.minLength(1),
            Validators.maxLength(100),
            ]),
        //   establishment: new FormControl('', [this.id ? Validators.nullValidator : Validators.required]),
        });
    }

    createMaterialFormGroup() {
        return new FormGroup({
            quantity: new FormControl('', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
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

    setProductElements(product: ProductForSale){
        // this.elements.push({icon : "scale", name : "Medida", value : rawMaterial.rawMaterialBase?.measure});
        this.elements.push({icon : "feed", name : "Descripción", value : product.finishedProduct?.description});
        this.elements.push({icon : "monetization_on", name : "Precio (" + product.finishedProduct?.measure?.identifier + ")", value : this.dataService.getFormatedPrice(Number(product.price))});
    }

    closeRawMaterialDialog(){
        this.onResetMaterialForm();
    }

}