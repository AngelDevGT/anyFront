import { ChangeDetectionStrategy, Component, Inject, inject, OnInit} from '@angular/core';
import { concatMap, first } from 'rxjs/operators';

import { AccountService, AlertService, CAPABILITIES, DataService, PdfService, pfsFactoryOrderStatusValues, pfsStoreOrderStatusValues, storeOrderStatus } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import pdfMake from "pdfmake/build/pdfmake";  
import pdfFonts from "pdfmake/build/vfs_fonts";  
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PaymentStatus, Status } from '@app/models';
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { ProductForSaleStoreOrderElement } from '@app/models/product-for-sale/product-for-sale-store-order-element.model';
import { ManageProductForSaleStoreOrderElement } from '@app/models/product-for-sale/manage-product-for-sale-store-order.model copy';
import { MatButtonModule } from '@angular/material/button';
pdfMake.vfs = pdfFonts.pdfMake.vfs;

@Component({ 
    selector: 'page-pfs-order-provider',
    templateUrl: 'view-pfs-order.component.html',
    styleUrls: ['view-pfs-order.component.scss']
})
export class ViewProductForSaleOrderComponent implements OnInit{

    id?: string;
    viewOption = '';
    storeId?: string;
    productForSaleOrder?: ProductForSaleStoreOrder;
    submitting = false;
    loading = false;
    elements: any = [];
    entries = this.dataService.tableEntries;
    pageSize = this.dataService.defaultPageSize;
    tableElementsValues?: any;
    receiveOption = false;
    readyOption = false;
    comingOption = false;
    returnOption = false;
    editOption = false;
    deleteOption = false;
    isFactory = false;
    confirmDialogTitle = '...';
    confirmDialogText = '...';
    confirmDialogId = 0;
    storeName = '';
    errorMessage = '';
    confirmReceiveOption = false;
    /** Modo consulta: el detalle solo se ve y se exporta a PDF, sin acciones sobre el pedido. */
    readOnly = false;


    constructor(private dataService: DataService, private alertService: AlertService, private accountService: AccountService,
        private route: ActivatedRoute, private pdfService: PdfService, private router: Router, private dialog: MatDialog) {
    }

    ngOnInit(): void {

        this.id = this.route.snapshot.params['id'];
        this.readOnly = !!this.route.snapshot.data['readOnly'];

        this.route.queryParams.subscribe(params => {
            this.viewOption = params['opt'];
            this.storeId = params['store'];
            this.storeName = params['name'];
        });

        if (this.viewOption && this.viewOption === "factory"){
            this.isFactory = true;
        }

        this.loading = true;

        if (this.id){
            this.dataService.getProductForSaleOrderById(this.id)
                .pipe(first())
                .subscribe((pfsOrder: any) =>{
                    let productOrder = this.dataService.findJsonValue(pfsOrder, 'json_result') || {};
                    if (productOrder){
                        this.productForSaleOrder = productOrder;
                        this.setElements(this.productForSaleOrder!);
                        this.loading = false;
                    }
                });
        }
    }

    openDialog(error_message: String): void {
        this.dialog.open(DialogComponent, {
          data: {
            error_message: error_message
          }
        });
    }

    setElementOptions(pfsOrder: ProductForSaleStoreOrder){
        // En modo consulta ninguna acción queda habilitada; solo se deja el botón de PDF
        if (this.readOnly){
            return;
        }
        const elemStatus = pfsOrder.factoryStatus;
        if (elemStatus){
            if(this.isFactory){
                // marcar como listo
                if (elemStatus.id == pfsFactoryOrderStatusValues.pendiente.status.id){
                    this.readyOption = true;
                }

                if (elemStatus.id == pfsFactoryOrderStatusValues.listo.status.id){
                    this.comingOption = true;
                }
            } else {
                // Receive order option
                if (elemStatus.id == pfsFactoryOrderStatusValues.listo.status.id ||  pfsFactoryOrderStatusValues.en_camino.status.id == elemStatus.id
                    // && elemPayment.id == paymentStatusValues.pagado.paymentStatus.id
                    ){
                        this.receiveOption = true;
                    }
                if (elemStatus.id == pfsFactoryOrderStatusValues.listo.status.id || elemStatus.id == pfsFactoryOrderStatusValues.en_camino.status.id
                    // && elemPayment.id == paymentStatusValues.pagado.paymentStatus.id
                    ){
                        this.returnOption = true;
                    }
                if (pfsOrder.establishment?.receivePendingOrdersEnabled && elemStatus.id == pfsFactoryOrderStatusValues.pendiente.status.id){
                        this.confirmReceiveOption = true;
                    }
            }

            if (elemStatus.id == pfsFactoryOrderStatusValues.pendiente.status.id){
                        this.deleteOption = true;
                    }

            if (!(elemStatus.id == pfsFactoryOrderStatusValues.cancelado.status.id || elemStatus.id == pfsFactoryOrderStatusValues.recibido.status.id || elemStatus.id == pfsFactoryOrderStatusValues.eliminado.status.id)){

                    if(elemStatus.id == pfsFactoryOrderStatusValues.pendiente.status.id || this.accountService.can(CAPABILITIES.ordersEditAfterPending)){
                        this.editOption = true;
                    }

                }
        }
    }

