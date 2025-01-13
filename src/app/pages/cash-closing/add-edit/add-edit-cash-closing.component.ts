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
    activityLogFilter: any = {};
    operationRawMaterialForm!: FormGroup;
    loading = false;
    elementsByUpdate: any = [];
    elementsByCreate: any = [];
    entries = [5, 10, 20, 50];
    pageSize = 5;
    tableShopResumes?: any = [];
    tableSaleStoreOrders?: any = [];
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
    activityLogs?: any = [];
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
                this.dataService.getAllCashClosing()
                .pipe(first())
                .subscribe({
                    next: (cashClosings: any) => {
                        this.cashClosings = cashClosings.retrieveStoreCashClosingResponse?.StoreCashClosing;
                        this.loadNewCashClosing();
                    }
                });
                
            } else {
                this.dataService.getCashClosingById(this.id)
                    .pipe(first())
                    .subscribe((cashCls: any) =>{
                        let cashClosing = cashCls.getStoreCashClosingResponse?.rawMaterial;
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

    loadNewCashClosing(isFromForm?: boolean){
        if(isFromForm && !this.or['initialDate'].errors){
            // this.currDate = new Date(this.operationRawMaterialForm.controls['initialDate'].value);
            this.getNewCashClosing();
        } else {
            // this.setLastCashClosingDate();
            this.getNewCashClosing();
        }
    }

    getNewCashClosing(){
        let requestArray = [];
        this.loading = true;
        let queryParams = {
            validation: true
        }
        this.newCashClosing = {
            note: 'validation',
            // initialDate: `${this.currDate.getFullYear()}/${this.currDate.getMonth() + 1}/${this.currDate.getDate()}`,
            storeID: this.establishmentId
        };

        this.activityLogFilter = {};
        // const startDateOnly = new Date(this.currDate).toISOString().split('T')[0].replace(/-/g, '/');
        const endDateOnly = new Date().toISOString().split('T')[0].replace(/-/g, '/');
        // console.log('startDateOnly', startDateOnly);
        this.activityLogFilter.section = "Acciones de Producto para Venta en tienda|||" + this.establishmentId;
        // this.activityLogFilter.initialDate = startDateOnly;
        this.activityLogFilter.finalDate = endDateOnly;

        this.dataService.addCashClosingV2(this.newCashClosing, queryParams).pipe(
            concatMap((cashClosing: any) => {
                this.cashClosing = cashClosing.addStoreCashClosingResponse?.data;
                this.setElements(this.cashClosing!);
                let lastInventoryCreationDate = this.cashClosing?.lastInventoryCreationDate;
                if (lastInventoryCreationDate){
                    this.activityLogFilter.initialDate = lastInventoryCreationDate;
                } else {
                    const newDate = new Date();
                    newDate.setDate(newDate.getDate() - 10000);
                    this.activityLogFilter.initialDate = new Date(newDate).toISOString().split('T')[0].replace(/-/g, '/');
                }
                return this.dataService.getAllActivityLogsByFilter(this.activityLogFilter);
            })
        ).subscribe({
            next: (activityLogs: any) => {
                this.activityLogs = activityLogs.retrieveActivityLogResponse?.activityLogs;
                this.setTableElements(this.cashClosing!, this.activityLogs);
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.loading = false;
            }
        });

        // requestArray.push(this.dataService.addCashClosingV2(this.newCashClosing, queryParams));
        // requestArray.push(this.dataService.getAllActivityLogsByFilter(this.activityLogFilter));

        // forkJoin(requestArray).subscribe({
        //     next: (result: any) => {
        //         let cashClosing = result[0].addStoreCashClosingResponse?.data;
        //         if (cashClosing){
        //             this.cashClosing = cashClosing;
        //         }
        //         this.activityLogs = result[1].retrieveActivityLogResponse?.activityLogs;
        //     },
        //     error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
        //     complete: () => {
        //         this.setTableElements(this.cashClosing!, this.activityLogs);
        //         this.loading = false;
        //     }
        // });
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
        this.elementsByUpdate.push({icon : "calendar_today", name : "Creado", value : this.dataService.getLocalDateTimeFromUTCTime(cashClosing.creationDate!)});
        this.setTableElements(cashClosing);
    }

    setTableElements(cashClosing: CashClosing, activityLogs?: ActivityLog[]){
        this.tableSaleStoreOrders = [];
        this.tableInventoryCapture = [];
        this.tableLastInventory = [];
        this.tableShopResumes = [];
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
            if(element.storeStatus?.id == 3){ //Recibido
                this.totalAmountStoreOrders[0] += Number(element.finalAmount || 0);
            } else if(element.storeStatus?.id == 1){ //Pendiente
                this.totalAmountStoreOrders[1] += Number(element.finalAmount || 0);
            } else if(element.storeStatus?.id == 7){ //Listo
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
                    {icon : "person", name : "Tienda", value : element.productForSaleStoreOrderElements![0].productForSale?.establishment?.name},
                    {icon : "info", name : "Estado del pedido", value : element.storeStatus?.identifier},
                    {icon : "calendar_today", name : "Creado", value : this.dataService.getLocalDateTimeFromUTCTime(element.creationDate!)},
                    {icon : "calendar_today", name : "Actualizado", value : this.dataService.getLocalDateTimeFromUTCTime(element.updateDate!.replaceAll("\"",""))},
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
                    { type: "text", value: element.productForSale?.finishedProduct?.name, header_name: "Producto", style: "width: 30%", id: element.productForSale?._id },
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
                    { type: "text", value: element.productForSale?.finishedProduct?.name, header_name: "Producto", style: "width: 30%", id: element.productForSale?._id },
                    { type: "text", value: element.measure?.identifier, header_name: "Medida", style: "width: 15%" },
                    { type: "text", value: element.quantity, header_name: "Cantidad", style: "width: 15%" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.productForSale?.price)), header_name: "Precio", style: "width: 15%" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(currTotal)), header_name: "Total", style: "width: 15%" },
                ];
                this.tableLastInventory.push(curr_row);
            }
        });
        console.log('activityLogs', activityLogs);
        activityLogs?.forEach((element: ActivityLog) => {
            const curr_row = [
                { type: "text", value: this.dataService.getLocalDateTimeFromUTCTime(element.creationDate!), header_name: "Fecha" },
                { type: "text", value: this.dataService.getLogActionName(element.action), header_name: "Accion" },
                { type: "text", value: element.extra?.reason, header_name: "Motivo" },
                { type: "text", value: element.description, header_name: "Descripcion" },
                // { type: "text", value: element.extra?.inventoryElement?.productForSale?.finishedProduct?.name, header_name: "Producto" },
                // { type: "text", value: `${element.extra?.inventoryElement?.quantity} (${element.extra?.inventoryElement?.measure?.identifier})`, header_name: "Cantidad original" },
                // { type: "text", value: `${element?.request?.newQuantity} (${element.extra?.inventoryElement?.measure?.identifier})`, header_name: "Cantidad final" }
            ];
            this.tableActivityLogs.push(curr_row);
        });
        cashClosing.shopResumes?.forEach((element: ShopResume) => {
            this.totalDiscountShopResumes += Number(element.totalDiscount || 0);
            this.totalDeliveryShopResumes += Number(element.delivery || 0);
            this.totalAmountShopResumes += (Number(element.total || 0) - Number(element.delivery || 0));
            const curr_row =
            { 
                accordion_name: this.dataService.getLocalDateTimeFromUTCTime(element!.updateDate!.replaceAll("\"","")),
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
                    {icon : "calendar_today", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(element!.updateDate!.replaceAll("\"",""))},
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
        this.totalAmountSale = this.totalAmountShopResumes - this.totalDiscountShopResumes + this.totalDeliveryShopResumes;
        this.totalAmountCashClosing = (this.totalAmountInventoryCapture + this.totalAmountShopResumes + this.totalDiscountShopResumes) - (this.totalAmountStoreOrders[0] + this.totalAmountLastInventory);
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

    // generatePDF() {  
    //     this.pdfService.generateRawMaterialOrderPDF(this.rawMaterialOrder!);
    // }  

    createOperationMaterialFormGroup() {
        return new FormGroup({
            note: new FormControl('', [Validators.maxLength(100)]),
            // initialDate: new FormControl('', [this.isUpdate ? Validators.nullValidator : Validators.required, Validators.maxLength(45)])
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
            let newCashClosing = {
                ...this.cashClosing,
                ...this.operationRawMaterialForm.value
            };
            newCashClosing.note = newCashClosing.note && newCashClosing.note.trim() ? newCashClosing.note.trim() : '--';
            this.dataService.updateCashClosing(this.cashClosing!._id!, newCashClosing)
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

            let requestArray = [];
            this.activityLogFilter = {};
            // const startDateOnly = new Date(this.currDate).toISOString().split('T')[0].replace(/-/g, '/');
            const endDateOnly = new Date().toISOString().split('T')[0].replace(/-/g, '/');
            // console.log('startDateOnly', startDateOnly);
            this.activityLogFilter.section = "Acciones de Producto para Venta en tienda|||" + this.establishmentId;
            // this.activityLogFilter.initialDate = startDateOnly;
            this.activityLogFilter.finalDate = endDateOnly;

            let lastInventoryCreationDate = this.cashClosing?.lastInventoryCreationDate;
            if (lastInventoryCreationDate){
                this.activityLogFilter.initialDate = lastInventoryCreationDate;
            } else {
                const newDate = new Date();
                newDate.setDate(newDate.getDate() - 10000);
                this.activityLogFilter.initialDate = new Date(newDate).toISOString().split('T')[0].replace(/-/g, '/');
            }

            requestArray.push(this.dataService.getAllActivityLogsByFilter(this.activityLogFilter));

            forkJoin(requestArray).subscribe({
                next: (result: any) => {
                    this.activityLogs = result[0].retrieveActivityLogResponse?.activityLogs;
                },
                error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
                complete: () => {
                    // this.loading = false;

                    this.newCashClosing = {
                        ...this.operationRawMaterialForm.value,
                        activityLogs: this.activityLogs,
                        // initialDate: `${this.currDate.getFullYear()}/${this.currDate.getMonth() + 1}/${this.currDate.getDate()}`,
                        storeID: this.establishmentId
                    };

                    this.newCashClosing.note = this.newCashClosing.note && this.newCashClosing.note.trim() ? this.newCashClosing.note.trim() : '--';
                    this.dataService.addCashClosingV2(this.newCashClosing, queryParams)
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
            });

        }
    }

}