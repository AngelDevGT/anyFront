import { Component, OnInit} from '@angular/core';
import { concatMap, first } from 'rxjs/operators';

import { AlertService, DataService, PdfService, statusValues, storeOrderStatus } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import pdfMake from "pdfmake/build/pdfmake";  
import pdfFonts from "pdfmake/build/vfs_fonts";  
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PaymentStatus, Status } from '@app/models';
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { ProductForSaleStoreOrderElement } from '@app/models/product-for-sale/product-for-sale-store-order-element.model';
import { ManageProductForSaleStoreOrderElement } from '@app/models/product-for-sale/manage-product-for-sale-store-order.model copy';
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
    entries = [5, 10, 20, 50];
    pageSize = 5;
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

    constructor(private dataService: DataService, private alertService: AlertService,
        private route: ActivatedRoute, private pdfService: PdfService, private router: Router) {
    }

    ngOnInit(): void {

        this.id = this.route.snapshot.params['id'];

        this.route.queryParams.subscribe(params => {
            this.viewOption = params['opt'];
            this.storeId = params['store'];
        });

        if (this.viewOption && this.viewOption === "factory"){
            this.isFactory = true;
        }

        this.loading = true;

        if (this.id){
            this.dataService.getProductForSaleOrderById(this.id)
                .pipe(first())
                .subscribe((pfsOrder: any) =>{
                    let productOrder = pfsOrder.getProductForSaleStoreOrderResponse?.saleStoreOrder;
                    if (productOrder){
                        this.productForSaleOrder = productOrder;
                        this.setElements(this.productForSaleOrder!);
                        this.loading = false;
                    }
                });
        }
    }

    setElementOptions(elemStatus?: Status){
        if (elemStatus){
            if(this.isFactory){
                // marcar como listo
                if (elemStatus.id == storeOrderStatus.pendiente.id){
                    this.readyOption = true;
                }

                if (elemStatus.id == storeOrderStatus.listo.id){
                    this.comingOption = true;
                }
            } else {
                // Receive order option
                if (elemStatus.id == storeOrderStatus.listo.id || elemStatus.id == storeOrderStatus.en_camino.id
                    // && elemPayment.id == paymentStatusValues.pagado.paymentStatus.id
                    ){
                        this.receiveOption = true;
                    }
                if (elemStatus.id == storeOrderStatus.listo.id || elemStatus.id == storeOrderStatus.en_camino.id
                    // && elemPayment.id == paymentStatusValues.pagado.paymentStatus.id
                    ){
                        this.returnOption = true;
                    }
            }
    
            if (elemStatus.id == storeOrderStatus.pendiente.id){
                        this.deleteOption = true;
                    }
            
            if (!(elemStatus.id == storeOrderStatus.cancelado.id || elemStatus.id == storeOrderStatus.recibido.id ||
                elemStatus.id == storeOrderStatus.eliminado.id)){
                    this.editOption = true;
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
        if(this.confirmDialogId == 1){
            let newOrder: ManageProductForSaleStoreOrderElement = {
                ProductForSaleStoreOrderID: this.productForSaleOrder?._id,
                DestinyInventoryID: "65bf467e008f7e88678d3927"
            }
            this.dataService.manageProductForSaleOrderStateReceived(newOrder)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Pedido recibido', { keepAfterRouteChange: true });
                    this.navigateWithParams();
                },
                error: error => {
                    this.alertService.error('Error al actualizar el pedido, contacte con Administracion');
            }});
        } else if (this.confirmDialogId == 2){
            let newOrder: ManageProductForSaleStoreOrderElement = {
                ProductForSaleStoreOrderID: this.productForSaleOrder?._id,
                DestinyInventoryID: "65bf467e008f7e88678d3927"
            }
            this.dataService.manageProductForSaleOrderStateReady(newOrder)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Pedido marcado como listo', { keepAfterRouteChange: true });
                    this.navigateWithParams();
                },
                error: error => {
                    this.alertService.error(`Error al actualizar el pedido "${error.error.manageProductForSaleStoreOrderResponse.AcknowledgementDescription}", contacte con Administracion`);
            }});
        } else if (this.confirmDialogId == 3){
            let newOrder: ProductForSaleStoreOrder = {
                ...this.productForSaleOrder,
                storeStatus: storeOrderStatus.en_camino,
                factoryStatus: storeOrderStatus.en_camino
            }
            this.dataService.updateProductForSaleOrder(newOrder)
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
            let newOrder: ManageProductForSaleStoreOrderElement = {
                ProductForSaleStoreOrderID: this.productForSaleOrder?._id,
                DestinyInventoryID: "65bf467e008f7e88678d3927"
            }
            this.dataService.manageProductForSaleOrderStateReturned(newOrder)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Pedido devuelto', { keepAfterRouteChange: true });
                    this.navigateWithParams();
                },
                error: error => {
                    this.alertService.error('Error al actualizar el pedido, contacte con Administracion');
            }});
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
                    opt: this.viewOption
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
                        store: this.storeId
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
        this.dataService.deleteProductForSaleOrder(this.productForSaleOrder)
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
        this.setElementOptions(pfsOrder.factoryStatus);
        this.elements.push({icon : "receipt_long", name : "Notas", value : pfsOrder.comment});
        this.elements.push({icon : "person", name : "Establecimiento", value : pfsOrder.productForSaleStoreOrderElements![0].productForSale?.establishment?.name});
        if(this.isFactory){
            this.elements.push({icon : "info", name : "Estado del pedido", value : pfsOrder.factoryStatus?.identifier});
        } else {
            this.elements.push({icon : "info", name : "Estado del pedido", value : pfsOrder.storeStatus?.identifier});
        }
        // this.elements.push({icon : "shopping_cart", name : "Monto total", value : this.dataService.getFormatedPrice(Number(rmOrder.finalAmount))});
        // this.elements.push({icon : "production_quantity_limits", name : "Monto pendiente", value : this.dataService.getFormatedPrice(Number(rmOrder.pendingAmount))});
        this.elements.push({icon : "calendar_today", name : "Creado", value : this.dataService.getLocalDateTimeFromUTCTime(pfsOrder.creationDate!)});
        this.elements.push({icon : "calendar_today", name : "Actualizado", value : this.dataService.getLocalDateTimeFromUTCTime(pfsOrder.updateDate!.replaceAll("\"",""))});
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