    createPayFormGroup() {
        return new FormGroup({
            pendingAmount: new FormControl('', [
                Validators.required, 
                Validators.pattern(/^\d+(\.\d{1,2})?$/)
            ])
        });
    }

    onConfirmDialog(){
        this.submitting = true;
        if (this.productForSaleOrder?.id){
            if(this.confirmDialogId == 1){
                this.dataService.manageProductForSaleOrderStateReceived(this.productForSaleOrder?.id)
                .pipe(first())
                .subscribe({
                    next: () => {
                        this.alertService.success('Pedido recibido', { keepAfterRouteChange: true });
                        this.navigateWithParams();
                    },
                    error: error => {
                        this.errorMessage = this.dataService.getErrorMessageResponse(error, 'Error al consumir materia prima');
                        this.openDialog(this.errorMessage);
                }});
            } else if (this.confirmDialogId == 2){
                this.dataService.manageProductForSaleOrderStateReady(this.productForSaleOrder.id)
                .pipe(first())
                .subscribe({
                    next: () => {
                        this.alertService.success('Pedido marcado como listo', { keepAfterRouteChange: true });
                        this.navigateWithParams();
                    },
                    error: error => {
                        this.errorMessage = this.dataService.getErrorMessageResponse(error, 'Error al marcar el pedido como Listo');
                        this.openDialog(this.errorMessage);
                }});
            } else if (this.confirmDialogId == 3){
                this.dataService.updateProductForSaleOrderEnCamino(this.productForSaleOrder.id)
                .pipe(first())
                .subscribe({
                    next: () => {
                        this.alertService.success('Pedido actualizado', { keepAfterRouteChange: true });
                        this.navigateWithParams();
                    },
                    error: error => {
                        this.alertService.error('Error al actualizar el pedido, contacte con Administracion');
                }});
            } else if (this.confirmDialogId == 4){
                this.dataService.manageProductForSaleOrderStateReturned(this.productForSaleOrder?.id)
                .pipe(first())
                .subscribe({
                    next: () => {
                        this.alertService.success('Pedido devuelto', { keepAfterRouteChange: true });
                        this.navigateWithParams();
                    },
                    error: error => {
                        this.errorMessage = this.dataService.getErrorMessageResponse(error, 'Error al devolver el pedido');
                        this.openDialog(this.errorMessage);
                }});
            } else if (this.confirmDialogId == 5){
                this.dataService.confirmAndReceivePFSOrder(this.productForSaleOrder?.id)
                .pipe(first())
                .subscribe({
                    next: () => {
                        this.alertService.success('Pedido confirmado y recibido', { keepAfterRouteChange: true });
                        this.navigateWithParams();
                    },
                    error: error => {
                        this.errorMessage = this.dataService.getErrorMessageResponse(error, 'Error al confirmar y recibir el pedido');
                        this.openDialog(this.errorMessage);
                }});
            }
        }
    }

    actionOrder(action: number){
        switch (action) {
            case 1:
                this.confirmDialogTitle = 'Recibir Pedido';
                this.confirmDialogText = '¿Deseas marcar el pedido como RECIBIDO?';
                break;
            case 2:
                this.confirmDialogTitle = 'Pedido listo';
                this.confirmDialogText = '¿Deseas marcar el pedido como LISTO?';
                break;
            case 3:
                this.confirmDialogTitle = 'Pedido en camino';
                this.confirmDialogText = '¿Deseas marcar el pedido como EN CAMINO?';
                break;
            case 4:
                this.confirmDialogTitle = 'Devolver pedido';
                this.confirmDialogText = '¿Deseas DEVOLVER el pedido?';
                break;
            case 5:
                this.confirmDialogTitle = 'Confirmar y recibir pedido';
                this.confirmDialogText = '¿Deseas CONFIRMAR y marcar el pedido como RECIBIDO?';
                break;
            default:
                break;
        }
        this.confirmDialogId = action;
    }

    receiveOrder(){
        this.confirmDialogTitle = 'Recibir Pedido';
        this.confirmDialogText = '¿Deseas marcar el pedido como recibido?';
        this.confirmDialogId = 1;
        // this.router.navigate(['/rawMaterialByProvider/order/edit/' + _id], {
        //     queryParams: {
        //         opt: 'receive'
        //     }
        // })
    }

    editOrder(_id?: string){
        if(this.viewOption){
            this.router.navigate(['/productsForSale/order/edit/' + _id], {
                queryParams: {
                    opt: this.viewOption,
                    store: this.storeId,
                    name: this.storeName
                }
            });
        } else {
            this.router.navigate(['/productsForSale/order/edit/' + _id]);
        }
    }

