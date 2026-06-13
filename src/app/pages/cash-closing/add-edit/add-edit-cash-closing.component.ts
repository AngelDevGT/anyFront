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
import { CashClosing } from '@app/models/store/cash-closing.model';
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { ProductForSaleStoreOrderElement } from '@app/models/product-for-sale/product-for-sale-store-order-element.model';
import { InventoryElement } from '@app/models/inventory/inventory-element.model';
import { ShopResume } from '@app/models/store/shop-resume.model';
import { ItemsList } from '@app/models/store/item-list.model';
import { forkJoin } from 'rxjs';
import { ActivityLog } from '@app/models/system/activity-log';
import { InventoryElementAction } from '@app/models/inventory/inventory-element-action.model';
pdfMake.vfs = pdfFonts.pdfMake.vfs;

@Component({ 
    selector: 'page-cash-closing',
    templateUrl: 'add-edit-cash-closing.component.html',
    styleUrls: ['add-edit-cash-closing.component.scss']
})
export class AddEditCashClosingComponent implements OnInit{

    id?: string;
    title?: string;
    cashClosings?: CashClosing[];
    cashClosing?: CashClosing;
    newCashClosing: CashClosing = {};
    addActivityLogFilter: any = {};
    removeActivityLogFilter: any = {};
    operationRawMaterialForm!: FormGroup;
    loading = false;
    elementsByUpdate: any = [];
    elementsByCreate: any = [];
    entries = this.dataService.tableEntries;
    pageSize = this.dataService.defaultPageSize;
    tableShopResumes?: any = [];
    tableSaleStoreOrders?: any = [];
    tableCreditPayments?: any = [];
    tableInventoryCapture?: any = [];
    tableLastInventory?: any = [];
    totalDiscountShopResumes = 0;
    totalDeliveryShopResumes = 0;
    totalAmountShopResumes = 0;
    totalAmountSale = 0;
    totalAmountStoreOrders = [0, 0, 0];
    totalAmountInventoryCapture = 0;
    totalAmountLastInventory = 0;
    totalAmountCashClosing = 0;
    totalRemainingCashClosing = 0;

    // Cierre de caja
    totalNonCreditSales = 0;
    totalCreditSales = 0;
    totalCreditSalesFull = 0;
    totalDepositSales = 0;
    totalDeliveryDeposit = 0;
    totalCreditPaymentsCash = 0;
    totalCreditPaymentsDeposit = 0;
    totalCreditPaymentsCheque = 0;
    totalCreditPaymentsTotal = 0;
    totalStoreExpenses = 0;
    totalIngresos = 0;
    totalEgresos = 0;
    totalEfectivo = 0;

    // Resumen de pagos de crédito por tipo (filas) y destino pedido/envío (columnas)
    creditPaymentsSummary = {
        efectivo: { order: 0, delivery: 0 },
        deposito: { order: 0, delivery: 0 },
        cheque: { order: 0, delivery: 0 }
    };

    // Créditos
    previousCreditBalance = 0;
    newCreditBalance = 0;
    activityLogs?: any = [];
    activityLogsModifiedAmounts?: any = {};
    tableActivityLogs?: any = [];
    orderPayments?: any;
    payAmount = 0;
    payForm!: FormGroup;
    panelOpenState = false;
    submitting = false;
    establishmentId = '';
    maxDate: Date = new Date();
    currDate: Date = new Date();
    isUpdate = false;

    constructor(private dataService: DataService, private alertService: AlertService,
        private route: ActivatedRoute, private pdfService: PdfService, private router: Router) {
    }

