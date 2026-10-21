import { Component, OnInit, ViewChild } from '@angular/core';
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
import { ElementQuantityPickerComponent, QuantityPickerItem, QuantityPickerSelection } from '@app/components/element-quantity-picker/element-quantity-picker.component';
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
    productForSaleOrder?: ProductForSaleStoreOrder;
    selectedEstablishment?: Establishment;
    selectedEstablishmentSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    establishmentOptions?: Establishment[];
    constantes?: Constant[];
    productsForSale?: ProductForSale[];
    filteredProductsForSale?: ProductForSale[];
    unselectedProductsForSale?: ProductForSale[];
    productForSaleOrderElements?: ProductForSaleStoreOrderElement[];
    inventoryElementsSource?: InventoryElement[];
    inventoryElements?: InventoryElement[];

    /**
     * Tabla de productos con medida y cantidad en línea. `pickerItems` son todos los productos de
     * la tienda con su existencia de bodega; `pickerInitial` son las filas del pedido que se edita,
     * ya llenas. Lo que el usuario escribe vuelve en `onSelectionChange` y arma los elementos del
     * pedido.
     */
    pickerItems: QuantityPickerItem[] = [];
    pickerInitial: QuantityPickerSelection[] = [];
    @ViewChild('picker') picker?: ElementQuantityPickerComponent;
    total = 0;
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
    measureOptions?: Measure[];
    viewOption = '';
    storeOption = '';
    storeName = '';
    areTablesVisible = false;
    isPropertiesVisible = false;

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

        this.productsForSale = [];
        this.filteredProductsForSale = this.productsForSale;
        this.unselectedProductsForSale = [];
        this.productForSaleOrderElements = [];

        let requestArray = [];
        this.inventoryElements = [];

        requestArray.push(this.dataService.getAllEstablishmentsByFilter({"status_id": 28})); // providerRequest
        requestArray.push(this.dataService.getAnyComponent({}, 'getMeasure')); // measureRequest
        requestArray.push(this.dataService.getInventoryByType({}, 'retrieveFinishedProductInventoryV3'));
        requestArray.push(this.dataService.getAllProductForSaleByFilterV4({"status_id": 50})); //rawMaterialByProviderRequest

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
                this.buildPickerItems();
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
        // Mientras la tabla no emita, los elementos son los del pedido: si el estado no permite
        // editar productos la tabla no se muestra y el pedido se guarda con ellos tal cual.
        this.productForSaleOrderElements = this.productForSaleOrder?.productForSaleStoreOrderElements;
        this.pickerInitial = (this.productForSaleOrder?.productForSaleStoreOrderElements || [])
            .filter(element => element.productForSale?.id && element.measure?.id)
            .map(element => ({
                id: element.productForSale!.id,
                measure: { id: String(element.measure!.id), identifier: element.measure!.identifier },
                quantity: Number(element.quantity) || 0
            }));
    }

    /**
     * Un producto del inventario de bodega como fila de la tabla. La existencia viaja en unidad
     * base, para que el tope valga en la medida que se elija (existencia en unidades, pedido en
     * docenas). En un pedido Listo ya incluye lo que el pedido tiene reservado
     * (availableQuantity).
     */
    private buildPickerItems(){
        this.pickerItems = (this.inventoryElements || []).map(invElement => {
            const stock = Number(invElement.quantity) || 0;
            const stockBase = stock * (Number(invElement.measure?.unitBase?.quantity) || 0);
            return {
                id: invElement.productForSale?.id,
                title: invElement.finishedProduct?.name,
                subtitle: invElement.finishedProduct?.description,
                // Las medidas cuya unidad base coincide con la del producto, como en el modal
                measures: (this.measureOptions || [])
                    .filter(measure => invElement.finishedProduct?.measure?.identifier?.includes(measure.unitBase?.name!))
                    .map(measure => ({
                        id: measure.id,
                        identifier: measure.identifier,
                        unitBaseQuantity: Number(measure.unitBase?.quantity)
                    })),
                maxBase: stockBase,
                stockText: (Math.round(stock * 100) / 100) + ' ' + (invElement.measure?.identifier ?? '')
            } as QuantityPickerItem;
        });
    }

    /**
     * Lo escrito en la tabla pasa a ser los elementos del pedido. El precio es el de venta de la
     * tienda por la medida elegida —precio por unidad base por las unidades que trae la medida— y
     * el total, ese precio por la cantidad: la misma cuenta que hacía el modal.
     */
    onSelectionChange(selection: QuantityPickerSelection[]){
        // Un producto del pedido que ya no está en el inventario de bodega no tiene fila en la
        // tabla: se conserva tal cual, para que editar el pedido no lo borre en silencio.
        const kept = (this.productForSaleOrder?.productForSaleStoreOrderElements || [])
            .filter(element => !this.pickerItems.some(item => item.id === element.productForSale?.id));

        this.productForSaleOrderElements = [...kept, ...selection.map(item => {
            const productForSale = this.inventoryElements?.find(ie => ie.productForSale?.id === item.id)?.productForSale;
            const measure = this.selectMeasure(String(item.measure?.id));
            const price = Number(productForSale?.price) * Number(measure?.unitBase?.quantity);
            return {
                productForSale,
                price: String(price),
                measure,
                quantity: String(item.quantity),
                totalPrice: String(item.quantity * price),
                date: new Date().toISOString()
            } as ProductForSaleStoreOrderElement;
        })];
    }

    /** La tabla tiene alguna fila a medias (cantidad mal escrita o sin medida). */
    get pickerInvalid(): boolean {
        return !!this.picker?.hasInvalid;
    }

    onResetForm() {
        this.orderForm.reset();
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
                // Explícitos: ya no son el mismo arreglo que trae el pedido cargado, que era como
                // las ediciones llegaban antes al guardar
                productForSaleStoreOrderElements: this.productForSaleOrderElements,
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





    selectMeasure(measureId?: string){
        return this.measureOptions?.find(measure => String(measure.id) === measureId);
    }

    findEstablishmentById(establishmentId?: string){
        return this.establishmentOptions?.find(establishment => String(establishment.id) === establishmentId);
    }


    get f() {
        return this.orderForm.controls;
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





}