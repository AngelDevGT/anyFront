import { Injectable } from "@angular/core";
import { RawMaterialOrder } from "@app/models/raw-material/raw-material-order.model";
import { DataService } from "../data/data.service";
import pdfMake from "pdfmake/build/pdfmake";  
import pdfFonts from "pdfmake/build/vfs_fonts";  
import { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { ProductForSaleStoreOrder } from "@app/models/product-for-sale/product-for-sale-store-order.model";
import { ShopResume } from "@app/models/store/shop-resume.model";
pdfMake.vfs = pdfFonts.pdfMake.vfs;

@Injectable({ providedIn: 'root' })
export class PdfService {

    private readonly pdfStyles = {
        sectionHeader: {
            bold: true,
            decoration: 'underline' as const,
            fontSize: 14,
            margin: [0, 15, 0, 15] as [number, number, number, number]
        },
        tableHeader: {
            bold: true,
            fontSize: 12,
            fillColor: '#ffefd2'
        }
    };

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
                            //     text: `Pedido: ${this.rawMaterialOrder?.id}`,  
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
                { text: "Actualizado: " + this.dataService.getLocalDateTimeFromUTCTime(rawMaterialOrder?.updatedDate!) }, 
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
                        // [{ qr: `${rawMaterialOrder?.id!}`, fit: 50 }],  
                        [{ text: "Identificador del pedidio: " + rawMaterialOrder?.id!, alignment: 'right', italics: true }],
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
        let docDefinition:TDocumentDefinitions = {
            content: this.buildProductForSaleOrderContent(productForSaleOrder, option),
            styles: this.pdfStyles
        };

        pdfMake.createPdf(docDefinition).open();
    }

    /**
     * Genera un unico PDF con varios pedidos: cada pedido en su propia hoja.
     */
    async generateMultipleProductForSaleOrdersPDF(orders: ProductForSaleStoreOrder[], option?: string, storeName?: string) {
        const store = storeName || orders[0]?.establishment?.name || '';

        let content: Content[] = [];

        // Un pedido por hoja
        orders.forEach((order, orderIndex) => {
            const orderContent = this.buildProductForSaleOrderContent(order, option);
            orderContent.forEach((element: any, index: number) => {
                if (index === 0 && orderIndex > 0) element.pageBreak = 'before';
                content.push(element);
            });
        });

        let docDefinition:TDocumentDefinitions = {
            content: content,
            styles: this.pdfStyles
        };

        pdfMake.createPdf(docDefinition).download(this.getMultipleOrdersFileName(store));
    }

    private getMultipleOrdersFileName(storeName: string): string {
        const today = new Date();
        const date = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        const store = storeName ? storeName.trim().toLowerCase().replace(/\s+/g, '-') : 'pedidos';
        return `pedidos-${store}-${date}.pdf`;
    }

    private buildProductForSaleOrderContent(productForSaleOrder: ProductForSaleStoreOrder, option?: string): Content[] {
        let storeName = productForSaleOrder?.establishment?.name || productForSaleOrder?.productForSaleStoreOrderElements![0].productForSale?.establishment?.name!;
        let docTitle = option === "factory" ? "Pedido de Producto Terminado (Fabrica)" : "Pedido de Producto para Venta (Tienda)";
        let orderStatus = option === "factory" ? productForSaleOrder?.factoryStatus?.identifier : productForSaleOrder?.storeStatus?.identifier;
        let content: Content[] = [
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
                            //     text: `Pedido: ${this.rawMaterialOrder?.id}`,  
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
                            // El formato de fabrica no lleva precios ni totales
                            ...(option === "factory" ? [] : [
                                [{ text: 'Total', colSpan: 4 }, {}, {}, {}, Number(productForSaleOrder?.finalAmount!).toFixed(2)]
                            ])
                        ]
                    }
                },
                {
                    text: "Monto Total: " + this.dataService.getFormatedPriceWithSeparators(Number(productForSaleOrder?.finalAmount)),
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
                { text: "Actualizado: " + this.dataService.getLocalDateTimeFromUTCTime(productForSaleOrder?.updatedDate!) }, 
                {
                    text: 'Notas del pedido',
                    style: 'sectionHeader'
                },
                {
                      text: productForSaleOrder?.comment!,
                      margin: [0, 0 ,0, 15]
                },
                // {
                //     text: 'Codigo QR del pedido',
                //     style: 'sectionHeader'
                // },
                // {
                //     columns: [
                //         [{ qr: `https://embutidosany.store/productsForSale/order/view/${productForSaleOrder?.id}?opt=${option}&store=${productForSaleOrder.establishmentID}`, fit: 100 }],
                //         // [{ text: `https://embutidosany.store/productsForSale/order/view/${productForSaleOrder?._id}?opt=${option}&store=${productForSaleOrder.establishmentID}`, alignment: 'right', italics: true }],
                //     ]
                // },
            ];

        return content;
    }

    // ── Comprobante de venta ──────────────────────────────────────────────────

    /** Ruta del logo que se imprime en los documentos de cara al cliente. */
    private readonly brandLogoPath = 'assets/img/brand/embutidos_any_black.png';
    /** Cache del logo ya convertido: pdfmake no acepta rutas, sólo data URL. */
    private brandLogoDataUrl?: string;

    private async getBrandLogo(): Promise<string | undefined> {
        if (this.brandLogoDataUrl) return this.brandLogoDataUrl;
        try {
            const response = await fetch(this.brandLogoPath);
            if (!response.ok) return undefined;
            const blob = await response.blob();
            this.brandLogoDataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            return this.brandLogoDataUrl;
        } catch {
            // Sin logo el comprobante se genera igual; no vale romper la descarga.
            return undefined;
        }
    }

    /** Comprobante de venta para entregar al cliente. */
    async generateStoreSalePDF(storeSale: ShopResume) {
        const brand = '#ec5300';
        const muted = '#6b6b6b';
        const lineColor = '#e4e4e4';

        const store = storeSale?.establecimiento ?? storeSale?.establishment;
        const storeName = store?.name ?? '';

        const isOrderCredit = storeSale?.paymentType?.identifier === 'Crédito';
        const isDeliveryCredit = storeSale?.deliveryPaymentType?.identifier === 'Crédito';

        const total = Number(storeSale?.total || 0);
        const deliveryCost = Number(storeSale?.delivery || 0);
        const totalDiscount = Number(storeSale?.totalDiscount || 0);
        const subtotal = total - deliveryCost;
        const subtotalWithoutDiscount = subtotal + totalDiscount;

        // Sólo lo vendido al crédito genera saldo; si está todo pagado queda en 0.
        const totalPending = (isOrderCredit ? Number(storeSale?.pendingAmount || 0) : 0)
            + (isDeliveryCredit ? Number(storeSale?.deliveryPendingAmount || 0) : 0);
        const totalPaid = (isOrderCredit ? Number(storeSale?.paidAmount || 0) : 0)
            + (isDeliveryCredit ? Number(storeSale?.deliveryPaidAmount || 0) : 0);

        const statusText = storeSale?.status?.text ?? storeSale?.status?.identifier ?? '';
        const isCancelled = statusText.toLowerCase().includes('cancel');

        const money = (value: number) => this.dataService.getFormatedPriceWithSeparators(value);
        const dateText = (value?: string) => value ? this.dataService.getLocalDateTimeFromUTCTime(value) : '--';
        // Momento en que se generó el PDF, en la hora local de quien lo descarga.
        const documentDate = this.dataService.getLocalDateTimeFromUTCTime(new Date().toISOString());

        const logo = await this.getBrandLogo();

        const infoLabel = (text: string) => ({ text, fontSize: 8, bold: true, color: muted, margin: [0, 0, 0, 3] });
        const infoValue = (text: string) => ({ text, fontSize: 10, margin: [0, 0, 0, 2] });

        // El pago del envío sólo se detalla cuando efectivamente se cobró envío.
        const paymentText = deliveryCost > 0 && storeSale?.deliveryPaymentType
            ? `${storeSale?.paymentType?.identifier ?? '--'} (pedido) · ${storeSale.deliveryPaymentType.identifier ?? '--'} (envío)`
            : (storeSale?.paymentType?.identifier ?? '--');

        const content: any[] = [
            // Encabezado: logo + identificación del documento
            {
                columns: [
                    logo
                        ? { image: logo, width: 150 }
                        : { text: storeName, fontSize: 18, bold: true, color: brand },
                    {
                        width: '*',
                        stack: [
                            { text: 'COMPROBANTE DE VENTA', fontSize: 13, bold: true, color: brand, alignment: 'right' },
                            { text: storeSale?.saleNumber != null ? `No. ${storeSale.saleNumber}` : 'No. --', fontSize: 11, bold: true, alignment: 'right', margin: [0, 2, 0, 0] },
                            { text: dateText(storeSale?.creationDate), fontSize: 9, color: muted, alignment: 'right' },
                            { text: statusText || '--', fontSize: 9, color: isCancelled ? '#c0392b' : muted, alignment: 'right' }
                        ]
                    }
                ],
                columnGap: 10
            },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: brand }], margin: [0, 10, 0, 12] },

            // Cliente y datos de la venta
            {
                table: {
                    widths: ['50%', '50%'],
                    body: [[
                        {
                            fillColor: '#f7f7f7', margin: [10, 10, 10, 10], border: [false, false, false, false],
                            stack: [
                                infoLabel('CLIENTE'),
                                infoValue(storeSale?.nameClient || 'Público en General'),
                                { text: `NIT: ${storeSale?.nitClient || 'C/F'}`, fontSize: 9, color: muted }
                            ]
                        },
                        {
                            fillColor: '#f7f7f7', margin: [10, 10, 10, 10], border: [false, false, false, false],
                            stack: [
                                infoLabel('DATOS DE LA VENTA'),
                                infoValue(storeName || '--'),
                                { text: `Forma de pago: ${paymentText}`, fontSize: 9, color: muted, margin: [0, 2, 0, 0] }
                            ]
                        }
                    ]]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 18]
            },

            { text: 'DETALLE DE PRODUCTOS', fontSize: 9, bold: true, color: muted, margin: [0, 0, 0, 6] },

            // Productos
            {
                table: {
                    headerRows: 1,
                    widths: ['*', 'auto', 'auto', 'auto', 'auto'],
                    body: [
                        [
                            { text: 'Producto', style: 'v2TableHeader' },
                            { text: 'Cantidad', style: 'v2TableHeader', alignment: 'right' },
                            { text: 'Precio unitario', style: 'v2TableHeader', alignment: 'right' },
                            { text: 'Descuento', style: 'v2TableHeader', alignment: 'right' },
                            { text: 'Total', style: 'v2TableHeader', alignment: 'right' }
                        ],
                        ...(storeSale?.itemsList ?? []).map(p => ([
                            { text: p.productForSale?.finishedProduct?.name ?? '--', fontSize: 10 },
                            { text: `${p.quantity ?? '0'} ${p.measure?.identifier ?? ''}`.trim(), fontSize: 10, alignment: 'right' },
                            { text: money(Number(p.price || 0)), fontSize: 10, alignment: 'right' },
                            { text: Number(p.totalDiscount || 0) > 0 ? '-' + money(Number(p.totalDiscount)) : '--', fontSize: 10, alignment: 'right', color: Number(p.totalDiscount || 0) > 0 ? '#1e7e34' : muted },
                            { text: money(Number(p.total || 0)), fontSize: 10, alignment: 'right', bold: true }
                        ]))
                    ]
                },
                layout: {
                    hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.8 : 0.4,
                    vLineWidth: () => 0,
                    hLineColor: (i: number) => i === 1 ? brand : lineColor,
                    fillColor: (rowIndex: number) => (rowIndex > 0 && rowIndex % 2 === 0) ? '#fbfbfb' : null,
                    paddingTop: () => 6,
                    paddingBottom: () => 6
                },
                margin: [0, 0, 0, 14]
            },

            // Totales
            {
                columns: [
                    { width: '*', text: '' },
                    {
                        width: 240,
                        table: {
                            widths: ['*', 'auto'],
                            body: [
                                [{ text: 'Subtotal sin descuentos', fontSize: 10, color: muted, border: [false, false, false, false] },
                                 { text: money(subtotalWithoutDiscount), fontSize: 10, alignment: 'right', border: [false, false, false, false] }],
                                ...(totalDiscount > 0 ? [[
                                    { text: 'Descuento total', fontSize: 10, color: '#1e7e34', border: [false, false, false, false] },
                                    { text: '-' + money(totalDiscount), fontSize: 10, alignment: 'right', color: '#1e7e34', border: [false, false, false, false] }
                                ]] : []),
                                ...(deliveryCost > 0 ? [[
                                    { text: 'Costo de envío', fontSize: 10, color: muted, border: [false, false, false, false] },
                                    { text: money(deliveryCost), fontSize: 10, alignment: 'right', border: [false, false, false, false] }
                                ]] : []),
                                [{ text: 'TOTAL', fontSize: 13, bold: true, color: brand, margin: [0, 4, 0, 0], border: [false, true, false, false], borderColor: [lineColor, lineColor, lineColor, lineColor] },
                                 { text: money(total), fontSize: 13, bold: true, color: brand, alignment: 'right', margin: [0, 4, 0, 0], border: [false, true, false, false], borderColor: [lineColor, lineColor, lineColor, lineColor] }]
                            ]
                        },
                        layout: {
                            paddingTop: () => 3,
                            paddingBottom: () => 3,
                            paddingLeft: () => 0,
                            paddingRight: () => 0
                        }
                    }
                ],
                margin: [0, 0, 0, 16]
            },

            // Estado de pago: saldo en rojo o sello de pagado
            totalPending > 0
                ? {
                    table: {
                        widths: ['*'],
                        body: [[{
                            fillColor: '#fdecea', margin: [12, 10, 12, 10], border: [false, false, false, false],
                            stack: [
                                { text: 'SALDO PENDIENTE', fontSize: 8, bold: true, color: '#c0392b' },
                                {
                                    columns: [
                                        { text: 'Monto pendiente total', fontSize: 11, bold: true, color: '#c0392b', margin: [0, 4, 0, 0] },
                                        { text: money(totalPending), fontSize: 13, bold: true, color: '#c0392b', alignment: 'right', margin: [0, 2, 0, 0] }
                                    ]
                                },
                                ...(totalPaid > 0 ? [{ text: `Abonado a la fecha: ${money(totalPaid)}`, fontSize: 9, color: muted, margin: [0, 4, 0, 0] }] : [])
                            ]
                        }]]
                    },
                    layout: 'noBorders',
                    margin: [0, 0, 0, 16]
                }
                : {
                    table: {
                        widths: ['auto'],
                        body: [[{
                            text: 'PAGADO', fontSize: 12, bold: true, color: '#1e7e34',
                            fillColor: '#e8f5e9', margin: [16, 8, 16, 8], border: [false, false, false, false]
                        }]]
                    },
                    layout: 'noBorders',
                    margin: [0, 0, 0, 16]
                },

            // Notas — sólo si la venta trae una
            ...(storeSale?.nota ? [
                { text: 'NOTAS', fontSize: 9, bold: true, color: muted, margin: [0, 0, 0, 4] },
                { text: storeSale.nota, fontSize: 10, margin: [0, 0, 0, 10] }
            ] : [])
        ];

        const docDefinition: TDocumentDefinitions = {
            // A4 vertical, igual que el resto de documentos (es el default de pdfmake).
            // El ancho útil resultante es 515pt, que es el que usan las líneas del canvas.
            pageSize: 'A4',
            pageMargins: [40, 40, 40, 70],
            content: content,
            ...(isCancelled ? { watermark: { text: 'CANCELADA', color: '#c0392b', opacity: 0.15, bold: true } } : {}),
            footer: ((currentPage: number, pageCount: number) => ({
                margin: [40, 10, 40, 0],
                stack: [
                    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: lineColor }] },
                    {
                        columns: [
                            { text: `Documento creado: ${documentDate}`, fontSize: 7, color: muted },
                            { text: `Página ${currentPage} de ${pageCount}`, fontSize: 7, color: muted, alignment: 'right' }
                        ],
                        margin: [0, 5, 0, 0]
                    },
                    { text: 'Documento no fiscal', fontSize: 8, color: muted, alignment: 'center', margin: [0, 3, 0, 0] }
                ]
            })) as any,
            styles: {
                v2TableHeader: {
                    bold: true,
                    fontSize: 9,
                    color: '#ffffff',
                    fillColor: brand
                }
            }
        };

        pdfMake.createPdf(docDefinition).open();
    }

}