    ngOnInit(): void {

        this.id = this.route.snapshot.params['id'];
        this.title = 'Crear cierre de caja';

        if(this.id === "0"){
            this.id = '65e58138e22499ab7172cb48';
        } else {
            this.isUpdate = true;
            this.title = 'Actualizar cierre de caja';
        }

        this.route.queryParams.subscribe(params => {
            this.establishmentId = params['store'];
        });

        this.loading = true;

        if (this.id){
            if(!this.isUpdate){
                this.cashClosings = [];
                this.dataService.getNewCashClosing(this.establishmentId)
                    .pipe(first())
                    .subscribe({
                        next: (cashClosings: any) => {
                            this.cashClosing = this.dataService.findJsonValue(cashClosings, 'json_result') || {};
                            this.setElements(this.cashClosing!);
                            this.loading = false;
                        }
                    });
            } else {
                this.dataService.getCashClosingById(this.id)
                    .pipe(first())
                    .subscribe((cashCls: any) =>{
                        let cashClosing = this.dataService.findJsonValue(cashCls, 'json_result') || {};
                        if (cashClosing){
                            this.cashClosing = cashClosing;
                            // this.setElements(this.cashClosing!);
                            this.operationRawMaterialForm.patchValue(cashClosing);
                            this.loading = false;
                        }
                    });
            }
        }

        this.operationRawMaterialForm = this.createOperationMaterialFormGroup();

    }

    setLastCashClosingDate(){
        this.cashClosings = this.cashClosings?.filter((cashClosing: CashClosing) => cashClosing.status?.id !== 3);
        if(this.cashClosings && this.cashClosings.length > 0){
            this.cashClosings = this.cashClosings?.sort((a,b) => {
                const fechaA = new Date(a.creationDate!);
                const fechaB = new Date(b.creationDate!);
                return fechaB.getTime() - fechaA.getTime();
            });
            let lastCashClosing = this.cashClosings[0];
            this.currDate = new Date(lastCashClosing.creationDate!);
        } else {
            const newDate = new Date();
            newDate.setDate(newDate.getDate() - 1000);
            this.currDate = newDate;
        }
        // this.operationRawMaterialForm.controls['initialDate'].setValue(this.currDate);
    }

    closeRawMaterialDialog(){
        this.onResetMaterialForm();
    }

    onResetMaterialForm(){
        this.payForm.reset();
    }

    setElements(cashClosing: CashClosing){
        this.elementsByUpdate.push({icon : "receipt_long", name : "Notas", value : cashClosing.note});
        this.elementsByUpdate.push({icon : "calendar_today", name : "Ultimo cierre de caja", value : cashClosing.lastInventoryCreationDate ? this.dataService.getLocalDateTimeFromUTCTime(cashClosing.lastInventoryCreationDate): 'Sin cierre anterior'});
        this.elementsByCreate.push({icon : "calendar_today", name : "Ultimo cierre de caja", value : cashClosing.lastInventoryCreationDate ? this.dataService.getLocalDateTimeFromUTCTime(cashClosing.lastInventoryCreationDate): 'Sin cierre anterior'});
        this.elementsByUpdate.push({icon : "info", name : "Estado", value : cashClosing.status?.identifier});
        this.elementsByUpdate.push({icon : "person", name : "Persona a cargo", value : cashClosing.userRequest?.name + " (" + cashClosing.userRequest?.email + ")"});
        // this.elementsByUpdate.push({icon : "calendar_today", name : "Creado", value : this.dataService.getLocalDateTimeFromUTCTime(cashClosing.creationDate!)});
        this.setTableElements(cashClosing);
    }

