import { Injectable } from "@angular/core";
import { RawMaterialOrder } from "@app/models/raw-material/raw-material-order.model";
import { DataService } from "../data/data.service";
import pdfMake from "pdfmake/build/pdfmake";  
import pdfFonts from "pdfmake/build/vfs_fonts";  
import { TDocumentDefinitions } from 'pdfmake/interfaces';
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

}