    navigateWithParams(){
        if(this.viewOption){
            if(this.storeId){
                this.router.navigate(['/productsForSale/order'], {
                    queryParams: {
                        opt: this.viewOption,
                        store: this.storeId,
                        name: this.storeName
                    }
                });
            } else {
                this.router.navigate(['/productsForSale/order'], {
                    queryParams: {
                        opt: this.viewOption
                    }
                });
            }
        } else {
            this.router.navigateByUrl('/productsForSale/order');
        }
    }

    validateOrder(){
        this.confirmDialogTitle = 'Validar Pedido';
        this.confirmDialogText = '¿Deseas marcar el pedido como verificado?';
        this.confirmDialogId = 2;
    }

    deleteOrder() {
        this.submitting = true;
        this.dataService.deleteProductForSaleOrder(this.productForSaleOrder?.id)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Pedido eliminado', { keepAfterRouteChange: true });
                this.navigateWithParams();
                },
                error: error => {
                    this.alertService.error('Error al eliminar el pedido, contacte con Administracion');
            }});
    }

    setElements(pfsOrder: ProductForSaleStoreOrder){
        this.setElementOptions(pfsOrder);
        this.elements.push({icon : "receipt_long", name : "Notas", value : pfsOrder.comment});
        this.elements.push({icon : "person", name : "Establecimiento", value : pfsOrder.establishment?.name});
        if(this.isFactory){
            this.elements.push({icon : "info", name : "Estado del pedido", value : pfsOrder.factoryStatus?.identifier});
        } else {
            this.elements.push({icon : "info", name : "Estado del pedido", value : pfsOrder.storeStatus?.identifier});
        }
        // this.elements.push({icon : "shopping_cart", name : "Monto total", value : this.dataService.getFormatedPrice(Number(rmOrder.finalAmount))});
        // this.elements.push({icon : "production_quantity_limits", name : "Monto pendiente", value : this.dataService.getFormatedPrice(Number(rmOrder.pendingAmount))});
        this.elements.push({icon : "calendar_today", name : "Creado", value : this.dataService.getLocalDateTimeFromUTCTime(pfsOrder.creationDate!)});
        this.elements.push({icon : "calendar_today", name : "Actualizado", value : this.dataService.getLocalDateTimeFromUTCTime(pfsOrder.updatedDate!.replaceAll("\"",""))});
        this.elements.push({icon : "badge", name : "Creado por", value : pfsOrder.creatorUser?.name});
        this.setTableElements(pfsOrder.productForSaleStoreOrderElements);
    }

    setTableElements(elements?: ProductForSaleStoreOrderElement[]){
        this.tableElementsValues = [];
        elements?.forEach((element: ProductForSaleStoreOrderElement) => {
            let curr_row = [
                    { type: "text", value: element.productForSale?.finishedProduct?.name, header_name: "Nombre" },
                    // { type: "text", value: element.rawMaterialOrderElements.length, header_name: "Cantidad" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.price)), header_name: "Precio" },
                    { type: "text", value: element.quantity, header_name: "Cantidad" },
                    { type: "text", value: element.measure?.identifier, header_name: "Medida" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.totalPrice)), header_name: "Total" },
                    // { type: "text", value: element.measure.unitBase.name, header_name: "Medida Base" },
                    // { type: "text", value: element.measure.unitBase.quantity, header_name: "Cantidad Base" },
            ];
            if(this.isFactory){
                curr_row = [
                        { type: "text", value: element.productForSale?.finishedProduct?.name, header_name: "Nombre" },
                        { type: "text", value: element.quantity, header_name: "Cantidad" },
                        { type: "text", value: element.measure?.identifier, header_name: "Medida" }
                ];
            }
            this.tableElementsValues.push(curr_row);
        });
    }


    generatePDF() {  
        this.pdfService.generateProductForSaleOrderPDF(this.productForSaleOrder!, this.viewOption);
    }  

}

@Component({
    selector: 'dialog-component',
    template: `
        <h2 mat-dialog-title>ERROR</h2>
        <mat-dialog-content>{{data.error_message}}</mat-dialog-content>
        <mat-dialog-actions>
        <button mat-button mat-dialog-close>Cerrar</button>
        </mat-dialog-actions>
    `,
    standalone: true,
    imports: [MatButtonModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  })
  export class DialogComponent {
    constructor(
        public dialogRef: MatDialogRef<DialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any, private router: Router) {}

    ngOnInit() {
        // Subscribirse al evento de cierre del diálogo
        this.dialogRef.afterClosed().subscribe(() => {
          this.reloadPage(); // Recargar la página cuando se cierre el diálogo
        });
      }
    
      // Método para recargar la página
      reloadPage(): void {
        window.location.reload(); // Recarga la página completa
        // O también puedes usar: location.reload(); -> Alternativa
    }

  }
