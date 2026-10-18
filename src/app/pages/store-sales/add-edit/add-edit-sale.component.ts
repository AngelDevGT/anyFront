import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {BehaviorSubject, EMPTY, forkJoin, of} from 'rxjs';
import {concatMap, first} from 'rxjs/operators';
import { NgxImageCompressService } from 'ngx-image-compress';

import { statusValues, AlertService, DataService, measureUnitsConst, pfsFactoryOrderStatusValues, pfsStoreOrderStatusValues } from '@app/services';
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
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { ElementQuantityPickerComponent, QuantityPickerItem, QuantityPickerSelection } from '@app/components/element-quantity-picker/element-quantity-picker.component';

/** Valor de `opt` con el que el detalle de un pedido Recibido abre esta pantalla ("Vender pedido"). */
export const SALE_PFS_ORDER_OPTION = 'sale_pfs_order';
/** Valor de `opt` con el que el detalle de un pedido Listo abre esta pantalla ("Recibir y vender"). */
export const RECEIVE_AND_SELL_OPTION = 'receive_n_sale';

/** Producto del pedido que no se pudo cargar completo porque no alcanzó el inventario. */
interface OrderShortage {
    name: string;
    measure: string;
    ordered: number;
    loaded: number;
}

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

    /**
     * Tabla de productos con medida, cantidad y descuento en línea (en lugar de un modal por
     * producto). `pickerItems` son los productos de la tienda con su existencia; `pickerInitial`
     * son las filas que arrancan llenas (venta de un pedido). Lo que se escribe vuelve en
     * `onSelectionChange` y arma el carrito (`itemsList`).
     */
    pickerItems: QuantityPickerItem[] = [];
    pickerInitial: QuantityPickerSelection[] = [];
    @ViewChild('picker') picker?: ElementQuantityPickerComponent;

    // POS UI state
    showDelivery = false;
    showComment = false;
    actionsSheetOpen = false;

    /**
     * Cliente de la venta. 'manual' y 'existing' son excluyentes: al entrar a
     * uno se limpia el otro. Las ventas al crédito o con descuento solo admiten 'existing'.
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
     * Tope del selector de fecha del pago: no se puede cobrar en el futuro. Solo lo valida el
     * front — la procedure guarda lo que le llega, para que un front revertido nunca deje a la
     * tienda sin poder vender. Hacia atrás no hay límite: desde 2026-09-22 la fecha del pago es
     * una referencia y ya no decide a qué cierre de caja pertenece el dinero.
     */
    get maxPaymentDate(): string {
        return this.dataService.getLocalDateTimeInputValue();
    }
    /**
     * Bancos de la tienda, para el select del pago. Salen de establishment.banks, que ya viene en
     * la misma petición que arma la pantalla. Si la tienda no tiene ninguno cargado no se puede
     * cobrar con Depósito ni con Cheque: el formulario lo dice y bloquea el registro.
     */
    bankOptionsList: string[] = [];

    /**
     * Venta de un pedido. La pantalla llega con `order=<id>` y uno de dos `opt`:
     *  - `sale_pfs_order` ("Vender pedido"): pedido Recibido, se vende contra el inventario de la
     *    tienda, que ya lo incluye;
     *  - `receive_n_sale` ("Recibir y vender"): pedido Listo, se vende contra el inventario de la
     *    tienda MÁS el pedido, y al cobrar el pedido se recibe en la misma transacción.
     * En los dos casos se cargan los productos del pedido y la venta queda ligada a él.
     */
    saleOption?: string;
    pfsOrderId?: string;
    pfsOrder?: ProductForSaleStoreOrder;
    /** Productos del pedido que se cargaron incompletos o no se cargaron. Se muestran en un aviso fijo. */
    orderShortages: OrderShortage[] = [];

    get isOrderSale(): boolean {
        return (this.saleOption === SALE_PFS_ORDER_OPTION || this.saleOption === RECEIVE_AND_SELL_OPTION)
            && !!this.pfsOrderId;
    }

    get isReceiveAndSell(): boolean {
        return this.isOrderSale && this.saleOption === RECEIVE_AND_SELL_OPTION;
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
     * nada que copiar y el botón no aparece. Tampoco aparece si el pedido y el envío se cobran con
     * métodos distintos (uno con Depósito y el otro con Cheque): ahí son dos pagos separados y
     * copiar la referencia de uno al otro sería un error.
     */
    get canCopyOrderPaymentDetail(): boolean {
        return this.isDepositOrder && this.isDepositDelivery && !this.hasNoBanks
            && this.selectedPaymentType?.identifier === this.selectedDeliveryPaymentType?.identifier
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

    /** Algún producto del carrito lleva descuento. */
    get hasDiscountedItems(): boolean {
        return !!this.itemsList?.some(item => this.itemHasDiscount(item));
    }

    /**
     * La venta tiene que quedar a nombre de un cliente registrado: al crédito, para poder
     * cobrarle después, y con descuento, para saber a quién se le hizo.
     */
    get requiresRegisteredCustomer(): boolean {
        return this.isCreditSale || this.hasDiscountedItems;
    }

    /** Por qué se exige cliente registrado; se muestra en el cobro. */
    get registeredCustomerReason(): string {
        return this.isCreditSale
            ? 'Una venta al crédito debe registrarse a nombre de un cliente existente.'
            : 'Una venta con descuento debe registrarse a nombre de un cliente existente.';
    }

    /** Un cliente escrito a mano no es válido para una venta al crédito ni con descuento. */
    get manualClientDisabled(): boolean {
        return this.clientMode !== 'none' || this.hasDiscountedItems
            || (this.cobrarModalOpen && this.isCreditSale);
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
        if (this.requiresRegisteredCustomer) return;
        this.clearSelectedCustomer();
        this.clientMode = 'manual';
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
        if (!this.selectedCustomer) {
            this.openCustomerPicker();
        }
    }

    removeCustomerRow() {
        if (this.requiresRegisteredCustomer) return;
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
     * Mantiene coherente el cliente con el tipo de pago y los descuentos: en cuanto la venta
     * pasa a crédito o lleva algún descuento, el cliente manual se descarta y el registrado se
     * vuelve obligatorio. Con descuento, además, la fila de cliente registrado se agrega sola
     * para que el cajero lo elija antes de cobrar.
     */
    syncCustomerRequirement() {
        const customerControl = this.orderForm?.get('customerId');
        if (!customerControl) return;

        if (this.requiresRegisteredCustomer) {
            if (this.clientMode === 'manual') {
                this.f['nameClient'].setValue('');
                this.f['nitClient'].setValue('');
                this.clientMode = this.selectedCustomer ? 'existing' : 'none';
            }
            if (this.hasDiscountedItems) {
                this.clientMode = 'existing';
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

    rawMaterialOrder?: RawMaterialOrder;
    selectedPaymentType?: PaymentType;
    selectedPaymentTypeSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedDeliveryPaymentType?: PaymentType;
    selectedDeliveryPaymentTypeSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    paymentTypeOptions?: PaymentType[];
    constantes?: Constant[];
    itemsList?: ItemsList[];
    totalDiscount = 0;
    delivery = 0;
    subtotal = 0;
    total = 0;
    paidAmount = 0;
    pendingAmount = 0;
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
    measureOptions?: Measure[];
    id?: string;
    shopResume?: ShopResume;
    activityLogName = "Acciones de Producto para Venta en tienda";
    activityLog?: ActivityLog;

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
            this.saleOption = params['opt'];
            this.pfsOrderId = this.saleOption === SALE_PFS_ORDER_OPTION || this.saleOption === RECEIVE_AND_SELL_OPTION
                ? params['order']
                : undefined;
        });

        this.title = 'Registrar Venta';

        this.orderForm = this.createAddFormGroup();

        this.inventoryElements = [];
        this.allInventoryElements = this.inventoryElements;
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
            // "Vender pedido": el pedido viaja en la misma tanda, al final
            if (this.isOrderSale) {
                requestArray.push(this.dataService.getProductForSaleOrderById(this.pfsOrderId!));
            }

            forkJoin(requestArray).subscribe({
                next: (result: any) => {
                    this.paymentTypeOptions = this.dataService.findJsonValue(result[0], 'json_result') || [];
                    this.measureOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];
                    this.inventory = this.dataService.findJsonValue(result[2], 'json_result') || {};
                    this.establishment = this.dataService.findJsonValue(result[3], 'json_result') || {};
                    // Los bancos del select del pago salen del listado de la tienda
                    this.bankOptionsList = bankOptions(this.establishment?.banks);
                    this.customerOptions = this.dataService.findJsonValue(result[4], 'json_result') || [];
                    if (this.isOrderSale) {
                        this.pfsOrder = this.dataService.findJsonValue(result[5], 'json_result') || undefined;
                    }
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
                    if (this.isOrderSale) {
                        this.loadOrderIntoSale();
                    }
                    // Después de cargar el pedido: "Recibir y vender" le suma sus productos al inventario
                    this.buildPickerItems();
                }
            });
        }


    }

    // ── Venta de un pedido ───────────────────────────────────────────────────

    /**
     * Revisa que el pedido se pueda vender y carga sus productos. Las mismas reglas las vuelve a
     * validar la base al cobrar (register_shop_sale_with_elements_v8, y para "Recibir y vender"
     * también manage_product_for_sale_order_state_v6); acá solo se evita armar una venta que de
     * todos modos va a rechazar.
     *
     * Si el pedido no sirve, la pantalla queda como una venta normal, sin ligarse a él.
     */
    private loadOrderIntoSale() {
        const order = this.pfsOrder;
        const f = pfsFactoryOrderStatusValues;
        let error = '';
        if (!order?.id) {
            error = 'No se pudo cargar el pedido.';
        } else if (order.establishment?.id !== this.establishment?.id) {
            error = 'El pedido no pertenece a esta tienda.';
        } else if (!this.isReceiveAndSell && order.storeStatus?.id != pfsStoreOrderStatusValues.recibido.status.id) {
            error = 'Solo se puede vender un pedido Recibido.';
        } else if (this.isReceiveAndSell
            && !(order.factoryStatus?.id == f.listo.status.id || order.factoryStatus?.id == f.en_camino.status.id)) {
            error = 'Solo se puede recibir y vender un pedido Listo.';
        } else if (!this.establishment?.sellOrdersEnabled) {
            error = 'La tienda no tiene habilitada la venta de pedidos.';
        } else if (order.shopSaleId) {
            error = 'El pedido ya tiene una venta registrada.';
        }

        if (error) {
            this.alertService.error(error + ' Se registrará como una venta normal.');
            this.pfsOrderId = undefined;
            this.pfsOrder = undefined;
            return;
        }

        this.title = (this.isReceiveAndSell ? 'Recibir y vender pedido #' : 'Vender pedido #')
            + (order!.orderNumber ?? '') + ' (' + this.establishment?.name + ')';
        if (this.isReceiveAndSell) {
            this.mergeOrderIntoInventory(order!);
        }
        this.preloadOrderItems(order!);
    }

    /**
     * "Recibir y vender": suma el pedido al inventario de la tienda que muestra la pantalla, como
     * va a quedar después de recibirlo. Así se puede vender cualquier producto de los dos, y lo
     * que no se venda queda en la tienda.
     *
     * Es solo en pantalla: el movimiento real lo hace la base al cobrar, recibiendo el pedido
     * antes de descontar la venta. Por eso la venta nunca puede pasar de inventario + pedido.
     *
     * Las cantidades del inventario están en la medida de cada elemento; el pedido se pasa a
     * unidad base y de ahí a esa medida. Un producto del pedido que la tienda nunca tuvo se agrega
     * como elemento nuevo en su medida base, la misma en la que lo registra la recepción.
     */
    private mergeOrderIntoInventory(order: ProductForSaleStoreOrder) {
        for (const element of order.productForSaleStoreOrderElements ?? []) {
            const measure = this.measureOptions?.find(m => String(m.id) === String(element.measure?.id));
            const orderedBase = (Number(element.quantity) || 0) * (Number(measure?.unitBase?.quantity) || 0);
            if (orderedBase <= 0) continue;

            const invElement = this.inventoryElements?.find(ie => ie.productForSale?.id === element.productForSale?.id);
            if (invElement) {
                const invMeasureBase = Number(invElement.measure?.unitBase?.quantity) || 1;
                invElement.quantity = String((Number(invElement.quantity) || 0) + orderedBase / invMeasureBase);
                continue;
            }

            const unitName = element.productForSale?.finishedProduct?.measure?.identifier;
            const baseMeasure = this.measureOptions?.find(m =>
                m.unitBase?.name === unitName && Number(m.unitBase?.quantity) === 1);
            // Sin medida base no se puede vender en pantalla; preloadOrderItems lo reporta como faltante
            if (!baseMeasure) continue;

            this.inventoryElements?.push({
                productForSale: element.productForSale,
                measure: baseMeasure,
                quantity: String(orderedBase),
            });
        }
    }

    /**
     * Llena la tabla con cada producto del pedido, en la medida y cantidad del pedido. Si el
     * inventario no alcanza se carga lo que hay —redondeado hacia abajo a 2 decimales, el máximo
     * que acepta la cantidad— y el producto queda en orderShortages para el aviso.
     *
     * El carrito se arma solo, cuando la tabla avisa de sus filas llenas. Cada fila se puede
     * editar o quitar después como cualquier otra.
     */
    private preloadOrderItems(order: ProductForSaleStoreOrder) {
        this.orderShortages = [];
        this.pickerInitial = [];

        for (const element of order.productForSaleStoreOrderElements ?? []) {
            const name = element.productForSale?.finishedProduct?.name ?? 'Producto';
            const measure = this.measureOptions?.find(m => String(m.id) === String(element.measure?.id));
            const measureLabel = measure?.identifier ?? element.measure?.identifier ?? '';
            const ordered = Number(element.quantity) || 0;
            const measureBase = Number(measure?.unitBase?.quantity) || 0;
            const invElement = this.inventoryElements?.find(ie => ie.productForSale?.id === element.productForSale?.id);

            if (ordered <= 0) continue;
            if (!invElement || measureBase <= 0) {
                this.orderShortages.push({ name, measure: measureLabel, ordered, loaded: 0 });
                continue;
            }

            const availableBase = Number(invElement.measure?.unitBase?.quantity) * Number(invElement.quantity) || 0;
            const available = Math.max(0, Math.floor((availableBase / measureBase) * 100) / 100);
            const quantity = Math.min(ordered, available);

            if (quantity < ordered) {
                this.orderShortages.push({ name, measure: measureLabel, ordered, loaded: quantity });
            }
            if (quantity <= 0) continue;

            this.pickerInitial.push({
                id: invElement.productForSale?.id,
                measure: { id: String(measure!.id), identifier: measure!.identifier },
                quantity,
                discount: 0
            });
        }
    }

    /** Vuelve al detalle del pedido, en la vista de tienda. */
    private navigateToOrder() {
        this.router.navigate(['/productsForSale/order/view/' + this.pfsOrderId], {
            queryParams: { opt: 'store', store: this.establishment?.id, name: this.establishment?.name }
        });
    }


    onResetForm() {
        this.orderForm.reset();
    }


    dataPrice(value?: string | number): string {
        return this.dataService.getFormatedPrice(Number(value || 0));
    }

    /** Cierra el modal de cobro y guarda la venta. */
    onCobrar() {
        if (this.requiresRegisteredCustomer && !this.selectedCustomer){
            this.alertService.error(this.registeredCustomerReason);
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
                        } else if (this.isOrderSale) {
                            // La venta salió de un pedido: se vuelve a él, que ahora muestra "Ver venta"
                            this.navigateToOrder();
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
                // "Vender pedido": la base liga la venta al pedido y valida que se pueda vender
                pfsStoreOrderId: this.isOrderSale ? this.pfsOrderId : '',
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
            // "Recibir y vender": la base recibe el pedido y registra la venta en una sola transacción
            return this.isReceiveAndSell
                ? this.dataService.receiveAndSellPFSOrder(newShopResume)
                : this.dataService.registerShop(newShopResume);
        }
    }



    /**
     * Un producto del inventario de la tienda como fila de la tabla. La existencia viaja en unidad
     * base, para que el tope valga en la medida que se elija (existencia en unidades, venta en
     * docenas). Sin existencia, la fila no admite cantidad.
     */
    private buildPickerItems(){
        this.pickerItems = (this.inventoryElements || []).map(invElement => {
            const stock = Number(invElement.quantity) || 0;
            const stockBase = stock * (Number(invElement.measure?.unitBase?.quantity) || 0);
            return {
                id: invElement.productForSale?.id,
                title: invElement.productForSale?.finishedProduct?.name,
                // El precio se ve en la tabla, como se veía en la lista de productos
                subtitle: this.dataPrice(invElement.productForSale?.price),
                // Las medidas cuya unidad base coincide con la del producto, como en el modal
                measures: (this.measureOptions || [])
                    .filter(measure => invElement.productForSale?.finishedProduct?.measure?.identifier?.includes(measure.unitBase?.name!))
                    .map(measure => ({
                        id: measure.id,
                        identifier: measure.identifier,
                        unitBaseQuantity: Number(measure.unitBase?.quantity)
                    })),
                maxBase: stockBase,
                stockText: (Math.round(stock * 100) / 100) + ' ' + (invElement.measure?.identifier ?? ''),
                discountUnit: this.discountMeasureOf(invElement).identifier?.toLowerCase()
            } as QuantityPickerItem;
        });
    }

    /**
     * En qué se cuenta el descuento de un producto: por docena si se maneja por unidad, por libra
     * si se maneja por libra. Es la regla de siempre; el descuento que se teclea es por esa medida
     * y el total de la línea es ese valor por las docenas (o libras) que se llevan.
     */
    private discountMeasureOf(invElement: InventoryElement){
        return invElement.measure?.unitBase?.name === measureUnitsConst.unidad.unitBase.name
            ? measureUnitsConst.docena
            : measureUnitsConst.libra;
    }

    /**
     * Una fila de la tabla como línea del carrito. Las cuentas son las del modal de antes:
     *   precio       = precio de venta por unidad base * unidades base de la medida
     *   subtotal     = cantidad * precio
     *   descuento    = descuento tecleado * (cantidad en unidad base / unidades base de la medida del descuento)
     *   total        = subtotal - descuento
     * `discount` conserva lo tecleado (por docena o por libra) y `totalDiscount` el total aplicado.
     */
    private buildSaleLine(selection: QuantityPickerSelection): ItemsList | undefined {
        const invElement = this.inventoryElements?.find(ie => ie.productForSale?.id === selection.id);
        const measure = this.selectMeasure(String(selection.measure?.id));
        if (!invElement || !measure) return undefined;

        const measureBase = Number(measure.unitBase?.quantity);
        const discount = selection.discount ?? 0;
        const price = Number(invElement.productForSale?.price) * measureBase;
        const subtotal = selection.quantity * price;
        const discountBase = Number(this.discountMeasureOf(invElement).unitBase.quantity);
        const totalDiscount = discount * ((selection.quantity * measureBase) / discountBase) || 0;

        return {
            productForSale: invElement.productForSale,
            quantity: String(selection.quantity),
            discount: String(discount),
            measure,
            price: String(price),
            subtotal: String(subtotal),
            totalDiscount: String(totalDiscount),
            total: String(subtotal - totalDiscount)
        };
    }

    /** El descuento no puede dejar la línea en negativo. Antes el modal reiniciaba todo a 0. */
    rowValidator = (selection: QuantityPickerSelection): string | null => {
        const line = this.buildSaleLine(selection);
        return line && Number(line.total) < 0 ? 'El descuento supera el total de la línea' : null;
    };

    /** Lo escrito en la tabla es el carrito. */
    onSelectionChange(selection: QuantityPickerSelection[]){
        this.itemsList = selection
            .map(item => this.buildSaleLine(item))
            .filter((line): line is ItemsList => !!line);
        // Un producto pudo ganar o perder descuento: eso decide si hace falta cliente registrado
        this.syncCustomerRequirement();
    }

    /** La tabla tiene alguna fila a medias (cantidad mal escrita, sin medida o con descuento de más). */
    get pickerInvalid(): boolean {
        return !!this.picker?.hasInvalid;
    }

    selectMeasure(measureId?: string){
        return this.measureOptions?.find(measure => String(measure.id) === measureId);
    }

    findPaymentType(paymentId?: string){
        return this.paymentTypeOptions?.find(payment => String(payment.id) === paymentId);
    }


    get f() {
        return this.orderForm.controls;
    }



    get paymentTypeSelect(){
        return this.orderForm.get('paymentType');
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







    createAddFormGroup() {
        return new FormGroup({
            nameClient: new FormControl('', [
            Validators.maxLength(50),
            ]),
            nitClient: new FormControl('', [ Validators.maxLength(10),]),
            // Obligatorio solo cuando la venta es al crédito o lleva descuento (ver syncCustomerRequirement)
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





}