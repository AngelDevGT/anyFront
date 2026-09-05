import { Component, OnInit } from '@angular/core';
import {BehaviorSubject, Observable, forkJoin, of} from 'rxjs';
import {concatMap, first, map, startWith} from 'rxjs/operators';
import {
    DataUrl,
    DOC_ORIENTATION,
    NgxImageCompressService,
    UploadResponse,
} from 'ngx-image-compress';

import { AccountService, statusValues, AlertService, CAPABILITIES, DataService, paymentStatusValues, pfsFactoryOrderStatusValues } from '@app/services';
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

/** Lo que un producto aporta al pedido, en unidades base, con qué mostrarlo. */
interface OrderedProduct {
    baseQuantity: number;
    name: string;
    unitName: string;
}

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
    pfsSearchTerm?: string;

    get filteredInventoryElements(): InventoryElement[] | undefined {
        if (!this.pfsSearchTerm) return this.inventoryElements;
        const term = this.pfsSearchTerm.toLowerCase();
        return this.inventoryElements?.filter(el =>
            el.finishedProduct?.name?.toLowerCase().includes(term)
        );
    }
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
    isPropertiesVisible = false;
    warningMessage = '';
    isEditMode = false;
    editingIndex?: number;

    /**
     * ¿El pedido que se edita ya está en Listo? Ahí el producto YA salió de bodega y
     * está en tránsito hacia la tienda, así que guardar ajusta inventario: descuenta lo
     * que se agregó y devuelve a bodega lo que se quitó.
     * Ver src/database/migrations/2026-09-01-editar-pedido-listo.sql
     */
    isReadyOrder = false;
    /** Resumen del ajuste de inventario, para el diálogo de confirmación en Listo. */
    inventoryChanges: string[] = [];
    /**
     * Lo que ESTE pedido ya descontó de bodega por producto, tal como estaba al abrir la
     * pantalla. Vacío fuera de Listo: en los demás estados el pedido no tocó inventario.
     */
    private committedByPfsId = new Map<string, OrderedProduct>();

    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute,
        private alertService: AlertService, private router: Router, private accountService: AccountService) {

        this.selectedEstablishmentSubject.subscribe(value => {
            this.setEstablishment(value);
        });
    }


    ngOnInit(): void {

        this.title = 'Crear Pedido de Producto para Venta (Tienda)';
        this.id = this.route.snapshot.params['id'];

        // El guard de rutas solo valida la ruta, no la capacidad: sin orders.edit no se entra
        // a editar un pedido existente ni escribiendo la URL. Crear no pide la capacidad, asi
        // que solo se corta cuando viene un id. `loading` arranca en true, de modo que la
        // pantalla no alcanza a dibujar el formulario antes de rebotar al detalle.
        if (this.id && !this.accountService.can(CAPABILITIES.ordersEdit)){
            this.router.navigate(['/productsForSale/order/view/' + this.id], {
                queryParams: this.route.snapshot.queryParams
            });
            return;
        }

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

        requestArray.push(this.dataService.getAllEstablishmentsByFilter({"status_id": 28})); // providerRequest
        requestArray.push(this.dataService.getAnyComponent({}, 'getMeasure')); // measureRequest
        requestArray.push(this.dataService.getInventoryByType({}, 'retrieveFinishedProductInventoryV3'));
        requestArray.push(this.dataService.getAllProductForSaleByFilter({"status_id": 50})); //rawMaterialByProviderRequest

        if (this.id){
            this.title = 'Actualizar Pedido de Producto para Venta'
            requestArray.push(this.dataService.getProductForSaleOrderById(this.id));
        } else {
            this.areTablesVisible = true;
            this.isPropertiesVisible = true;
        }

        let inventory: Inventory;

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.establishmentOptions = this.dataService.findJsonValue(result[0], 'json_result') || [];
                this.measureOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];
                this.filteredMeasureOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];
                inventory = this.dataService.findJsonValue(result[2], 'json_result') || {};
                this.productsForSale = this.dataService.findJsonValue(result[3], 'json_result') || [];
                this.productsForSale = this.productsForSale?.filter(pfs => pfs.establishment?.id === String(this.storeOption));
                this.filteredProductsForSale = this.dataService.findJsonValue(result[3], 'json_result') || [];
                this.filteredProductsForSale = this.filteredProductsForSale?.filter(pfs => pfs.establishment?.id === String(this.storeOption));
                if (this.id){
                    this.productForSaleOrder= this.dataService.findJsonValue(result[4], 'json_result') || {};
                }
                // console.log(respuestaPeticion1, respuestaPeticion2, respuestaPeticion3);
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                // El rebote de arriba solo mira orders.edit, que es lo unico que se puede
                // saber sin el pedido. El escalon que corresponde a SU estado se evalua
                // aca, ya cargado, y vuelve a cortar antes de dibujar el formulario.
                if (this.id && !this.canEditOrder()){
                    this.alertService.error('No tienes permiso para editar este pedido en su estado actual.',
                        { keepAfterRouteChange: true });
                    this.router.navigate(['/productsForSale/order/view/' + this.id], {
                        queryParams: this.route.snapshot.queryParams
                    });
                    return;
                }

                this.selectedEstablishment = this.findEstablishmentById(this.storeOption);
                this.filterByEstablishment(this.storeOption);

                this.inventoryElementsSource = inventory.inventoryElements;
                console.log("inventoryElementsSource", this.inventoryElementsSource);
                // Antes de armar la lista de disponibles: en Listo esa lista se corrige con
                // lo que el pedido tiene reservado.
                this.loadCommittedQuantities();
                this.loadProductsForSaleFromInventory();
                if (this.productForSaleOrder){
                    this.loadRawMaterialOrder();
                }
                this.loading = false;
            }
        });

    }

    /**
     * ¿Este usuario puede editar el pedido EN EL ESTADO EN QUE ESTÁ? Es la misma escalera
     * que gobierna el botón "Editar" del detalle: orders.edit para cualquier estado,
     * orders.editAfterPending para seguir editando pasado Pendiente y orders.editReady
     * para Listo, donde editar además mueve inventario.
     */
    private canEditOrder(): boolean {
        const f = pfsFactoryOrderStatusValues;
        const statusId = this.productForSaleOrder?.factoryStatus?.id;
        if (statusId === undefined) return false;

        // Un pedido cerrado o descartado no se edita, con permiso o sin él.
        if (statusId === f.cancelado.status.id || statusId === f.recibido.status.id
            || statusId === f.eliminado.status.id) return false;

        if (!this.accountService.can(CAPABILITIES.ordersEdit)) return false;
        if (statusId === f.pendiente.status.id) return true;
        if (!this.accountService.can(CAPABILITIES.ordersEditAfterPending)) return false;

        return statusId !== f.listo.status.id || this.accountService.can(CAPABILITIES.ordersEditReady);
    }

    /**
     * ¿Se pueden tocar los productos, o solo el nombre y las notas? Es la misma lista de
     * estados que acepta update_product_for_sale_order_with_elements_v2: Pendiente(11),
     * En curso(12), Preparado(64) y Listo(13). En los demás —En camino, Devuelto— la base
     * guarda solo la cabecera, así que la tabla se esconde en vez de mentir.
     */
    get canEditProducts(): boolean {
        if (!this.id) return true;
        const f = pfsFactoryOrderStatusValues;
        const statusId = this.productForSaleOrder?.factoryStatus?.id;
        return statusId === f.pendiente.status.id
            || statusId === f.en_curso.status.id
            || statusId === f.preparado.status.id
            || statusId === f.listo.status.id;
    }

    /**
     * Lo que este pedido ya descontó de bodega, por producto y en unidades base, como
     * estaba al abrir la pantalla. Solo aplica en Listo; en el resto de los estados el
     * pedido todavía no movió inventario y no hay nada que acreditarle.
     */
    private loadCommittedQuantities(){
        this.isReadyOrder = !!this.id
            && this.productForSaleOrder?.factoryStatus?.id === pfsFactoryOrderStatusValues.listo.status.id;

        this.committedByPfsId = this.isReadyOrder
            ? this.summarizeElements(this.productForSaleOrder?.productForSaleStoreOrderElements)
            : new Map<string, OrderedProduct>();
    }

    /**
     * Suma los elementos por producto y los pasa a unidades base, que es la única forma
     * de comparar dos listas que pueden usar medidas distintas para el mismo producto.
     *
     * La unidad base sale del catálogo de medidas y no del elemento: el JSON del pedido
     * trae la medida con id e identificador, pero sin su equivalencia.
     */
    private summarizeElements(elements?: ProductForSaleStoreOrderElement[]): Map<string, OrderedProduct> {
        const summary = new Map<string, OrderedProduct>();
        elements?.forEach(element => {
            const pfsId = element.productForSale?.id;
            if (!pfsId) return;

            const unitBaseQuantity = Number(this.selectMeasure(String(element.measure?.id))?.unitBase?.quantity) || 0;
            const previous = summary.get(pfsId);
            summary.set(pfsId, {
                baseQuantity: (previous?.baseQuantity || 0) + Number(element.quantity) * unitBaseQuantity,
                name: element.productForSale?.finishedProduct?.name || 'Producto',
                unitName: element.productForSale?.finishedProduct?.measure?.identifier || ''
            });
        });
        return summary;
    }

    loadProductsForSaleFromInventory(){
        this.inventoryElements = [];
        this.productsForSale?.map((pfsItem) => {
            const matchingFinishedProduct = this.inventoryElementsSource?.find((invElem) => pfsItem.finishedProduct?.id === invElem?.finishedProduct?.id);
            if (matchingFinishedProduct){
                this.inventoryElements?.push({
                    ...matchingFinishedProduct,
                    quantity: this.availableQuantity(matchingFinishedProduct, pfsItem),
                    productForSale: pfsItem
                });
            }
        });
        // this.filteredProductsForSale = this.productsForSale?.filter((pfsItem) => this.inventoryElements?.some((ieItem) => pfsItem.finishedProduct?.id === ieItem.finishedProduct?.id));
    }

    /**
     * Cantidad disponible para ESTE pedido, en la medida del elemento de inventario.
     *
     * En Listo es lo que hay en bodega MÁS lo que el pedido ya tiene reservado: bajar la
     * cantidad de un producto lo devuelve a bodega, así que también está a su
     * disposición. Es un número sintético a propósito —no es el saldo de bodega—, y es lo
     * que hace que el aviso de "supera la cantidad disponible" coincida con lo que la
     * base termina aceptando: ahí también se compara contra la diferencia, no contra el
     * total del pedido.
     */
    private availableQuantity(inventoryElement: InventoryElement, productForSale: ProductForSale){
        const committedBase = this.committedByPfsId.get(productForSale.id!)?.baseQuantity || 0;
        if (!committedBase) return inventoryElement.quantity;

        const unitBaseQuantity = Number(inventoryElement.measure?.unitBase?.quantity) || 1;
        const available = Number(inventoryElement.quantity) + committedBase / unitBaseQuantity;
        return String(Math.round(available * 100000) / 100000); // el inventario guarda 5 decimales
    }

    loadRawMaterialOrder(){
        // this.setProvider(this.rawMaterialOrder?.provider?._id);
        this.orderForm.patchValue(this.productForSaleOrder!);
        this.areTablesVisible = this.canEditProducts;
        if(this.accountService.can(CAPABILITIES.ordersViewProperties)){
            this.isPropertiesVisible = true;
        }
        // this.providertSelect?.patchValue(String(this.rawMaterialOrder?.provider?._id));
        this.selectedEstablishmentSubject.next(this.productForSaleOrder?.id);
        this.productForSaleOrderElements = this.productForSaleOrder?.productForSaleStoreOrderElements;
        this.productForSaleOrder?.productForSaleStoreOrderElements?.forEach(pfsOrder => {
            this.findAndMoveProductForSaleById(true, pfsOrder.productForSale?.id);
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
        this.isEditMode = false;
        this.editingIndex = undefined;
    }

    /**
     * Tienda del pedido. El selector de establecimiento del formulario está
     * comentado, así que la única fuente es el query param `store`:
     * `selectedEstablishment` es ese id ya resuelto contra el catálogo de
     * tiendas activas (status 28). Si el catálogo no lo trae —tienda inactiva—
     * alcanza con el id suelto, que es lo único que lee
     * create_product_for_sale_order_with_elements.
     */
    private get orderEstablishment(): Establishment | undefined {
        if (this.selectedEstablishment) return this.selectedEstablishment;
        return this.storeOption ? { id: this.storeOption } : undefined;
    }

    onSaveForm() {
        this.alertService.clear();

        // Sin tienda el pedido se inserta con establishment_id NULL y la base lo
        // rechaza con un error que no le dice nada al usuario. Se corta acá.
        if (!this.id && !this.orderEstablishment?.id) {
            this.submitting = false;
            this.alertService.error('El pedido no tiene tienda asignada. Vuelve a abrir esta pantalla desde el listado de pedidos de la tienda.');
            return;
        }

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
                        let errorMessage = this.dataService.getErrorMessageResponse(error, 'Error al consumir materia prima');
                        this.alertService.error(errorMessage);
                        this.submitting = false;
                    }
                });
    }

    private saveOrder(){
        if(this.id){
            let updatedProductForSaleOrder: ProductForSaleStoreOrder = {
                ...this.productForSaleOrder,
                ...this.orderForm.value,
                finalAmount: this.total.toFixed(2)
            }
            updatedProductForSaleOrder.comment = updatedProductForSaleOrder.comment && updatedProductForSaleOrder.comment.trim() ? updatedProductForSaleOrder.comment.trim() : '--';
            return this.dataService.updateProductForSaleOrder(updatedProductForSaleOrder);
        } else {
            let newProductForSaleOrder: ProductForSaleStoreOrder = {
                ...this.orderForm.value,
                establishment: this.orderEstablishment,
                productForSaleStoreOrderElements: this.productForSaleOrderElements,
                finalAmount: this.total.toFixed(2)
            }
            newProductForSaleOrder.comment = newProductForSaleOrder.comment ? newProductForSaleOrder.comment.trim() : '--';
            return this.dataService.addProductForSaleOrder(newProductForSaleOrder);
        }
    }

    onSaveMaterialForm(){
        if (this.isEditMode && this.editingIndex !== undefined) {
            let updatedOrderElement: ProductForSaleStoreOrderElement = {
                productForSale: this.selectedIE?.productForSale,
                ...this.productForSaleForm.value,
                price: this.currentMeasurePrice,
                measure: this.selectedMeasure,
                quantity: String(this.modalQuantity),
                totalPrice: this.modalTotal,
                date: new Date().toISOString()
            };
            this.productForSaleOrderElements![this.editingIndex] = updatedOrderElement;
        } else {
            let newOrderElement: ProductForSaleStoreOrderElement = {
                productForSale: this.selectedIE?.productForSale,
                ...this.productForSaleForm.value,
                price: this.currentMeasurePrice,
                measure: this.selectedMeasure,
                quantity: String(this.modalQuantity),
                totalPrice: this.modalTotal,
                date: new Date().toISOString()
            };
            this.productForSaleOrderElements?.push(newOrderElement);
            this.findAndMoveProductForSaleById(true, this.selectedIE?.productForSale?.id);
        }
        this.onResetMaterialForm();
    }

    selectInventoryElementForEdit(orderElement: ProductForSaleStoreOrderElement, index: number){
        const invElement = this.unselectedInventoryElements?.find(
            el => el.productForSale?.id === orderElement.productForSale?.id
        );
        if (!invElement) return;

        this.isEditMode = true;
        this.editingIndex = index;
        this.selectedIE = invElement;
        this.elements = [];
        this.setInventoryElementElements(invElement);
        this.filteredMeasureOptions = this.measureOptions?.filter(
            item => invElement.finishedProduct?.measure?.identifier?.includes(item.unitBase?.name!)
        );
        this.measureSelect?.setValue(String(orderElement.measure?.id));
        this.changeMeasure(String(orderElement.measure?.id));
        this.productForSaleForm.get('quantity')?.setValue(orderElement.quantity);
        this.modalQuantity = Number(orderElement.quantity);
        this.calculateModalQuantity();
        this.calculateModalTotals();
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

    /**
     * Confirmación previa a guardar un pedido que ya está en Listo. No es un trámite:
     * guardar acá mueve inventario de verdad, así que el diálogo enumera producto por
     * producto lo que se va a descontar y lo que se va a devolver a bodega.
     */
    onSaveReadyOrderDialog(){
        this.inventoryChanges = this.buildInventoryChanges();
        this.confirmDialogTitle = 'Guardar pedido listo';

        if (this.inventoryChanges.length){
            this.confirmDialogText = 'Este pedido ya descontó producto de bodega. Al guardar se ajusta el inventario:';
            this.warningDialogText = 'El pedido quedará SIN VERIFICAR. Si no alcanza el inventario para lo que se agregó,'
                + ' no se guarda ningún cambio.';
        } else {
            this.confirmDialogText = 'No cambiaron los productos del pedido. ¿Deseas guardar los cambios?';
            this.warningDialogText = undefined;
        }

        this.confirmDialogId = 1;
    }

    /**
     * Diferencia entre los productos que tiene el pedido ahora y los que tenía al abrir
     * la pantalla, en unidades base. Es el mismo cálculo que hace el procedure para
     * decidir qué mover: acá solo sirve para contarlo antes de guardar.
     */
    private buildInventoryChanges(): string[] {
        const current = this.summarizeElements(this.productForSaleOrderElements);

        const pfsIds: string[] = [];
        this.committedByPfsId.forEach((_, pfsId) => pfsIds.push(pfsId));
        current.forEach((_, pfsId) => { if (!this.committedByPfsId.has(pfsId)) pfsIds.push(pfsId); });

        const changes: string[] = [];
        pfsIds.forEach(pfsId => {
            const before = this.committedByPfsId.get(pfsId);
            const after = current.get(pfsId);
            const delta = Math.round(((after?.baseQuantity || 0) - (before?.baseQuantity || 0)) * 100000) / 100000;
            if (!delta) return;

            const product = after || before!;
            const unit = product.unitName ? ' ' + product.unitName : '';
            changes.push(delta > 0
                ? `${product.name}: se descuentan ${delta}${unit} más de bodega`
                : `${product.name}: se devuelven ${-delta}${unit} a bodega`);
        });
        return changes;
    }

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
        this.findAndMoveProductForSaleById(false, orderElement.productForSale?.id);
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

    findEstablishmentById(establishmentId?: string){
        return this.establishmentOptions?.find(establishment => String(establishment.id) === establishmentId);
    }

    findAndMoveProductForSaleById(isSelect: boolean, inventoryElementId?: string){
        if (isSelect){
            let inventoryElementResult = this.inventoryElements?.find(invElement => invElement.productForSale?.id === inventoryElementId);
            if (inventoryElementResult) {
                this.inventoryElements = this.inventoryElements?.filter(invElement => invElement.productForSale?.id !== inventoryElementId);
                this.unselectedInventoryElements?.push(inventoryElementResult);
            }
        } else { // unselect
            let inventoryElementResult = this.unselectedInventoryElements?.find(invElement => invElement.productForSale?.id === inventoryElementId);
            if (inventoryElementResult){
                this.unselectedInventoryElements = this.unselectedInventoryElements?.filter(invElement => invElement.productForSale?.id !== inventoryElementId);
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
        this.selectedEstablishment = this.findEstablishmentById(establishment);
        this.filterByEstablishment(establishment);
    }

    filterByEstablishment(establishmentId: string){
        if(establishmentId){
            this.filteredProductsForSale = this.productsForSale?.filter((val) => {
                return establishmentId === val.establishment?.id;
            });
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
        this.findAndMoveProductForSaleById(false, orderElement.productForSale?.id);
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
        let selectedMeasureQuantity = Number(this.selectedIE?.quantity)/Number(this.selectedMeasure?.unitBase?.quantity);
        if(totalQuantity > unitBaseTotalQuantity){
            // this.warningMessage = `La cantidad ingresada (${totalQuantity} ${this.selectedIE?.measure?.identifier}(es)) supera la cantidad disponible en inventario (${unitBaseTotalQuantity} ${this.selectedIE?.measure?.identifier}(es))`;
            this.warningMessage = `La cantidad ingresada de ${this.modalQuantity} ${this.selectedMeasure?.identifier}(s) supera la cantidad disponible en inventario de ${selectedMeasureQuantity} ${this.selectedMeasure?.identifier}(s)`;
            this.modalQuantityInput?.setValue('0');
            this.modalQuantity = 0;
            totalQuantity = 0;
        } else {
            this.warningMessage = '';
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
            // Validators.required,
            // Validators.minLength(1),
            // Validators.maxLength(100),
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