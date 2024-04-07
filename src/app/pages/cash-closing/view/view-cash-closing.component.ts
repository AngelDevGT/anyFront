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
import { ActivityLog } from '@app/models/system/activity-log';
pdfMake.vfs = pdfFonts.pdfMake.vfs;

@Component({ 
    selector: 'page-cash-closing',
    templateUrl: 'view-cash-closing.component.html',
    styleUrls: ['view-cash-closing.component.scss']
})
export class ViewCashClosingComponent implements OnInit{

    id?: string;
    cashClosing?: CashClosing;
    loading = false;
    elements: any = [];
    entries = [5, 10, 20, 50];
    pageSize = 5;
    tableShopResumes?: any;
    tableSaleStoreOrders?: any;
    tableInventoryCapture?: any;
    tableActivityLogs?: any = [];
    orderPayments?: any;
    payAmount = 0;
    payForm!: FormGroup;
    panelOpenState = false;
    submitting = false;
    establishmentId = '';
    activeOption = false;
    deleteOption = false;
    verifyOption = false;
    confirmDialogTitle = '...';
    confirmDialogText = '...';
    confirmDialogId = 0;

    constructor(private dataService: DataService, private alertService: AlertService,
        private route: ActivatedRoute, private pdfService: PdfService, private router: Router) {
    }

    ngOnInit(): void {

        this.id = this.route.snapshot.params['id'];

        this.route.queryParams.subscribe(params => {
            this.establishmentId = params['store'];
        });

        this.loading = true;

        if (this.id){
            this.dataService.getCashClosingById(this.id)
                .pipe(first())
                .subscribe((cashCls: any) =>{
                    let cashClosing = cashCls.getStoreCashClosingResponse?.rawMaterial;
                    if (cashClosing){
                        this.cashClosing = cashClosing;
                        console.log(this.cashClosing);
                        if(this.cashClosing?.status?.id == 2){
                            this.activeOption = true;
                        } else if (this.cashClosing?.status?.id == 3){
                            this.deleteOption = true;
                        } else if (this.cashClosing?.status?.id == 10){
                            this.verifyOption = true;
                        }
                        this.setElements(this.cashClosing!);
                        this.loading = false;
                    }
                });
        }
    }

    closeRawMaterialDialog(){
        this.onResetMaterialForm();
    }

    onResetMaterialForm(){
        this.payForm.reset();
    }

    setElements(cashClosing: CashClosing){
        this.elements.push({icon : "receipt_long", name : "Notas", value : cashClosing.note});
        this.elements.push({icon : "info", name : "Estado", value : cashClosing.status?.identifier});
        this.elements.push({icon : "person", name : "Usuario creador", value : cashClosing.userRequest?.name + " (" + cashClosing.userRequest?.email + ")"});
        this.elements.push({icon : "calendar_today", name : "Creado", value : this.dataService.getLocalDateTimeFromUTCTime(cashClosing.creationDate!)});
        if(this.verifyOption){
            this.elements.push({icon : "person", name : "Usuario que verifico", value : cashClosing.userValidator?.name + " (" + cashClosing.userValidator?.email + ")"});
        }
        this.setTableElements(cashClosing);
    }