    setTableElements(cashClosing: CashClosing, activityLogs?: ActivityLog[]){
        this.tableSaleStoreOrders = [];
        this.tableInventoryCapture = [];
        this.tableLastInventory = [];
        this.tableShopResumes = [];
        this.tableCreditPayments = [];
        this.tableActivityLogs = [];
        this.totalDiscountShopResumes = 0;
        this.totalDeliveryShopResumes = 0;
        this.totalAmountShopResumes = 0;
        this.totalAmountStoreOrders = [0,0,0];
        this.totalAmountInventoryCapture = 0;
        this.totalAmountLastInventory = 0;
        this.totalAmountCashClosing = 0;
        this.totalRemainingCashClosing = 0;
        cashClosing.saleStoreOrders?.forEach((element: ProductForSaleStoreOrder) => {
            if(element.storeStatus?.id == 22){ //Recibido
                this.totalAmountStoreOrders[0] += Number(element.finalAmount || 0);
            } else if(element.storeStatus?.id == 19){ //Pendiente
                this.totalAmountStoreOrders[1] += Number(element.finalAmount || 0);
            } else if(element.storeStatus?.id == 21){ //Listo
                this.totalAmountStoreOrders[2] += Number(element.finalAmount || 0);
            } 
            const curr_row =
            { 
                accordion_name: element.name,
                table_elements_values: 
                    element.productForSaleStoreOrderElements?.map((elem: ProductForSaleStoreOrderElement) => {
                        return [
                            { type: "text", value: elem.productForSale?.finishedProduct?.name, header_name: "Producto" },
                            { type: "text", value: this.dataService.getFormatedPrice(Number(elem.price)), header_name: "Precio" },
                            { type: "text", value: elem.quantity, header_name: "Cantidad" },
                            { type: "text", value: elem.measure?.identifier, header_name: "Medida" },
                            { type: "text", value: this.dataService.getFormatedPrice(Number(elem.totalPrice)), header_name: "Total" },
                        ];
                    }),
                elements: [
                    {icon : "receipt_long", name : "Notas", value : element.comment},
                    {icon : "person", name : "Tienda", value : cashClosing.establishment?.name},
                    {icon : "info", name : "Estado del pedido", value : element.storeStatus?.identifier},
                    {icon : "calendar_today", name : "Creado", value : this.dataService.getLocalDateTimeFromUTCTime(element.creationDate!)},
                    {icon : "calendar_today", name : "Actualizado", value : this.dataService.getLocalDateTimeFromUTCTime(element.updatedDate!.replaceAll("\"",""))},
                    {icon : "badge", name : "Creado por", value : element.creatorUser?.name},
                    {icon : "payments", name : "Total", value : this.dataService.getFormatedPrice(Number(element?.finalAmount || 0))},
                ]
            };
            this.tableSaleStoreOrders.push(curr_row);
        });
        cashClosing.inventoryCapture?.forEach((element: InventoryElement) => {
            if (Number(element.quantity || 0) > 0 ){
                const currTotal = Number(element.productForSale?.price || 0) * Number(element.quantity || 0);
                this.totalAmountInventoryCapture += currTotal;
                const curr_row = [
                    { type: "text", value: element.productForSale?.finishedProduct?.name, header_name: "Producto", style: "width: 30%", id: element.productForSale?.id },
                    { type: "text", value: element.measure?.identifier, header_name: "Medida", style: "width: 15%" },
                    { type: "text", value: element.quantity, header_name: "Cantidad", style: "width: 15%" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.productForSale?.price)), header_name: "Precio", style: "width: 15%" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(currTotal)), header_name: "Total", style: "width: 15%" },
                ];
                this.tableInventoryCapture.push(curr_row);
            }
        });
        cashClosing.lastInventory?.forEach((element: InventoryElement) => {
            if (Number(element.quantity || 0) > 0 ){
                const currTotal = Number(element.productForSale?.price || 0) * Number(element.quantity || 0);
                this.totalAmountLastInventory += currTotal;
                const curr_row = [
                    { type: "text", value: element.productForSale?.finishedProduct?.name, header_name: "Producto", style: "width: 30%", id: element.productForSale?.id },
                    { type: "text", value: element.measure?.identifier, header_name: "Medida", style: "width: 15%" },
                    { type: "text", value: element.quantity, header_name: "Cantidad", style: "width: 15%" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.productForSale?.price)), header_name: "Precio", style: "width: 15%" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(currTotal)), header_name: "Total", style: "width: 15%" },
                ];
                this.tableLastInventory.push(curr_row);
            }
        });
        let totalActivityLogsAmountAdded = 0;
        let totalActivityLogsAmountRemoved = 0;
        let filteredInventoryElementActions = cashClosing.inventoryElementActions?.filter((element: InventoryElementAction) => {
            return element.actionType?.type == 'REMOVE_PFS_MANUAL' || element.actionType?.type == 'ADD_PFS_MANUAL' || element.actionType?.type == 'RETURN_PFS_BY_DEVOLUTION';
        });

        filteredInventoryElementActions?.forEach((element: InventoryElementAction) => {
            const totalAmount = Number(element.quantity || 0) * Number(element.price || 0);

            if (element.actionType?.type == 'ADD_PFS_MANUAL'){
                totalActivityLogsAmountAdded += totalAmount;
            } else if (element.actionType?.type == 'REMOVE_PFS_MANUAL' || element.actionType?.type == 'RETURN_PFS_BY_DEVOLUTION'){
                totalActivityLogsAmountRemoved += totalAmount;
            }

            const curr_row = [
                { type: "text", value: element.actionType?.action, header_name: "Accion" },
                { type: "text", value: this.dataService.getLocalDateTimeFromUTCTime(element.creationDate!), header_name: "Fecha" },
                { type: "text", value: element.reason, header_name: "Razon" },
                { type: "text", value: element.element?.name, header_name: "Elemento" },
                { type: "text", value: `${element.quantity} ${element.measure?.identifier}(s)`, header_name: "Cantidad" },
                { type: "text", value: this.dataService.getFormatedPrice(totalAmount), header_name: "Total" },
            ];
            this.tableActivityLogs.push(curr_row);
        });
        this.activityLogsModifiedAmounts.added = totalActivityLogsAmountAdded;
        this.activityLogsModifiedAmounts.removed = totalActivityLogsAmountRemoved;
        this.totalCreditSales = 0;
        this.totalCreditSalesFull = 0;
        this.totalDepositSales = 0;
        this.totalDeliveryDeposit = 0;
        this.totalCreditPaymentsCash = 0;
        this.totalCreditPaymentsDeposit = 0;
        this.totalCreditPaymentsCheque = 0;
        this.totalCreditPaymentsTotal = 0;
        this.creditPaymentsSummary = {
            efectivo: { order: 0, delivery: 0 },
            deposito: { order: 0, delivery: 0 },
            cheque: { order: 0, delivery: 0 }
        };
        this.previousCreditBalance = Number(cashClosing.previousCreditBalance || 0);

        this.totalNonCreditSales = 0;
        cashClosing.shopResumes?.forEach((element: ShopResume) => {
            const subtotal = Number(element.total || 0) - Number(element.delivery || 0);
            const deliveryCost = Number(element.delivery || 0);
            this.totalDiscountShopResumes += Number(element.totalDiscount || 0);
            this.totalDeliveryShopResumes += deliveryCost;
            this.totalAmountShopResumes += subtotal;

            const orderType = element.paymentType?.identifier;
            const deliveryType = element.deliveryPaymentType?.identifier;

            // Pedido
            if (orderType === 'Crédito') {
                this.totalCreditSales += Number(element.pendingAmount || 0);
                this.totalCreditSalesFull += subtotal;
            } else {
                this.totalNonCreditSales += subtotal;
                if (orderType === 'Depósito') {
                    this.totalDepositSales += subtotal;
                }
            }

            // Envío
            if (deliveryType === 'Crédito') {
                this.totalCreditSales += Number(element.deliveryPendingAmount || 0);
                this.totalCreditSalesFull += deliveryCost;
            } else if (deliveryType === 'Depósito') {
                this.totalDeliveryDeposit += deliveryCost;
            }
            const curr_row =
            { 
                accordion_name: this.dataService.getLocalDateTimeFromUTCTime(element!.updatedDate!.replaceAll("\"","")),
                table_elements_values: 
                    element.itemsList?.map((elem: ItemsList) => {
                        return [
                            { type: "text", value: elem.productForSale?.finishedProduct?.name, header_name: "Nombre" },
                            { type: "text", value: elem.measure?.identifier, header_name: "Medida" },
                            { type: "text", value: elem.quantity, header_name: "Cantidad" },
                            { type: "text", value: this.dataService.getFormatedPrice(Number(elem.price)), header_name: "Precio" },
                            { type: "text", value: this.dataService.getFormatedPrice(Number(elem.totalDiscount)), header_name: "Descuento Total" },
                            { type: "text", value: this.dataService.getFormatedPrice(Number(elem.total)), header_name: "Total" },
                        ];
                    }),
                elements_top: [
                    {icon : "person", name : "Cliente", value : element?.nameClient},
                    {icon : "tag", name : "NIT", value : element?.nitClient},
                    {icon : "feed", name : "Notas", value : element?.nota ? element?.nota : '--'},
                    {icon : "payments", name : "Tipo de pago", value : element?.paymentType?.identifier ?? '--'},
                    {icon : "calendar_today", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(element!.updatedDate!.replaceAll("\"",""))},
                ],
                elements_bottom: [
                    {icon : "add", name : "Subtotal", value : this.dataService.getFormatedPrice(Number(element.total || 0) - Number(element.delivery || 0) + Number(element.totalDiscount || 0))},
                    {icon : "add", name : "Envio", value : this.dataService.getFormatedPrice(Number(element?.delivery || 0))},
                    {icon : "remove", name : "Descuento", value : this.dataService.getFormatedPrice(Number(element?.totalDiscount || 0))},
                    {icon : "payments", name : "Total", value : this.dataService.getFormatedPrice(Number(element.total || 0))},
                ]
            };
            this.tableShopResumes.push(curr_row);
        });

        cashClosing.creditPayments?.forEach((payment: any) => {
            const amount = Number(payment.amount || 0);
            this.totalCreditPaymentsTotal += amount;
            const targetKey = payment.paymentTarget === 'DELIVERY' ? 'delivery' : 'order';
            if (payment.paymentType?.identifier === 'Efectivo') {
                this.totalCreditPaymentsCash += amount;
                this.creditPaymentsSummary.efectivo[targetKey] += amount;
            }
            if (payment.paymentType?.identifier === 'Depósito') {
                this.totalCreditPaymentsDeposit += amount;
                this.creditPaymentsSummary.deposito[targetKey] += amount;
            }
            if (payment.paymentType?.identifier === 'Cheque') {
                this.totalCreditPaymentsCheque += amount;
                this.creditPaymentsSummary.cheque[targetKey] += amount;
            }

            const curr_row = {
                accordion_name: this.dataService.getLocalDateTimeFromUTCTime(payment.date?.replaceAll("\"","") || payment.date),
                elements_top: [
                    {icon : "person", name : "Cliente", value : payment.shopSale?.nameClient},
                    {icon : "tag", name : "NIT", value : payment.shopSale?.nitClient},
                    {icon : "calendar_today", name : "Fecha de venta", value : this.dataService.getLocalDateTimeFromUTCTime(payment.shopSale?.creationDate?.replaceAll("\"","") || payment.shopSale?.creationDate)},
                ],
                elements_payment: [
                    {icon : "payments", name : "Monto pagado", value : this.dataService.getFormatedPrice(Number(payment.amount || 0))},
                    {icon : "credit_card", name : "Tipo de pago", value : payment.paymentType?.identifier ?? '--'},
                    {icon : "local_shipping", name : "Destino", value : this.getPaymentTargetLabel(payment.paymentTarget)},
                    {icon : "calendar_today", name : "Fecha de pago", value : this.dataService.getLocalDateTimeFromUTCTime(payment.date?.replaceAll("\"","") || payment.date)},
                ],
                shopSaleId: payment.shopSale?.id
            };
            this.tableCreditPayments.push(curr_row);
        });

        this.totalStoreExpenses = (cashClosing.storeExpenses ?? [])
            .reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

        this.totalAmountSale = this.totalAmountShopResumes - this.totalDiscountShopResumes + this.totalDeliveryShopResumes;
        this.totalAmountCashClosing = (
            this.totalAmountInventoryCapture
            + this.totalAmountShopResumes
            + this.totalDiscountShopResumes)
            - (this.totalAmountStoreOrders[0] + this.totalAmountLastInventory)
            - totalActivityLogsAmountAdded
            + totalActivityLogsAmountRemoved;

        this.recalcularCierreCaja();
    }

    getPaymentTargetLabel(target?: string): string {
        if (target === 'DELIVERY') return 'Envío';
        if (target === 'ORDER') return 'Pedido';
        return '--';
    }

    recalcularCierreCaja() {
        const sobrante = Number(this.operationRawMaterialForm?.value?.sobrante || 0);
        this.totalIngresos = this.totalAmountShopResumes
            + this.totalDiscountShopResumes
            + this.totalDeliveryShopResumes
            + this.totalCreditPaymentsCash
            + this.totalCreditPaymentsDeposit
            + sobrante;
        this.totalEgresos = this.totalDiscountShopResumes
            + this.totalDepositSales
            + this.totalDeliveryDeposit
            + this.totalStoreExpenses
            + this.totalCreditSalesFull;
        this.totalEfectivo = this.totalIngresos - this.totalEgresos;
        this.newCreditBalance = this.previousCreditBalance + this.totalCreditSalesFull - this.totalCreditPaymentsTotal;
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

    viewShopSale(shopSaleId: string){
        const url = this.router.serializeUrl(
            this.router.createUrlTree(['/store/sales/history/view/' + shopSaleId])
        );
        window.open(url, '_blank');
    }

    // generatePDF() {  
    //     this.pdfService.generateRawMaterialOrderPDF(this.rawMaterialOrder!);
    // }  

    createOperationMaterialFormGroup() {
        return new FormGroup({
            note: new FormControl('', [Validators.maxLength(100)]),
            sobrante: new FormControl(0, [Validators.required, Validators.min(0)])
        });
    }

    get or() {
        return this.operationRawMaterialForm.controls;
    }

    onSaveForm() {
        // reset alerts on submit
        this.alertService.clear();

        // this.currDate = new Date(this.operationRawMaterialForm.controls['initialDate'].value);

        let queryParams = {
            validation: false
        }

        this.submitting = true;
        if(this.isUpdate){
            let notes = this.operationRawMaterialForm.value.note;
            this.dataService.updateCashClosing(this.cashClosing!.id!, notes)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Cierre de caja actualizado', { keepAfterRouteChange: true });
                this.router.navigateByUrl('/cashClosing/' + this.establishmentId);
                },
                error: error => {
                    this.alertService.error('Error al actializar el cierre de caja, contacte con Administracion');
            }});
        } else {

            let notes = this.operationRawMaterialForm.value.note;
            let sobrante = Number(this.operationRawMaterialForm.value.sobrante || 0);
            this.dataService.addCashClosingV4(notes, this.establishmentId, sobrante)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Cierre de Caja guardada', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/cashClosing/' + this.establishmentId);
                },
                error: error => {
                    let errorResponse = error.error;
                    errorResponse = errorResponse.addEstablishmentResponse ? errorResponse.addEstablishmentResponse : errorResponse.updateEstablishmentResponse ? errorResponse.updateEstablishmentResponse : 'Error, consulte con el administrador';
                    this.alertService.error(errorResponse.AcknowledgementDescription);
                    this.submitting = false;
                }
            });
        }
    }

}