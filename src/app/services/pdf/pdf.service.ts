import { Injectable } from "@angular/core";
import { RawMaterialOrder } from "@app/models/raw-material/raw-material-order.model";
import { DataService } from "../data/data.service";
import pdfMake from "pdfmake/build/pdfmake";  
import pdfFonts from "pdfmake/build/vfs_fonts";  
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { ProductForSaleStoreOrder } from "@app/models/product-for-sale/product-for-sale-store-order.model";
import { ShopResume } from "@app/models/store/shop-resume.model";
pdfMake.vfs = pdfFonts.pdfMake.vfs;

@Injectable({ providedIn: 'root' })
export class PdfService {

    constructor(private dataService: DataService) {
    }
    
    generateRawMaterialOrderPDF(rawMaterialOrder: RawMaterialOrder) {  
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
                  text: rawMaterialOrder?.name!,
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
                                text: "Nombre: " + rawMaterialOrder?.provider?.name!,
                                bold: true
                            },  
                            { text: "Empresa: " + rawMaterialOrder?.provider?.company! },  
                            { text: "Correo Electronico: " + rawMaterialOrder?.provider?.email! },  
                            { text: "Telefono (+502): " + rawMaterialOrder?.provider?.phone! }  
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
                            ...rawMaterialOrder!.rawMaterialOrderElements!.map(
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
                            [{ text: 'Total (Q)', colSpan: 5 }, {}, {}, {}, {}, rawMaterialOrder!.rawMaterialOrderElements!.reduce((sum, p) => sum + Number(p.subtotalPrice), 0).toFixed(2), rawMaterialOrder!.rawMaterialOrderElements!.reduce((sum, p) => sum + Number(p.totalDiscount), 0).toFixed(2), Number(rawMaterialOrder?.finalAmount!).toFixed(2)]
                        ]
                    }  
                },
                {  
                    text: "Monto Total: " + this.dataService.getFormatedPrice(Number(rawMaterialOrder?.finalAmount)),
                    bold: true,
                    marginTop: 10
                },  
                {  
                    text: "Monto Pendiente: " + this.dataService.getFormatedPrice(Number(rawMaterialOrder?.pendingAmount)),
                    bold: true
                },  
                {
                    text: 'Detalles del pedido',
                    style: 'sectionHeader'
                },
                {
                    text: "Estado del pedido: " + rawMaterialOrder?.status?.identifier!,
                    bold: true
                }, 
                { text: "Tipo de pago: " + rawMaterialOrder?.paymentType?.identifier! }, 
                { text: "Estado de pago: " + rawMaterialOrder?.paymentStatus?.identifier! }, 
                { text: "Creado: " + this.dataService.getLocalDateTimeFromUTCTime(rawMaterialOrder?.creationDate!) }, 
                { text: "Actualizado: " + this.dataService.getLocalDateTimeFromUTCTime(rawMaterialOrder?.updateDate!) }, 
                {
                    text: 'Notas del pedido',
                    style: 'sectionHeader'
                },
                {
                      text: rawMaterialOrder?.comment!,
                      margin: [0, 0 ,0, 15]
                },
                {  
                    columns: [  
                        [{ qr: `${rawMaterialOrder?._id!}`, fit: 50 }],  
                        [{ text: "Identificador del pedidio: " + rawMaterialOrder?._id!, alignment: 'right', italics: true }],
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

    generateProductForSaleOrderPDF(productForSaleOrder: ProductForSaleStoreOrder, option?: string) {
        console.log(productForSaleOrder);
        let storeName = productForSaleOrder?.productForSaleStoreOrderElements![0].productForSale?.establishment?.name!; 
        let docTitle = option === "factory" ? "Pedido de Producto Terminado (Fabrica)" : "Pedido de Producto para Venta (Tienda)";
        let orderStatus = option === "factory" ? productForSaleOrder?.factoryStatus?.identifier : productForSaleOrder?.storeStatus?.identifier;
        let docDefinition:TDocumentDefinitions = {
            content: [
                // {  
                //     image: 'assets/img/brand/embutidos_any_900x150_white.png',
                //     width: 100,
                //     height: 100,
                //     alignment: 'right',
                // },
                {  
                  text: docTitle,  
                  fontSize: 16,  
                  alignment: 'center',  
                  color: 'grey'
                },
                {  
                  text: productForSaleOrder?.name!,
                  fontSize: 20,  
                  bold: true,  
                  alignment: 'center',  
                  decoration: 'underline',  
                  color: '#ec5300'  
                },
                {  
                    text: 'Tienda',  
                    style: 'sectionHeader'  
                },
                {  
                    columns: [  
                        [  
                            {  
                                text: "Nombre: " + storeName,
                                bold: true
                            } 
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
                    text: 'Productos',  
                    style: 'sectionHeader'  
                },
                {  
                    table: {
                        headerRows: 1,  
                        widths: 
                        option === "factory" ? 
                        ['auto', 'auto', 'auto'] :
                        ['auto', 'auto', 'auto', 'auto', 'auto'],  
                        body: [
                            option === "factory" ? 
                            [
                                { text: 'Nombre', style: 'tableHeader' },
                                { text: 'Medida', style: 'tableHeader' },
                                { text: 'Cantidad', style: 'tableHeader' }
                            ] :
                            [
                                { text: 'Nombre', style: 'tableHeader' },
                                { text: 'Medida', style: 'tableHeader' },
                                { text: 'Precio (Q)', style: 'tableHeader' },
                                { text: 'Cantidad', style: 'tableHeader' },
                                { text: 'Total (Q)', style: 'tableHeader' }
                            ],
                            ...productForSaleOrder!.productForSaleStoreOrderElements!.map(
                                p => {
                                    if(option === "factory"){
                                        return [
                                            p.productForSale?.finishedProduct?.name!,
                                            p.measure?.identifier!,
                                            p.quantity!
                                        ]
                                    }
                                    return [
                                        p.productForSale?.finishedProduct?.name!,
                                        p.measure?.identifier!,
                                        this.dataService.getDecimalFromText(p.price!),
                                        p.quantity!,
                                        this.dataService.getDecimalFromText(p.totalPrice!)
                                    ]}),
                            option === "factory" ?
                            [{ text: 'Total', colSpan: 2 }, {}, Number(productForSaleOrder?.finalAmount!).toFixed(2)] 
                            :
                            [{ text: 'Total', colSpan: 4 }, {}, {}, {}, Number(productForSaleOrder?.finalAmount!).toFixed(2)]
                        ]
                    }  
                },
                {  
                    text: "Monto Total: " + this.dataService.getFormatedPrice(Number(productForSaleOrder?.finalAmount)),
                    bold: true,
                    marginTop: 10
                },
                {
                    text: 'Detalles del pedido',
                    style: 'sectionHeader'
                },
                {
                    text: "Estado del pedido: " + orderStatus!,
                    bold: true
                }, 
                { text: "Creado: " + this.dataService.getLocalDateTimeFromUTCTime(productForSaleOrder?.creationDate!) }, 
                { text: "Actualizado: " + this.dataService.getLocalDateTimeFromUTCTime(productForSaleOrder?.updateDate!) }, 
                {
                    text: 'Notas del pedido',
                    style: 'sectionHeader'
                },
                {
                      text: productForSaleOrder?.comment!,
                      margin: [0, 0 ,0, 15]
                },
                {
                    text: 'Codigo QR del pedido',
                    style: 'sectionHeader'
                },
                {  
                    columns: [  
                        [{ qr: `https://embutidosany.store/productsForSale/order/view/${productForSaleOrder?._id}?opt=${option}&store=${productForSaleOrder.establishmentID}`, fit: 100 }],  
                        // [{ text: `https://embutidosany.store/productsForSale/order/view/${productForSaleOrder?._id}?opt=${option}&store=${productForSaleOrder.establishmentID}`, alignment: 'right', italics: true }],
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

    generateStoreSalePDF(storeSale: ShopResume) {
        console.log(storeSale);
        let storeName = storeSale?.establecimiento?.name!;
        let docTitle = storeName;
        let docMainTitle = "Ventas en Tienda";
        let orderStatus = storeSale?.status?.identifier;
        let docDefinition:TDocumentDefinitions = {
            content: [
                // {  
                //     image: 'assets/img/brand/embutidos_any_900x150_white.png',
                //     width: 100,
                //     height: 100,
                //     alignment: 'right',
                // },
                {  
                  text: docTitle,  
                  fontSize: 16,  
                  alignment: 'center',  
                  color: 'grey'
                },
                {  
                  text: docMainTitle,
                  fontSize: 20,  
                  bold: true,  
                  alignment: 'center',  
                  decoration: 'underline',  
                  color: '#ec5300'  
                },
                {  
                    text: 'Productos',  
                    style: 'sectionHeader'  
                },
                {  
                    table: {
                        headerRows: 1,  
                        widths: ['15%', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],  
                        body: [
                            [
                                { text: 'Nombre', style: 'tableHeader' },
                                { text: 'Medida', style: 'tableHeader' },
                                { text: 'Precio (Q)', style: 'tableHeader' },
                                { text: 'Descuento (Q)', style: 'tableHeader' },
                                { text: 'Cantidad', style: 'tableHeader' },
                                { text: 'Subtotal (Q)', style: 'tableHeader' },
                                { text: 'Descuento Total (Q)', style: 'tableHeader' },
                                { text: 'Total (Q)', style: 'tableHeader' }
                            ],
                            ...storeSale!.itemsList!.map(
                                p => (
                                    [
                                        p.productForSale?.finishedProduct?.name!,
                                        p.measure?.identifier!,
                                        this.dataService.getDecimalFromText(p.price!),
                                        this.dataService.getDecimalFromText(p.discount!),
                                        p.quantity!,
                                        this.dataService.getDecimalFromText(p.subtotal!),
                                        this.dataService.getDecimalFromText(p.totalDiscount!),
                                        this.dataService.getDecimalFromText(p.total!)
                                        // (p.price * p.qty).toFixed(2)
                                    ])),
                            [{ text: 'Total (Q)', colSpan: 5 }, {}, {}, {}, {}, storeSale!.itemsList!.reduce((sum, p) => sum + Number(p.subtotal), 0).toFixed(2), storeSale!.itemsList!.reduce((sum, p) => sum + Number(p.totalDiscount), 0).toFixed(2), Number(storeSale?.total!).toFixed(2)]
                        ]
                    }  
                },
                {  
                    text: "Subtotal:   " + this.dataService.getFormatedPrice(Number(storeSale?.total || 0) - Number(storeSale?.delivery || 0)),
                    marginTop: 10
                },
                {  
                    text: "Costo envio:   " + this.dataService.getFormatedPrice(Number(storeSale?.delivery || 0)),
                    marginTop: 2
                },
                {  
                    text: "Monto Total:   " + this.dataService.getFormatedPrice(Number(storeSale?.total)),
                    bold: true,
                    marginTop: 2
                },
                {
                    text: 'Detalles de la venta',
                    style: 'sectionHeader'
                },
                {
                    text: "Estado: " + orderStatus!,
                    bold: true
                }, 
                { text: "Creado: " + this.dataService.getLocalDateTimeFromUTCTime(storeSale?.creationDate!) }, 
                { text: "Actualizado: " + this.dataService.getLocalDateTimeFromUTCTime(storeSale?.updateDate!) }, 
                {
                    text: 'Datos del Cliente',
                    style: 'sectionHeader'
                },
                { text: "Cliente: " + (storeSale.nameClient ? storeSale.nameClient : "--") }, 
                { text: "NIT: " + (storeSale.nitClient ? storeSale.nitClient : "--" ) }, 
                {
                    text: 'Notas de la venta',
                    style: 'sectionHeader'
                },
                {
                      text: storeSale?.nota ? storeSale?.nota : "--",
                      margin: [0, 0 ,0, 15]
                },
                {
                    text: 'Codigo QR de la venta',
                    style: 'sectionHeader'
                },
                {  
                    columns: [  
                        [{ qr: `https://embutidosany.store/store/sales/history/view/${storeSale?._id}`, fit: 100 }],  
                        [{  
                            text: `Fecha: ${new Date().toLocaleString()}`,  
                            alignment: 'right'  
                        }],
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