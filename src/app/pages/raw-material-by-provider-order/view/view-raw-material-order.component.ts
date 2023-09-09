import { Component, OnInit} from '@angular/core';
import { concatMap, first } from 'rxjs/operators';

import { AlertService, DataService, statusValues, paymentStatusValues } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import pdfMake from "pdfmake/build/pdfmake";  
import pdfFonts from "pdfmake/build/vfs_fonts";  
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
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
    payAmount = 0;
    payForm!: FormGroup;
    confirmDialogTitle = '...';
    confirmDialogText = '...';
    confirmDialogId = 0;
    tableHeaders = [
        {
            style: "width: 15%",
            name: "Nombre"
        },
        {
            style: "width: 10%",
            name: "Precio"
        },
        {
            style: "width: 10%",
            name: "Descuento"
        },
        {
            style: "width: 10%",
            name: "Cantidad"
        },
        {
            style: "width: 10%",
            name: "Medida"
        },
        {
            style: "width: 15%",
            name: "Subtotal"
        },
        {
            style: "width: 15%",
            name: "Descuento Total"
        },
        {
            style: "width: 15%",
            name: "Total"
        },
        // {
        //     style: "width: 10%",
        //     name: "Medida Base"
        // },
        // {
        //     style: "width: 10%",
        //     name: "Cantidad Base"
        // }
    ];

    constructor(private dataService: DataService, private alertService: AlertService,
        private route: ActivatedRoute, private router: Router) {
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
                    if (rawMaterialOrder){
                        this.rawMaterialOrder = rawMaterialOrder;
                        this.setElements(this.rawMaterialOrder!);
                        this.loading = false;
                    }
                });
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
            let newPendingAmount = Number(this.rawMaterialOrder?.pendingAmount) - this.payAmount;
            let newPaymentStatus = newPendingAmount == 0 ? paymentStatusValues.pagado : paymentStatusValues.abonado;
            let newOrder: RawMaterialOrder = {
                ...this.rawMaterialOrder,
                pendingAmount: String(newPendingAmount),
                ...newPaymentStatus
            }
            this.dataService.updateRawMaterialOrder(newOrder)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Pedido actualizado', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/rawMaterialByProvider/order');
                },
                error: error => {
                    this.alertService.error('Error al actualizar el pedido, contacte con Administracion');
            }});
        }
    }

    receiveOrder(){
        this.confirmDialogTitle = 'Recibir Pedido';
        this.confirmDialogText = '¿Deseas marcar el pedido como recibido?';
        this.confirmDialogId = 1;
    }

    validateOrder(){
        this.confirmDialogTitle = 'Validar Pedido';
        this.confirmDialogText = '¿Deseas marcar el pedido como verificado?';
        this.confirmDialogId = 2;
    }

    deleteEstablishment() {
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
        this.elements.push({icon : "receipt_long", name : "Notas", value : rmOrder.comment});
        this.elements.push({icon : "person", name : "Proveedor", value : rmOrder.provider?.name + " (" + rmOrder.provider?.email + ")"});
        this.elements.push({icon : "info", name : "Estado del pedido", value : rmOrder.status?.identifier});
        this.elements.push({icon : "credit_card", name : "Tipo de pago", value : rmOrder.paymentType?.identifier});
        this.elements.push({icon : "task_alt", name : "Estado de pago", value : rmOrder.paymentStatus?.identifier});
        // this.elements.push({icon : "shopping_cart", name : "Monto total", value : this.dataService.getFormatedPrice(Number(rmOrder.finalAmount))});
        // this.elements.push({icon : "production_quantity_limits", name : "Monto pendiente", value : this.dataService.getFormatedPrice(Number(rmOrder.pendingAmount))});
        this.elements.push({icon : "calendar_today", name : "Creado", value : this.dataService.getLocalDateTimeFromUTCTime(rmOrder.creationDate!)});
        this.elements.push({icon : "calendar_today", name : "Actualizado", value : this.dataService.getLocalDateTimeFromUTCTime(rmOrder.updateDate!.replaceAll("\"",""))});
        this.elements.push({icon : "badge", name : "Creado por", value : "Pendiente..."});
        this.setTableElements(rmOrder.rawMaterialOrderElements);
    }

    setTableElements(elements: any){
        this.tableElementsValues = {
            headers: this.tableHeaders,
            rows: []
        }
        elements?.forEach((element: any) => {
            const curr_row = {
                row: [
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
                  ],
            }
            this.tableElementsValues.rows.push(curr_row);
        });
    }


    generatePDF() {  
        let docDefinition:TDocumentDefinitions = {
            content: [
                // {  
                //     image: 'assets/img/brand/embutidos_any_900x150_white.png',
                //     width: 100,
                //     height: 100,
                //     alignment: 'right',
                // },
                {  
                  text: 'Pedido de Materia Prima',  
                  fontSize: 16,  
                  alignment: 'center',  
                  color: 'grey'
                },
                {  
                  text: this.rawMaterialOrder?.name!,
                  fontSize: 20,  
                  bold: true,  
                  alignment: 'center',  
                  decoration: 'underline',  
                  color: '#ec5300'  
                },
                {  
                    text: 'Proveedor',  
                    style: 'sectionHeader'  
                },
                {  
                    columns: [  
                        [  
                            {  
                                text: "Nombre: " + this.rawMaterialOrder?.provider?.name!,
                                bold: true
                            },  
                            { text: "Empresa: " + this.rawMaterialOrder?.provider?.company! },  
                            { text: "Correo Electronico: " + this.rawMaterialOrder?.provider?.email! },  
                            { text: "Telefono (+502): " + this.rawMaterialOrder?.provider?.phone! }  
                        ],  
                        [  
                            {  
                                text: `Fecha: ${new Date().toLocaleString()}`,  
                                alignment: 'right'  
                            },
                            // {  
                            //     text: `Pedido: ${this.rawMaterialOrder?._id}`,  
                            //     alignment: 'right'  
                            // }  
                        ]
                    ]  
                },
                {  
                    text: 'Materia Prima',  
                    style: 'sectionHeader'  
                },
                {  
                    table: {
                        headerRows: 1,  
                        widths: ['15%', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],  
                        body: [
                            [
                                { text: 'Nombre', style: 'tableHeader' },
                                { text: 'Precio (Q)', style: 'tableHeader' },
                                { text: 'Descuento (Q)', style: 'tableHeader' },
                                { text: 'Cantidad', style: 'tableHeader' },
                                { text: 'Medida', style: 'tableHeader' },
                                { text: 'Subtotal (Q)', style: 'tableHeader' },
                                { text: 'Descuento Total (Q)', style: 'tableHeader' },
                                { text: 'Total (Q)', style: 'tableHeader' }
                            ],
                            ...this.rawMaterialOrder!.rawMaterialOrderElements!.map(
                                p => (
                                    [
                                        p.rawMaterialByProvider?.rawMaterialBase?.name!,
                                        this.dataService.getDecimalFromText(p.price!),
                                        this.dataService.getDecimalFromText(p.discount!),
                                        p.quantity!,
                                        p.measure?.identifier!,
                                        this.dataService.getDecimalFromText(p.subtotalPrice!),
                                        this.dataService.getDecimalFromText(p.totalDiscount!),
                                        this.dataService.getDecimalFromText(p.totalPrice!)
                                        // (p.price * p.qty).toFixed(2)
                                    ])),
                            [{ text: 'Total (Q)', colSpan: 5 }, {}, {}, {}, {}, this.rawMaterialOrder!.rawMaterialOrderElements!.reduce((sum, p) => sum + Number(p.subtotalPrice), 0).toFixed(2), this.rawMaterialOrder!.rawMaterialOrderElements!.reduce((sum, p) => sum + Number(p.totalDiscount), 0).toFixed(2), Number(this.rawMaterialOrder?.finalAmount!).toFixed(2)]
                        ]
                    }  
                },
                {  
                    text: "Monto Total: " + this.dataService.getFormatedPrice(Number(this.rawMaterialOrder?.finalAmount)),
                    bold: true,
                    marginTop: 10
                },  
                {  
                    text: "Monto Pendiente: " + this.dataService.getFormatedPrice(Number(this.rawMaterialOrder?.pendingAmount)),
                    bold: true
                },  
                {
                    text: 'Detalles del pedido',
                    style: 'sectionHeader'
                },
                {
                    text: "Estado del pedido: " + this.rawMaterialOrder?.status?.identifier!,
                    bold: true
                }, 
                { text: "Tipo de pago: " + this.rawMaterialOrder?.paymentType?.identifier! }, 
                { text: "Estado de pago: " + this.rawMaterialOrder?.paymentStatus?.identifier! }, 
                { text: "Creado: " + this.dataService.getLocalDateTimeFromUTCTime(this.rawMaterialOrder?.creationDate!) }, 
                { text: "Actualizado: " + this.dataService.getLocalDateTimeFromUTCTime(this.rawMaterialOrder?.updateDate!) }, 
                {
                    text: 'Notas del pedido',
                    style: 'sectionHeader'
                },
                {
                      text: this.rawMaterialOrder?.comment!,
                      margin: [0, 0 ,0, 15]
                },
                {  
                    columns: [  
                        [{ qr: `${this.rawMaterialOrder?._id!}`, fit: 50 }],  
                        [{ text: "Identificador del pedidio: " + this.rawMaterialOrder?._id!, alignment: 'right', italics: true }],
                    ]
                },
            ],
            styles: {  
                sectionHeader: {  
                    bold: true,  
                    decoration: 'underline',  
                    fontSize: 14,  
                    margin: [0, 15, 0, 15]  
                },
                tableHeader: {
                    bold: true,
                    fontSize: 12,
                    fillColor: '#ffefd2'
                }
            }
        };
        // let docDefinition = {  
        //     header: 'C#Corner PDF Header',  
        //     content: 'Sample PDF generated with Angular and PDFMake for C#Corner Blog'  
        // };  
        
        pdfMake.createPdf(docDefinition).open();  
    }  

}