    setTableElements(cashClosing: CashClosing){
        this.tableSaleStoreOrders = [];
        this.tableInventoryCapture = [];
        this.tableShopResumes = [];
        this.tableActivityLogs = [];
        cashClosing.saleStoreOrders?.forEach((element: ProductForSaleStoreOrder) => {
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
                    {icon : "person", name : "Establecimiento", value : element.productForSaleStoreOrderElements![0].productForSale?.establishment?.name},
                    {icon : "info", name : "Estado del pedido", value : element.storeStatus?.identifier},
                    {icon : "calendar_today", name : "Creado", value : this.dataService.getLocalDateTimeFromUTCTime(element.creationDate!)},
                    {icon : "calendar_today", name : "Actualizado", value : this.dataService.getLocalDateTimeFromUTCTime(element.updateDate!.replaceAll("\"",""))},
                    {icon : "badge", name : "Creado por", value : element.creatorUser?.name}
                ]
            };
            this.tableSaleStoreOrders.push(curr_row);
        });
        cashClosing.activityLogs?.forEach((element: ActivityLog) => {
            const curr_row = [
                { type: "text", value: this.dataService.getLocalDateFromUTCTime(element.creationDate!), header_name: "Fecha" },
                { type: "text", value: element.action === "movement" ? "Movimiento" : element.action === "remove" ? "Retiro" : "Ingreso", header_name: "Accion" },
                // { type: "text", value: element.description, header_name: "Descripcion" },
                { type: "text", value: element.extra?.reason, header_name: "Motivo" },
                { type: "text", value: element.extra?.inventoryElement?.productForSale?.finishedProduct?.name, header_name: "Producto" },
                { type: "text", value: `${element.extra?.inventoryElement?.quantity} (${element.extra?.inventoryElement?.measure?.identifier})`, header_name: "Cantidad original" },
                { type: "text", value: `${element?.request?.newQuantity} (${element.extra?.inventoryElement?.measure?.identifier})`, header_name: "Cantidad final" }
            ];
            this.tableActivityLogs.push(curr_row);
        });
        cashClosing.inventoryCapture?.forEach((element: InventoryElement) => {
            const curr_row = [
                { type: "text", value: element.productForSale?.finishedProduct?.name, header_name: "Producto", style: "width: 30%", id: element.productForSale?._id },
                { type: "text", value: element.measure?.identifier, header_name: "Medida", style: "width: 15%" },
                { type: "text", value: element.quantity, header_name: "Cantidad", style: "width: 15%" },
                { type: "text", value: this.dataService.getFormatedPrice(Number(element.productForSale?.price)), header_name: "Precio", style: "width: 15%" },
            ];
            this.tableInventoryCapture.push(curr_row);
        });
        cashClosing.shopResumes?.forEach((element: ShopResume) => {
            const curr_row =
            { 
                accordion_name: this.dataService.getLocalDateTimeFromUTCTime(element!.updateDate!.replaceAll("\"","")),
                table_elements_values: 
                    element.itemsList?.map((elem: ItemsList) => {
                        return [
                            { type: "text", value: elem.productForSale?.finishedProduct?.name, header_name: "Nombre" },
                            { type: "text", value: this.dataService.getFormatedPrice(Number(elem.productForSale?.price)), header_name: "Precio" },
                            { type: "text", value: elem.quantity, header_name: "Cantidad" },
                            { type: "text", value: elem.measure?.identifier, header_name: "Medida" },
                            { type: "text", value: this.dataService.getFormatedPrice(Number(elem.totalDiscount)), header_name: "Descuento Total" },
                            { type: "text", value: this.dataService.getFormatedPrice(Number(elem.total)), header_name: "Total" },
                        ];
                    }),
                elements: [
                    {icon : "person", name : "Cliente", value : element?.nameClient},
                    {icon : "tag", name : "NIT", value : element?.nitClient},
                    {icon : "feed", name : "Notas", value : element?.nota},
                    {icon : "info", name : "Estado", value : element?.status?.identifier},
                    {icon : "calendar_today", name : "Fecha Creación", value : this.dataService.getLocalDateTimeFromUTCTime(element!.creationDate!.replaceAll("\"",""))},
                    {icon : "calendar_today", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(element!.updateDate!.replaceAll("\"",""))},
                ]
            };
            this.tableShopResumes.push(curr_row);
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

    actionOrder(action: number){
        switch (action) {
            case 1:
                this.confirmDialogTitle = 'Eliminar Cierre';
                this.confirmDialogText = '¿Deseas eliminar el Cierre de Caja?';
                break;
            case 2:
                this.confirmDialogTitle = 'Verificar Cierre';
                this.confirmDialogText = '¿Deseas marcar el Cierre de caja como VERIFICADO?';
                break;
            default:
                break;
        }
        this.confirmDialogId = action;
    }

    onConfirmDialog(){
        this.submitting = true;
        if(this.confirmDialogId == 1){
            this.dataService.deleteCashClosing(this.cashClosing!._id!, this.cashClosing!)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Cierre de caja eliminado', { keepAfterRouteChange: true });
                this.router.navigateByUrl('/cashClosing/' + this.establishmentId);
                },
                error: error => {
                    this.alertService.error('Error al eliminar el cierre de caja, contacte con Administracion');
            }});
        } else if (this.confirmDialogId == 2){
            this.dataService.verifyCashClosing(this.cashClosing!._id!, this.cashClosing!)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Cierre de caja verificado', { keepAfterRouteChange: true });
                this.router.navigateByUrl('/cashClosing/' + this.establishmentId);
                },
                error: error => {
                    this.alertService.error('Error al verificar el cierre de caja, contacte con Administracion');
            }});
        }
    }

    editCashClosing(){
        this.router.navigate(['/cashClosing/edit/' + this.cashClosing?._id], {
            queryParams: {
                store: this.establishmentId
            }
        });
    }

}