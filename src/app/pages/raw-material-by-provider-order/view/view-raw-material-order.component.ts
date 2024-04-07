import { Component, OnInit} from '@angular/core';
import { concatMap, first } from 'rxjs/operators';

import { AlertService, DataService, PdfService, statusValues, paymentStatusValues } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import pdfMake from "pdfmake/build/pdfmake";  
import pdfFonts from "pdfmake/build/vfs_fonts";  
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PaymentStatus, Status } from '@app/models';
import { AddRawMaterialOrderPaymentHistory } from '@app/models/raw-material/add-raw-material-order-payment-history.model';
pdfMake.vfs = pdfFonts.pdfMake.vfs;

@Component({ 
    selector: 'page-raw-material-order-provider',
    templateUrl: 'view-raw-material-order.component.html',
    styleUrls: ['view-raw-material-order.component.scss']
})
export class ViewRawMaterialOrderComponent implements OnInit{

    id?: string;
    rawMaterialOrder?: RawMaterialOrder;
    submitting = false;
    loading = false;
    elements: any = [];
    entries = [5, 10, 20, 50];
    pageSize = 5;
    tableElementsValues?: any;
    orderPayments?: any;
    payAmount = 0;
    paymentOption = false;
    receiveOption = false;
    validateOption = false;
    editOption = false;
    deleteOption = false;
    payForm!: FormGroup;
    confirmDialogTitle = '...';
    confirmDialogText = '...';
    confirmDialogId = 0;

    constructor(private dataService: DataService, private alertService: AlertService,
        private route: ActivatedRoute, private pdfService: PdfService, private router: Router) {
    }

    ngOnInit(): void {

        this.payForm = this.createPayFormGroup();

        this.id = this.route.snapshot.params['id'];

        this.loading = true;

        if (this.id){
            this.dataService.getRawMaterialOrderById(this.id)
                .pipe(first())
                .subscribe((rmOrder: any) =>{
                    let rawMaterialOrder = rmOrder.GetRawMaterialOrderResponse?.rawMaterial;
                    console.log(rawMaterialOrder);
                    if (rawMaterialOrder){
                        this.rawMaterialOrder = rawMaterialOrder;
                        console.log(this.rawMaterialOrder);
                        this.setElements(this.rawMaterialOrder!);
                        this.loading = false;
                    }
                });
        }
    }

    setElementOptions(elemStatus?: Status, elemPayment?: PaymentStatus){
        // Payment option
        if (elemStatus && elemPayment){
            if ((elemStatus.id == statusValues.activo.status.id 
                || elemStatus.id == statusValues.recibido.status.id) && 
                (elemPayment.id == paymentStatusValues.pendiente.paymentStatus.id
                    || elemPayment.id == paymentStatusValues.abonado.paymentStatus.id)){
                        this.paymentOption = true;
                    }
    
            // Receive order option
            if (elemStatus.id == statusValues.activo.status.id 
                // && elemPayment.id == paymentStatusValues.pagado.paymentStatus.id
                ){
                    this.receiveOption = true;
                }
    
            // Validate order option
            if (elemStatus.id == statusValues.recibido.status.id && 
                elemPayment.id == paymentStatusValues.pagado.paymentStatus.id){
                    this.validateOption = true;
                }
    
            // Edit option and Delete option
            if (elemPayment.id != paymentStatusValues.pagado.paymentStatus.id && 
                (elemStatus.id == statusValues.activo.status.id ||
                    elemStatus.id == statusValues.en_curso.status.id ||
                    elemStatus.id == statusValues.pendiente.status.id)){
                        this.editOption = true;
                        this.deleteOption = true;
                    }
        }
    }

    setAmountValue(event: Event){
        if (event.target instanceof HTMLInputElement) {
            this.payAmount =  Number(event.target.value) || 0;
        }
        if (this.payAmount > Number(this.rawMaterialOrder?.pendingAmount)){
            this.pendingAmountInput?.setValue('0');
            this.payAmount = 0;
            console.log("Set amount value: ", this.payAmount);
        }
        console.log(this.payAmount);
    }

