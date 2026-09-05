import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {BehaviorSubject, EMPTY, forkJoin, of} from 'rxjs';
import {concatMap, first} from 'rxjs/operators';
import { NgxImageCompressService } from 'ngx-image-compress';

import { statusValues, AlertService, DataService, measureUnitsConst } from '@app/services';
import { Customer } from '@app/models/system/customer.model';
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
import { ActivityLog } from '@app/models/system/activity-log';
import { bankOptions, requiresPaymentDetail, BANK_NAME_MAX_LENGTH, REFERENCE_NO_MAX_LENGTH } from '@app/helpers';

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
    saleSearchTerm?: string;

    // POS UI state
    searchFocused = false;
    showDelivery = false;
    showComment = false;
    actionsSheetOpen = false;

    /**
     * Cliente de la venta. 'manual' y 'existing' son excluyentes: al entrar a
     * uno se limpia el otro. Las ventas al crédito solo admiten 'existing'.
     */
    clientMode: 'none' | 'manual' | 'existing' = 'none';
    customerOptions: Customer[] = [];
    selectedCustomer?: Customer;
    customerSearchTerm = '';
    customerDropdownOpen = false;
    cobrarModalOpen = false;
    /** Venta en edición cuyo cliente es un registro de customer (no editable). */
    isRegisteredCustomerSale = false;
    /** Tope del comentario del depósito — igual al varchar(200) de shop_sale_payment.comment */
    readonly commentMaxLength = 200;
    /** Topes de shop_sale_payment.bank y .reference_no */
    readonly bankMaxLength = BANK_NAME_MAX_LENGTH;
    readonly referenceMaxLength = REFERENCE_NO_MAX_LENGTH;
    /**
     * Bancos de la tienda, para el select del pago. Salen de establishment.banks, que ya viene en
     * la misma petición que arma la pantalla. Si la tienda no tiene ninguno cargado no se puede
     * cobrar con Depósito ni con Cheque: el formulario lo dice y bloquea el registro.
     */
    bankOptionsList: string[] = [];

    get filteredInventoryElements(): InventoryElement[] | undefined {
        if (!this.saleSearchTerm) return this.inventoryElements;
        const term = this.saleSearchTerm.toLowerCase();
        return this.inventoryElements?.filter(el =>
            el.productForSale?.finishedProduct?.name?.toLowerCase().includes(term)
        );
    }

    /** Productos cuando el buscador tiene foco o texto; opciones cuando no. */
    get showProductResults(): boolean {
        return this.searchFocused || !!this.saleSearchTerm;
    }

    /**
     * Sin existencia: la pastilla de cantidad pasa a rojo. Se compara contra <= 0 y no contra 0
     * exacto porque una existencia negativa tampoco es vendible, y pintarla de verde sería peor.
     * quantity llega como texto desde el API, así que un !quantity no sirve: '0' es truthy.
     */
    isOutOfStock(inventoryElement?: InventoryElement): boolean {
        return Number(inventoryElement?.quantity ?? 0) <= 0;
    }

    get itemsSubtotal(): number {
        return (this.itemsList ?? []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    }

    get grandTotal(): number {
        return this.itemsSubtotal + (Number(this.delivery) || 0);
    }

    get itemCount(): number {
        return this.itemsList?.length ?? 0;
    }

    openActionsSheet() {
        this.actionsSheetOpen = true;
    }

    closeActionsSheet() {
        this.actionsSheetOpen = false;
    }

    onSearchFocus() {
        this.searchFocused = true;
    }

    onSearchBlur() {
        // Pequeño delay para permitir el click sobre un producto antes de ocultar la lista
        setTimeout(() => this.searchFocused = false, 200);
    }

    /** ── Cliente ──────────────────────────────────────────────── */

    get showClientRow(): boolean {
        return this.clientMode !== 'none';
    }

    /** El pago del pedido es al crédito. */
    get isCreditOrder(): boolean {
        return this.selectedPaymentType?.identifier === 'Crédito';
    }

    /** ── Pago bancario (Depósito / Cheque) ────────────────────── */

    /**
     * El pedido se paga con Depósito o con Cheque, así que hay que registrar de qué banco salió y
     * con qué número de transferencia o de cheque. El comentario sigue siendo opcional.
     * Qué tipos de pago lo piden lo decide requiresPaymentDetail (@app/helpers).
     */
    get isDepositOrder(): boolean {
        return requiresPaymentDetail(this.selectedPaymentType?.identifier);
    }

    /** El envío tiene costo y se paga con Depósito o con Cheque. */
    get isDepositDelivery(): boolean {
        return this.showDelivery && this.delivery > 0
            && requiresPaymentDetail(this.selectedDeliveryPaymentType?.identifier);
    }

    /**
     * La fecha se pide siempre que aplique el detalle bancario. Antes dependía del comentario
     * —sin comentario no se registraba pago—, pero ahora el pago se registra siempre, así que
     * siempre hay una fecha que elegir.
     */
    get showDepositDate(): boolean {
        return this.isDepositOrder;
    }

    get showDeliveryDepositDate(): boolean {
        return this.isDepositDelivery;
    }

    /** La tienda no tiene bancos cargados: no se puede registrar un pago con Depósito ni Cheque. */
    get hasNoBanks(): boolean {
        return !this.bankOptionsList.length;
    }

    /** Falta elegir banco o escribir la referencia en alguno de los dos pagos. */
    get missingPaymentDetail(): boolean {
        if (this.isDepositOrder && !(this.depositBankValue && this.depositReferenceValue)) return true;
        if (this.isDepositDelivery && !(this.deliveryDepositBankValue && this.deliveryDepositReferenceValue)) return true;
        return false;
    }

    private get depositBankValue(): string {
        return (this.orderForm?.get('depositBank')?.value ?? '').trim();
    }

    private get depositReferenceValue(): string {
        return (this.orderForm?.get('depositReferenceNo')?.value ?? '').trim();
    }

    private get deliveryDepositBankValue(): string {
        return (this.orderForm?.get('deliveryDepositBank')?.value ?? '').trim();
    }

    private get deliveryDepositReferenceValue(): string {
        return (this.orderForm?.get('deliveryDepositReferenceNo')?.value ?? '').trim();
    }

    /**
     * Los datos bancarios del pedido ya están completos y el envío también los pide, así que se
     * pueden copiar. Es el caso normal: una sola transferencia paga el pedido y el envío, y
     * reescribir el mismo banco y la misma referencia dos veces invita a equivocarse.
     *
     * Si el pedido no se paga con Depósito ni Cheque —o todavía no tiene banco y referencia— no hay
     * nada que copiar y el botón no aparece.
     */
    get canCopyOrderPaymentDetail(): boolean {
        return this.isDepositOrder && this.isDepositDelivery && !this.hasNoBanks
            && !!this.depositBankValue && !!this.depositReferenceValue;
    }

    /** Copia banco, referencia y fecha del pago del pedido al del envío. */
    copyOrderPaymentDetailToDelivery() {
        if (!this.canCopyOrderPaymentDetail) return;
        this.orderForm?.get('deliveryDepositBank')?.setValue(this.depositBankValue);
        this.orderForm?.get('deliveryDepositReferenceNo')?.setValue(this.depositReferenceValue);
        this.orderForm?.get('deliveryDepositDate')?.setValue(this.orderForm?.get('depositDate')?.value);
    }

    private get depositCommentValue(): string {
        return (this.orderForm?.get('depositComment')?.value ?? '').trim();
    }

    private get deliveryDepositCommentValue(): string {
        return (this.orderForm?.get('deliveryDepositComment')?.value ?? '').trim();
    }

    /**
     * Los datos del pago bancario solo tienen sentido mientras el método sea Depósito o Cheque:
     * si el usuario cambia de método se descartan para no mandarlos por error.
     * El formulario de edición no tiene estos campos, de ahí los null-checks.
     */
    private clearUnusedDepositFields() {
        const now = this.dataService.getLocalDateTimeInputValue();
        if (!this.isDepositOrder) {
            this.orderForm?.get('depositBank')?.setValue('');
            this.orderForm?.get('depositReferenceNo')?.setValue('');
            this.orderForm?.get('depositComment')?.setValue('');
            this.orderForm?.get('depositDate')?.setValue(now);
        }
        if (!this.isDepositDelivery) {
            this.orderForm?.get('deliveryDepositBank')?.setValue('');
            this.orderForm?.get('deliveryDepositReferenceNo')?.setValue('');
            this.orderForm?.get('deliveryDepositComment')?.setValue('');
            this.orderForm?.get('deliveryDepositDate')?.setValue(now);
        }
    }

    /** El envío tiene costo y se cobra al crédito. */
    get isCreditDelivery(): boolean {
        return this.showDelivery && this.delivery > 0
            && this.selectedDeliveryPaymentType?.identifier === 'Crédito';
    }

    get isCreditSale(): boolean {
        return this.isCreditOrder || this.isCreditDelivery;
    }

    /** Un cliente escrito a mano no es válido para una venta al crédito. */
    get manualClientDisabled(): boolean {
        return this.clientMode !== 'none' || (this.cobrarModalOpen && this.isCreditSale);
    }

    get filteredCustomers(): Customer[] {
        const term = this.customerSearchTerm?.trim().toLowerCase();
        if (!term) return this.customerOptions;
        return this.customerOptions.filter(customer =>
            customer.name?.toLowerCase().includes(term) ||
            customer.nit?.toLowerCase().includes(term) ||
            customer.phone?.toLowerCase().includes(term)
        );
    }

    addClientRow() {
        if (this.isCreditSale) return;
        this.clearSelectedCustomer();
        this.clientMode = 'manual';
        this.searchFocused = false;
    }

    removeClientRow() {
        this.clientMode = 'none';
        this.f['nameClient'].setValue('');
        this.f['nitClient'].setValue('');
    }

    /** Abre la fila de cliente registrado (excluyente con el manual). */
    addCustomerRow() {
        this.f['nameClient'].setValue('');
        this.f['nitClient'].setValue('');
        this.clientMode = 'existing';
        this.searchFocused = false;
        if (!this.selectedCustomer) {
            this.openCustomerPicker();
        }
    }

    removeCustomerRow() {
        if (this.isCreditSale) return;
        this.clientMode = 'none';
        this.clearSelectedCustomer();
        this.customerDropdownOpen = false;
    }

    openCustomerPicker() {
        this.customerSearchTerm = '';
        this.customerDropdownOpen = true;
    }

    /** Delay para que alcance a registrarse el click sobre una opción. */
    onCustomerBlur() {
        setTimeout(() => this.customerDropdownOpen = false, 200);
    }

    selectCustomer(customer: Customer) {
        this.selectedCustomer = customer;
        this.clientMode = 'existing';
        this.orderForm.get('customerId')?.setValue(customer.id ?? null);
        this.f['nameClient'].setValue('');
        this.f['nitClient'].setValue('');
        this.customerSearchTerm = '';
        this.customerDropdownOpen = false;
        this.syncCustomerRequirement();
    }

    clearSelectedCustomer() {
        this.selectedCustomer = undefined;
        this.orderForm.get('customerId')?.setValue(null);
    }

    /**
     * Mantiene coherente el cliente con el tipo de pago: en cuanto la venta
     * pasa a crédito el cliente manual se descarta y el registrado se vuelve
     * obligatorio.
     */
    syncCustomerRequirement() {
        const customerControl = this.orderForm?.get('customerId');
        if (!customerControl) return;

        if (this.isCreditSale) {
            if (this.clientMode === 'manual') {
                this.f['nameClient'].setValue('');
                this.f['nitClient'].setValue('');
                this.clientMode = this.selectedCustomer ? 'existing' : 'none';
            }
            customerControl.setValidators([Validators.required]);
        } else {
            customerControl.clearValidators();
        }
        customerControl.updateValueAndValidity();
    }

    /** El modal solo se puede cerrar con la X (backdrop estático, sin ESC). */
    onOpenCobrarModal() {
        this.cobrarModalOpen = true;
        this.customerDropdownOpen = false;
        this.syncCustomerRequirement();
    }

    onCloseCobrarModal() {
        this.cobrarModalOpen = false;
        this.customerDropdownOpen = false;
    }

    addDeliveryRow() {
        this.showDelivery = true;
        this.searchFocused = false;
    }

    removeDeliveryRow() {
        this.showDelivery = false;
        this.delivery = 0;
        this.f['delivery'].setValue('0');
        this.syncCustomerRequirement();
        this.clearUnusedDepositFields();
    }

    addCommentRow() {
        this.showComment = true;
        this.searchFocused = false;
    }

    removeCommentRow() {
        this.showComment = false;
        this.f['nota'].setValue('');
    }

    itemHasDiscount(item: ItemsList): boolean {
        return Number(item.totalDiscount) > 0;
    }

    /** Precio unitario (por medida) ya con el descuento aplicado. */
    itemDiscountedUnitPrice(item: ItemsList): number {
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) return Number(item.price) || 0;
        return (Number(item.total) || 0) / qty;
    }

    rawMaterialForm!: FormGroup;
    rawMaterialOrder?: RawMaterialOrder;
    selectedMeasure?: Measure;
    selectedPaymentType?: PaymentType;
    selectedPaymentTypeSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedDeliveryPaymentType?: PaymentType;
    selectedDeliveryPaymentTypeSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
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
    discountInputName = 'Descuento (Q) por ';
    discountMeasureValue: any = [];
    activityLogName = "Acciones de Producto para Venta en tienda";
    activityLog?: ActivityLog;
    isEditMode = false;
    editingIndex?: number;

    @ViewChild('cobrarCloseBtn') cobrarCloseBtnRef?: ElementRef;

    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute,
        private imageCompress: NgxImageCompressService, private alertService: AlertService,
        private router: Router, private formBuilder: FormBuilder, private modalService: NgbModal) {

        this.selectedPaymentTypeSubject.subscribe(value => {
            this.setPaymentType(value);
        });
        this.selectedDeliveryPaymentTypeSubject.subscribe(value => {
            this.setDeliveryPaymentType(value);
        });
    }


    ngOnInit(): void {

        this.id = this.route.snapshot.params['id'];

        let establishmentId = '';
        this.route.queryParams.subscribe(params => {
            establishmentId = params['strId'];
        });
        
        this.title = 'Registrar Venta';

        this.orderForm = this.createAddFormGroup();
        this.rawMaterialForm = this.createMaterialFormGroup();

        this.inventoryElements = [];
        this.allInventoryElements = this.inventoryElements;
        this.unselectedInventoryElements = [];
        this.itemsList = [];

        this.inventory = undefined;
        let requestArray = [];

        if (this.id){
            this.title = 'Actualizar Venta';
            this.orderForm = this.createEditFormGroup();
            this.isEditOption = true;
            this.dataService.getShopHistoryById({id: this.id})
                .pipe(first())
                .subscribe((shopResumRes: any) => {
                    let shopRes = this.dataService.findJsonValue(shopResumRes, 'json_result') || {};
                    if (shopRes){
                        this.shopResume = shopRes;
                        this.orderForm.patchValue(this.shopResume!);
                        // El cliente registrado no se modifica desde la edición
                        this.isRegisteredCustomerSale = !!this.shopResume?.customer?.id;
                        if (this.isRegisteredCustomerSale){
                            this.selectedCustomer = this.shopResume?.customer;
                            this.f['nameClient'].disable();
                            this.f['nitClient'].disable();
                        }
                        this.loading = false;
                    }
                });
        } else {

            requestArray.push(this.dataService.getAnyComponent({}, 'getPaymentTypes')); // paymentTypeRequest
            requestArray.push(this.dataService.getAnyComponent({}, 'getMeasure')); // measureRequest
            requestArray.push(this.dataService.getInventoryByType({unit_name: establishmentId}, 'retrieveProductForSaleInventoryV2'));
            requestArray.push(this.dataService.getEstablishmentById(establishmentId));
            // Solo los clientes asignados a esta tienda
            requestArray.push(this.dataService.getEstablishmentCustomers(establishmentId));

            forkJoin(requestArray).subscribe({
                next: (result: any) => {
                    this.paymentTypeOptions = this.dataService.findJsonValue(result[0], 'json_result') || [];
                    this.measureOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];
                    this.filteredMeasureOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];
                    this.inventory = this.dataService.findJsonValue(result[2], 'json_result') || {};
                    this.establishment = this.dataService.findJsonValue(result[3], 'json_result') || {};
                    // Los bancos del select del pago salen del listado de la tienda
                    this.bankOptionsList = bankOptions(this.establishment?.banks);
                    this.customerOptions = this.dataService.findJsonValue(result[4], 'json_result') || [];
                },
                error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
                complete: () => {
                    if (this.inventory){
                        this.inventoryElements = this.inventory?.inventoryElements || [];
                        // this.inventoryElements = this.inventoryElements?.filter(invElem =>invElem.productForSale?.establishment?.id === String(this.establishment?.id));
                        this.allInventoryElements = this.inventoryElements;
                    }
                    const efectivo = this.paymentTypeOptions?.find(pt => pt.identifier === 'Efectivo');
                    if (efectivo) {
                        this.paymentTypeSelect?.setValue(String(efectivo.id));
                        this.selectedPaymentTypeSubject.next(String(efectivo.id));
                        this.deliveryPaymentTypeSelect?.setValue(String(efectivo.id));
                        this.selectedDeliveryPaymentTypeSubject.next(String(efectivo.id));
                    }
                    this.loading = false;
                    this.title = 'Registrar Venta (' + this.establishment?.name + ')';
                    this.activityLogName = this.activityLogName + "|||" + this.establishment?.id;
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
            this.findAndMoveInventoryElementById(true, rawMaterialOrder.rawMaterialByProvider?.id);
        });
    }

    onResetForm() {
        this.orderForm.reset();
    }

    onResetMaterialForm(){
        this.discountMeasureValue = [];
        this.rawMaterialForm.reset();
        this.rawMaterialForm.get('discount')?.setValue('0');
        this.selectedIE = undefined;
        this.selectedMeasure = undefined;
        this.currentMeasurePrice = 0;
        this.currentMeasureQuantity = 0;
        this.modalDiscount = 0;
        this.modalQuantity = 0;
        this.elements = [];
        this.isEditMode = false;
        this.editingIndex = undefined;
    }

    dataPrice(value?: string | number): string {
        return this.dataService.getFormatedPrice(Number(value || 0));
    }

    /** Cierra el modal de cobro y guarda la venta. */
    onCobrar() {
        if (this.isCreditSale && !this.selectedCustomer){
            this.alertService.error('Una venta al crédito requiere seleccionar un cliente registrado');
            return;
        }
        this.cobrarCloseBtnRef?.nativeElement?.click();
        this.cobrarModalOpen = false;
        this.onSaveForm();
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
                            this.router.navigateByUrl('/store/sales/history/' + this.shopResume?.establishment?.id);
                        } else {
                            this.router.navigateByUrl('/store/sales/history/' + this.establishment?.id);
                        }
                    },
                    error: error => {
                        const errorMessage = this.dataService.getErrorMessageResponse(error, 'Error al guardar la venta');
                        this.alertService.error(errorMessage);
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
            const isDepositOrder = this.isDepositOrder;
            const isDepositDelivery = this.isDepositDelivery;
            let newShopResume: ShopResume = {
                ...this.orderForm.value,
                // Con cliente registrado la venta viaja solo con la referencia:
                // nameClient / nitClient quedan vacíos y la base los guarda en NULL
                customer: this.selectedCustomer,
                establecimiento: this.establishment,
                establishment: this.establishment,
                total: this.grandTotal.toFixed(2),
                subtotal: this.itemsSubtotal.toFixed(2),
                totalDiscount: this.calculateTotalDiscount().toFixed(2),
                delivery: String(this.delivery),
                paymentType: this.selectedPaymentType,
                deliveryPaymentType: this.selectedDeliveryPaymentType,
                itemsList: this.itemsList,
                // Pago bancario (Depósito o Cheque): con banco y referencia la base siempre
                // registra el pago, así que la fecha va junto. Si el método es otro se manda todo
                // vacío y no se registra nada. El input da hora local y la BD guarda UTC.
                depositBank: isDepositOrder ? this.depositBankValue : '',
                depositReferenceNo: isDepositOrder ? this.depositReferenceValue : '',
                depositComment: isDepositOrder ? this.depositCommentValue : '',
                depositDate: isDepositOrder
                    ? this.dataService.getUTCTimeFromLocalDateTime(this.f['depositDate'].value)
                    : '',
                deliveryDepositBank: isDepositDelivery ? this.deliveryDepositBankValue : '',
                deliveryDepositReferenceNo: isDepositDelivery ? this.deliveryDepositReferenceValue : '',
                deliveryDepositComment: isDepositDelivery ? this.deliveryDepositCommentValue : '',
                deliveryDepositDate: isDepositDelivery
                    ? this.dataService.getUTCTimeFromLocalDateTime(this.f['deliveryDepositDate'].value)
                    : '',
            }
            return this.dataService.registerShop(newShopResume);
        }
    }

    onSaveMaterialForm(){
        if (this.isEditMode && this.editingIndex !== undefined) {
            let updatedItem: ItemsList = {
                productForSale: this.selectedIE?.productForSale,
                ...this.rawMaterialForm.value,
                price: this.currentMeasurePrice,
                measure: this.selectedMeasure,
                subtotal: this.modalSubtotal,
                totalDiscount: this.modalTotalDiscount,
                total: this.modalTotal,
            };
            this.itemsList![this.editingIndex] = updatedItem;
        } else {
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
            this.findAndMoveInventoryElementById(true, this.selectedIE?.productForSale?.id);
        }
        this.onResetMaterialForm();
    }

    selectItemListForEdit(itemList: ItemsList, index: number){
        const invElement = this.unselectedInventoryElements?.find(
            el => el.productForSale?.id === itemList.productForSale?.id
        );
        if (!invElement) return;

        this.isEditMode = true;
        this.editingIndex = index;
        this.selectedIE = invElement;
        this.elements = [];
        this.setInventoryElemElements(this.selectedIE);
        this.filteredMeasureOptions = this.measureOptions?.filter(
            item => this.selectedIE?.productForSale?.finishedProduct?.measure?.identifier?.includes(item.unitBase?.name!)
        );
        this.measureSelect?.setValue(String(itemList.measure?.id));
        this.changeMeasure(String(itemList.measure?.id));
        this.rawMaterialForm.get('quantity')?.setValue(itemList.quantity);
        this.rawMaterialForm.get('discount')?.setValue(itemList.discount ?? '0');
        this.modalQuantity = Number(itemList.quantity);
        this.modalDiscount = Number(itemList.discount) || 0;
        this.calculateModalTotals();
    }

    selectMeasure(measureId?: string){
        return this.measureOptions?.find(measure => String(measure.id) === measureId);
    }

    findPaymentType(paymentId?: string){
        return this.paymentTypeOptions?.find(payment => String(payment.id) === paymentId);
    }

    findAndMoveInventoryElementById(isSelect: boolean, productForSaleId?: string){
        if (isSelect){
            let invElementResult = this.inventoryElements?.find(invElement => invElement.productForSale?.id === productForSaleId);
            if (invElementResult) {
                this.inventoryElements = this.inventoryElements?.filter(invElement => invElement.productForSale?.id !== productForSaleId);
                this.unselectedInventoryElements?.push(invElementResult);
            }
        } else { // unselect
            let invElementResult = this.unselectedInventoryElements?.find(invElement => invElement.productForSale?.id === productForSaleId);
            if (invElementResult){
                this.unselectedInventoryElements = this.unselectedInventoryElements?.filter(invElement => invElement.productForSale?.id !== productForSaleId);
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
        this.syncCustomerRequirement();
        this.clearUnusedDepositFields();
    }

    setDeliveryPaymentType(payment: any){
        this.selectedDeliveryPaymentType = this.findPaymentType(payment);
        this.syncCustomerRequirement();
        this.clearUnusedDepositFields();
    }

    get deliveryPaymentTypeSelect(){
        return this.orderForm.get('deliveryPaymentType');
    }

    get deliveryPaymentTypeOptions(): PaymentType[] {
        return this.paymentTypeOptions?.filter(pt => pt.identifier !== 'Cheque') ?? [];
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
        console.log(this.filteredMeasureOptions);
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
        this.findAndMoveInventoryElementById(false, itemList?.productForSale?.id);
        // this.filteredRawMaterials?.push(orderElement.rawMaterialByProvider!);
    }

    calculateSubtotal() {
        let subtotal = 0;
        if (this.itemsList){
            for(const itemList of this.itemsList){
                subtotal += Number(itemList.total) || 0;
            }
        }
        this.subtotal = subtotal;
        return subtotal;
    }

    calculateSubtotalWithoutDiscount() {
        let subtotal = 0;
        if (this.itemsList){
            for(const itemList of this.itemsList){
                subtotal += Number(itemList.subtotal) || 0;
            }
        }
        this.subtotal = subtotal;
        return subtotal;
    }

    calculateTotalDiscount() {
        let totalDiscount = 0;
        if (this.itemsList){
            for (const itemList of this.itemsList) {
                totalDiscount += Number(itemList.totalDiscount) || 0;
            }
        }
        this.totalDiscount = totalDiscount;
        return totalDiscount;
    }
    
    setDeliveryValue(event: Event){
        if (!(event.target instanceof HTMLInputElement)) return;
        // Solo dígitos y un punto, con máximo 2 decimales
        let v = event.target.value.replace(/[^\d.]/g, '');
        const dot = v.indexOf('.');
        if (dot !== -1) {
            const intPart = v.slice(0, dot);
            const decPart = v.slice(dot + 1).replace(/\./g, '').slice(0, 2);
            v = intPart + '.' + decPart;
        }
        event.target.value = v;
        this.f['delivery'].setValue(v);
        this.delivery = Number(v) || 0;
        this.syncCustomerRequirement();
        this.clearUnusedDepositFields();
    }

    calculateTotal(){
        this.total = this.subtotal + this.delivery;
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
        let totalDiscount = Number(this.modalDiscount)*(Number(totalQuantity)/Number(this.discountMeasureValue?.unitBase?.quantity)) || 0;
        // let totalDiscount = Number(this.modalDiscount)*Number(this.modalQuantity) || 0;
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
        this.selectedQuantity = parseFloat(totalQuantity.toFixed(2));
        this.modalSubtotal = subtotal;
        this.modalTotalDiscount = totalDiscount;
        this.modalTotal = total;
        this.modalSubtotalText = this.dataService.getFormatedPrice(subtotal);
        this.modalTotalDiscountText = this.dataService.getFormatedPrice(totalDiscount);
        this.modalTotalText = this.dataService.getFormatedPrice(total);
    }

    createAddFormGroup() {
        return new FormGroup({
            nameClient: new FormControl('', [
            Validators.maxLength(50),
            ]),
            nitClient: new FormControl('', [ Validators.maxLength(10),]),
            // Obligatorio solo cuando la venta es al crédito (ver syncCustomerRequirement)
            customerId: new FormControl(null),
            nota: new FormControl('', [Validators.maxLength(100)]),
            paymentType: new FormControl('', [Validators.required]),
            deliveryPaymentType: new FormControl('', [Validators.required]),
            delivery: new FormControl('0', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
            // Pago bancario: solo se usan cuando el método es Depósito o Cheque. Banco y
            // referencia son obligatorios en ese caso —lo exige missingPaymentDetail, no un
            // Validators.required, porque dependen del método elegido—; el comentario es opcional.
            depositBank: new FormControl('', [Validators.maxLength(this.bankMaxLength)]),
            depositReferenceNo: new FormControl('', [Validators.maxLength(this.referenceMaxLength)]),
            depositComment: new FormControl('', [Validators.maxLength(this.commentMaxLength)]),
            depositDate: new FormControl(this.dataService.getLocalDateTimeInputValue()),
            deliveryDepositBank: new FormControl('', [Validators.maxLength(this.bankMaxLength)]),
            deliveryDepositReferenceNo: new FormControl('', [Validators.maxLength(this.referenceMaxLength)]),
            deliveryDepositComment: new FormControl('', [Validators.maxLength(this.commentMaxLength)]),
            deliveryDepositDate: new FormControl(this.dataService.getLocalDateTimeInputValue()),
        //   applyDate: new FormControl('', [Validators.required])
        });
    }

    createEditFormGroup() {
        return new FormGroup({
            nameClient: new FormControl('', [
            Validators.maxLength(50),
            ]),
            nitClient: new FormControl('', [ Validators.maxLength(10),]),
            nota: new FormControl('', [Validators.maxLength(100)]),
        });
    }

    createMaterialFormGroup() {
        return new FormGroup({
            quantity: new FormControl('', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
            discount: new FormControl('0', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]),
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
        this.discountMeasureValue = invElement.measure?.unitBase?.name === measureUnitsConst.unidad.unitBase.name ? measureUnitsConst.docena : measureUnitsConst.libra;
        console.log("Discount Measure Value: ", this.discountMeasureValue);
        console.log("Inventory Element: ", invElement);
    }

    closeRawMaterialDialog(){
        this.onResetMaterialForm();
    }

}