    setTotalAmount(){
        this.pendingAmountInput?.setValue(this.rawMaterialOrder?.pendingAmount);
        this.payAmount = Number(this.rawMaterialOrder?.pendingAmount);
    }

    get f() {
        return this.payForm.controls;
    }

    get pendingAmountInput(){
        return this.payForm.get('pendingAmount');
    }

    createPayFormGroup() {
        return new FormGroup({
            pendingAmount: new FormControl('', [
                Validators.required, 
                Validators.pattern(/^\d+(\.\d{1,2})?$/)
            ])
        });
    }

    closeRawMaterialDialog(){
        this.onResetMaterialForm();
    }

    onResetMaterialForm(){
        this.payForm.reset();
    }

    onConfirmDialog(){
        this.submitting = true;
        if(this.confirmDialogId == 1){
            let newOrder: RawMaterialOrder = {
                ...this.rawMaterialOrder,
                ...statusValues.recibido
            }
            this.dataService.updateRawMaterialOrder(newOrder)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Pedido recibido', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/rawMaterialByProvider/order');
                },
                error: error => {
                    this.alertService.error('Error al actualizar el pedido, contacte con Administracion');
            }});
        } else if (this.confirmDialogId == 2){
            let newOrder: RawMaterialOrder = {
                ...this.rawMaterialOrder,
                ...statusValues.verificado
            }
            this.dataService.updateRawMaterialOrder(newOrder)
            .pipe(
                concatMap((result: any) => {
                    // this.finishedProducts = products.retrieveFinishedProductResponse?.FinishedProducts;
                    return this.dataService.verifyRawMaterialOrder(this.rawMaterialOrder?._id!);
                })
            )
            .subscribe((rel: any) => {
                    this.alertService.success('Orden de materia prima verificada', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/rawMaterialByProvider/order');
            });
        }
    }
    

    onSaveForm() {
        if(this.payAmount <= Number(this.rawMaterialOrder?.pendingAmount)){
            this.submitting = true;
            let newPaidAmount = Number(this.payAmount) + Number(this.rawMaterialOrder?.paidAmount);
            let newPendingAmount = Number(this.rawMaterialOrder?.pendingAmount) - Number(this.payAmount);
            let newPaymentStatus = newPendingAmount == 0 ? paymentStatusValues.pagado : paymentStatusValues.abonado;
            let newAddRawMaterialOrderPaymentHistory: AddRawMaterialOrderPaymentHistory = {
                _id: this.rawMaterialOrder?._id,
                rawMaterialOrderPayments: [{
                    amount: String(this.payAmount),
                    paymentType: this.rawMaterialOrder?.paymentType?.identifier
                }]
            }
            let newOrder: RawMaterialOrder = {
                ...this.rawMaterialOrder,
                paidAmount: String(newPaidAmount),
                pendingAmount: String(newPendingAmount),
                ...newPaymentStatus
            }
            this.dataService.addRawMaterialOrderPaymentHistory(newAddRawMaterialOrderPaymentHistory)
            .pipe(
                concatMap((result: any) => {
                    delete newOrder.rawMaterialOrderPayments;
                    return this.dataService.updateRawMaterialOrder(newOrder);
                })
            ).subscribe({
                next: () => {
                    this.alertService.success('Pedido actualizado', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/rawMaterialByProvider/order');
                },
                error: error => {
                    this.alertService.error('Error al actualizar el pedido, contacte con Administracion');
            }});
        }
    }

    receiveOrder(_id?: string){
        // this.confirmDialogTitle = 'Recibir Pedido';
        // this.confirmDialogText = '¿Deseas marcar el pedido como recibido?';
        // this.confirmDialogId = 1;
        this.router.navigate(['/rawMaterialByProvider/order/edit/' + _id], {
            queryParams: {
                opt: 'receive'
            }
        })
    }

    editOrder(_id?: string){
        this.router.navigate(['/rawMaterialByProvider/order/edit/' + _id], {
            queryParams: {
                opt: 'edit'
            }
        })
    }

    validateOrder(){
        this.confirmDialogTitle = 'Validar Pedido';
        this.confirmDialogText = '¿Deseas marcar el pedido como verificado?';
        this.confirmDialogId = 2;
    }

    deleteOrder() {
        this.submitting = true;
        this.dataService.deleteRawMaterialOrder(this.rawMaterialOrder)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Pedido eliminado', { keepAfterRouteChange: true });
                this.router.navigateByUrl('/rawMaterialByProvider/order');
                },
                error: error => {
                    this.alertService.error('Error al eliminar el pedido, contacte con Administracion');
            }});
    }

    setElements(rmOrder: RawMaterialOrder){
        this.setElementOptions(rmOrder.status, rmOrder.paymentStatus);
        this.elements.push({icon : "receipt_long", name : "Notas", value : rmOrder.comment});
        this.elements.push({icon : "person", name : "Proveedor", value : rmOrder.provider?.name + " (" + rmOrder.provider?.email + ")"});
        this.elements.push({icon : "info", name : "Estado del pedido", value : rmOrder.status?.identifier});
        this.elements.push({icon : "credit_card", name : "Tipo de pago", value : rmOrder.paymentType?.identifier});
        this.elements.push({icon : "task_alt", name : "Estado de pago", value : rmOrder.paymentStatus?.identifier});
        // this.elements.push({icon : "shopping_cart", name : "Monto total", value : this.dataService.getFormatedPrice(Number(rmOrder.finalAmount))});
        // this.elements.push({icon : "production_quantity_limits", name : "Monto pendiente", value : this.dataService.getFormatedPrice(Number(rmOrder.pendingAmount))});
        this.elements.push({icon : "calendar_today", name : "Creado", value : this.dataService.getLocalDateTimeFromUTCTime(rmOrder.creationDate!)});
        this.elements.push({icon : "calendar_today", name : "Actualizado", value : this.dataService.getLocalDateTimeFromUTCTime(rmOrder.updateDate!.replaceAll("\"",""))});
        this.elements.push({icon : "badge", name : "Creado por", value : rmOrder.creatorUser?.name ? rmOrder.creatorUser.name : 'N/A'});
        this.setTableElements(rmOrder.rawMaterialOrderElements);
        this.setTablePayments(rmOrder.rawMaterialOrderPayments);
    }

    setTableElements(elements: any){
        this.tableElementsValues = [];
        elements?.forEach((element: any) => {
            const curr_row = [
                    { type: "text", value: element.rawMaterialByProvider.rawMaterialBase.name, header_name: "Nombre" },
                    // { type: "text", value: element.rawMaterialOrderElements.length, header_name: "Cantidad" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.price)), header_name: "Precio" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.discount)), header_name: "Descuento" },
                    { type: "text", value: element.quantity, header_name: "Cantidad" },
                    { type: "text", value: element.measure.identifier, header_name: "Medida" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.subtotalPrice)), header_name: "Subtotal" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.totalDiscount)), header_name: "Descuento Total" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.totalPrice)), header_name: "Total" },
                    // { type: "text", value: element.measure.unitBase.name, header_name: "Medida Base" },
                    // { type: "text", value: element.measure.unitBase.quantity, header_name: "Cantidad Base" },
            ];
            this.tableElementsValues.push(curr_row);
        });
    }

    setTablePayments(payments: any){
        this.orderPayments = [];
        payments?.forEach((payment: any) => {
            const curr_row = [
                { type: "text", value: this.dataService.getLocalDateTimeFromUTCTime(payment.date), header_name: "Fecha" },
                { type: "text", value: this.dataService.getFormatedPrice(Number(payment.amount)), header_name: "Monto" },
                { type: "text", value: payment.paymentType, header_name: "Tipo de Pago" }
            ];
            this.orderPayments.push(curr_row);
        });
    }


    generatePDF() {  
        this.pdfService.generateRawMaterialOrderPDF(this.rawMaterialOrder!);
    }  

}