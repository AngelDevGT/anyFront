import { Injectable } from "@angular/core";
import { RawMaterialOrder } from "@app/models/raw-material/raw-material-order.model";
import { DataService, pfsFactoryOrderStatusValues, pfsStoreOrderStatusValues } from "../data/data.service";
import pdfMake from "pdfmake/build/pdfmake";  
import pdfFonts from "pdfmake/build/vfs_fonts";  
import { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { ProductForSaleStoreOrder } from "@app/models/product-for-sale/product-for-sale-store-order.model";
import { ShopResume } from "@app/models/store/shop-resume.model";
import { formatOperators } from "@app/helpers";
pdfMake.vfs = pdfFonts.pdfMake.vfs;

@Injectable({ providedIn: 'root' })
export class PdfService {

    // Acento azul para los pedidos: el naranja de marca es el del comprobante de venta y los dos
    // documentos se confundían al tenerlos juntos.
    private readonly pdfAccent = '#1f5fa8';
    private readonly pdfMuted = '#6b6b6b';
    private readonly pdfLine = '#e4e4e4';

    private readonly pdfStyles = {
        orderTableHeader: {
            bold: true,
            fontSize: 11,
            color: '#ffffff',
            fillColor: this.pdfAccent
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

    /**
     * Abre el PDF de un pedido en una pestaña nueva. `option` es 'factory' para el formato de
     * bodega (sin precios por línea, con datos de preparación); cualquier otro valor da el formato de tienda.
     */
    async generateProductForSaleOrderPDF(productForSaleOrder: ProductForSaleStoreOrder, option?: string) {
        // La pestaña se abre ANTES de esperar el logo: pasado el await el navegador ya no la
        // reconoce como respuesta al clic del usuario y la bloquea como ventana emergente.
        const win = window.open('', '_blank');
        if (win === null) throw new Error('Open PDF in new window blocked by browser');

        try {
            const logo = await this.getBrandLogo();
            const content = this.buildProductForSaleOrderContent(productForSaleOrder, option, logo);
            const docDefinition = this.buildOrderDocument(content, option, this.getOrderTerminalLabel(productForSaleOrder, option));
            pdfMake.createPdf(docDefinition).open({}, win);
        } catch (error) {
            win.close();
            throw error;
        }
    }

    /**
     * Genera un unico PDF con varios pedidos: cada pedido en su propia hoja.
     */
    async generateMultipleProductForSaleOrdersPDF(orders: ProductForSaleStoreOrder[], option?: string, storeName?: string) {
        const store = storeName || orders[0]?.establishment?.name || '';
        const logo = await this.getBrandLogo();

        let content: Content[] = [];

        // Un pedido por hoja
        orders.forEach((order, orderIndex) => {
            const orderContent = this.buildProductForSaleOrderContent(order, option, logo);
            orderContent.forEach((element: any, index: number) => {
                if (index === 0 && orderIndex > 0) element.pageBreak = 'before';
                content.push(element);
            });
        });

        // Sin marca de agua: es de todo el documento y marcaría también los pedidos vigentes.
        // El estado de cada pedido ya va en rojo en su encabezado.
        pdfMake.createPdf(this.buildOrderDocument(content, option)).download(this.getMultipleOrdersFileName(store));
    }

    private getMultipleOrdersFileName(storeName: string): string {
        const today = new Date();
        const date = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        const store = storeName ? storeName.trim().toLowerCase().replace(/\s+/g, '-') : 'pedidos';
        return `pedidos-${store}-${date}.pdf`;
    }

    /** Pedido que ya no está vigente, para marcarlo en rojo. Nada si sigue su curso normal. */
    private getOrderTerminalLabel(order: ProductForSaleStoreOrder, option?: string): string | undefined {
        const isFactory = option === 'factory';
        const statusId = isFactory ? order?.factoryStatus?.id : order?.storeStatus?.id;
        const values = isFactory ? pfsFactoryOrderStatusValues : pfsStoreOrderStatusValues;
        if (statusId == null) return undefined;
        if (statusId === values.cancelado.status.id) return 'CANCELADO';
        if (statusId === values.devuelto.status.id) return 'DEVUELTO';
        if (statusId === values.eliminado.status.id) return 'ELIMINADO';
        return undefined;
    }

    private buildOrderDocument(content: Content[], option?: string, watermark?: string): TDocumentDefinitions {
        const muted = this.pdfMuted;
        const line = this.pdfLine;
        const documentDate = this.dataService.getLocalDateTimeFromUTCTime(new Date().toISOString());

        return {
            pageSize: 'A4',
            pageMargins: [40, 40, 40, 80],
            content: content,
            ...(watermark ? { watermark: { text: watermark, color: '#c0392b', opacity: 0.15, bold: true } } : {}),
            footer: ((currentPage: number, pageCount: number) => ({
                margin: [40, 10, 40, 0],
                stack: [
                    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: line }] },
                    {
                        columns: [
                            { text: `Documento creado: ${documentDate}`, fontSize: 9, color: muted },
                            { text: `Página ${currentPage} de ${pageCount}`, fontSize: 9, color: muted, alignment: 'right' }
                        ],
                        margin: [0, 6, 0, 0]
                    },
                    // El formato de tienda lleva montos, y conviene aclarar que no es un documento fiscal
                    ...(option === 'factory' ? [] : [{ text: 'Documento no fiscal', fontSize: 10, color: muted, alignment: 'center', margin: [0, 4, 0, 0] }])
                ]
            })) as any,
            styles: this.pdfStyles
        };
    }

    private buildProductForSaleOrderContent(order: ProductForSaleStoreOrder, option?: string, logo?: string): Content[] {
        const isFactory = option === 'factory';
        const brand = this.pdfAccent;
        const muted = this.pdfMuted;
        const lineColor = this.pdfLine;

        const elements = order?.productForSaleStoreOrderElements ?? [];
        const storeName = order?.establishment?.name || elements[0]?.productForSale?.establishment?.name || '';
        const address = order?.establishment?.address;
        const statusText = (isFactory ? order?.factoryStatus?.identifier : order?.storeStatus?.identifier) || '--';
        const terminal = this.getOrderTerminalLabel(order, option);

        const dateText = (value?: string) => value ? this.dataService.getLocalDateTimeFromUTCTime(value) : '';
        const money = (value: number) => this.dataService.getFormatedPriceWithSeparators(value);
        // '--' es el marcador de "sin notas" que guarda la pantalla de creación
        const comment = order?.comment?.trim();
        const note = !comment || comment === '--' ? '' : comment;

        const infoLabel = (text: string) => ({ text, fontSize: 10, bold: true, color: muted, margin: [0, 0, 0, 4] });
        // Línea "Etiqueta: valor"; nada si no hay valor, en vez de imprimir un guion
        const field = (label: string, value?: string) => value
            ? [{ text: [{ text: `${label}: `, color: muted }, value], fontSize: 11, margin: [0, 0, 0, 2] }]
            : [];

        // Preparación: solo en el formato de bodega. Es información interna y la tienda no tiene por
        // qué ver quién le prepara el pedido, igual que en el listado y en el detalle.
        const verifiedBy = order?.verifiedUser?.name
            ? `${order.verifiedUser.name}${order.verifiedDate ? ' · ' + dateText(order.verifiedDate) : ''}`
            : '';
        const prepLeft = [
            ...field('Encargado', order?.assignedUser?.name),
            ...field('Operadores', formatOperators(order?.operators)),
            ...field('Verificado por', verifiedBy)
        ];
        const prepRight = [
            ...field('Inicio', dateText(order?.startDate)),
            ...field('Listo', dateText(order?.readyDate)),
            ...field('Entregado', dateText(order?.receivedDate))
        ];

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
                            { text: isFactory ? 'PEDIDO DE PRODUCTO TERMINADO' : 'PEDIDO DE PRODUCTO PARA VENTA', fontSize: 14, bold: true, color: brand, alignment: 'right' },
                            { text: order?.orderNumber != null ? `No. ${order.orderNumber}` : 'No. --', fontSize: 14, bold: true, alignment: 'right', margin: [0, 3, 0, 0] },
                            { text: dateText(order?.creationDate) || '--', fontSize: 11, color: muted, alignment: 'right' },
                            { text: terminal ?? statusText, fontSize: 11, bold: !!terminal, color: terminal ? '#c0392b' : muted, alignment: 'right' }
                        ]
                    }
                ],
                columnGap: 10
            },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: brand }], margin: [0, 10, 0, 12] },

            // Tienda y datos del pedido
            {
                table: {
                    widths: ['50%', '50%'],
                    body: [[
                        {
                            fillColor: '#f7f7f7', margin: [10, 10, 10, 10], border: [false, false, false, false],
                            stack: [
                                infoLabel('TIENDA'),
                                { text: storeName || '--', fontSize: 13, margin: [0, 0, 0, 3] },
                                ...(address ? [{ text: address, fontSize: 11, color: muted }] : [])
                            ]
                        },
                        {
                            fillColor: '#f7f7f7', margin: [10, 10, 10, 10], border: [false, false, false, false],
                            stack: [
                                infoLabel('DATOS DEL PEDIDO'),
                                ...field('Pedido', order?.name),
                                ...field('Creado por', order?.creatorUser?.name),
                                ...field('Creado', dateText(order?.creationDate)),
                                ...field('Actualizado', dateText(order?.updatedDate))
                            ]
                        }
                    ]]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, isFactory && (prepLeft.length || prepRight.length) ? 10 : 18]
            },

            ...(isFactory && (prepLeft.length || prepRight.length) ? [{
                table: {
                    widths: ['*'],
                    body: [[{
                        fillColor: '#f7f7f7', margin: [10, 10, 10, 10], border: [false, false, false, false],
                        stack: [
                            infoLabel('PREPARACIÓN'),
                            { columns: [{ width: '50%', stack: prepLeft }, { width: '50%', stack: prepRight }] }
                        ]
                    }]]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 18]
            }] : []),

            { text: 'DETALLE DE PRODUCTOS', fontSize: 11, bold: true, color: muted, margin: [0, 0, 0, 8] },

            // Productos: bodega no ve el precio de cada línea
            {
                table: {
                    headerRows: 1,
                    widths: isFactory ? ['*', 'auto', 'auto'] : ['*', 'auto', 'auto', 'auto', 'auto'],
                    body: [
                        isFactory
                            ? [
                                { text: 'Producto', style: 'orderTableHeader' },
                                { text: 'Medida', style: 'orderTableHeader' },
                                { text: 'Cantidad', style: 'orderTableHeader', alignment: 'right' }
                            ]
                            : [
                                { text: 'Producto', style: 'orderTableHeader' },
                                { text: 'Medida', style: 'orderTableHeader' },
                                { text: 'Cantidad', style: 'orderTableHeader', alignment: 'right' },
                                { text: 'Precio unitario', style: 'orderTableHeader', alignment: 'right' },
                                { text: 'Total', style: 'orderTableHeader', alignment: 'right' }
                            ],
                        ...elements.map(p => {
                            const name = { text: p.productForSale?.finishedProduct?.name ?? '--', fontSize: 12 };
                            const measure = { text: p.measure?.identifier ?? '', fontSize: 12 };
                            const quantity = { text: String(p.quantity ?? '0'), fontSize: 12, alignment: 'right' };
                            return isFactory
                                ? [name, measure, quantity]
                                : [
                                    name, measure, quantity,
                                    { text: money(Number(p.price || 0)), fontSize: 12, alignment: 'right' },
                                    { text: money(Number(p.totalPrice || 0)), fontSize: 12, alignment: 'right', bold: true }
                                ];
                        })
                    ]
                },
                layout: {
                    hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.8 : 0.4,
                    vLineWidth: () => 0,
                    hLineColor: (i: number) => i === 1 ? brand : lineColor,
                    fillColor: (rowIndex: number) => (rowIndex > 0 && rowIndex % 2 === 0) ? '#fbfbfb' : null,
                    paddingTop: () => 8,
                    paddingBottom: () => 8
                },
                margin: [0, 0, 0, 16]
            },

            // Total del pedido: lo llevan los dos formatos. El de bodega no detalla precios por línea,
            // pero el monto total sí se imprime.
            {
                columns: [
                    { width: '*', text: '' },
                    {
                        width: 290,
                        table: {
                            widths: ['*', 'auto'],
                            body: [[
                                { text: 'TOTAL', fontSize: 16, bold: true, color: brand, margin: [0, 5, 0, 0], border: [false, true, false, false], borderColor: [lineColor, lineColor, lineColor, lineColor] },
                                { text: money(Number(order?.finalAmount || 0)), fontSize: 16, bold: true, color: brand, alignment: 'right', margin: [0, 5, 0, 0], border: [false, true, false, false], borderColor: [lineColor, lineColor, lineColor, lineColor] }
                            ]]
                        },
                        layout: {
                            paddingTop: () => 4,
                            paddingBottom: () => 4,
                            paddingLeft: () => 0,
                            paddingRight: () => 0
                        }
                    }
                ],
                margin: [0, 0, 0, 18]
            },

            // Notas: solo si el pedido trae una
            ...(note ? [
                { text: 'NOTAS', fontSize: 11, bold: true, color: muted, margin: [0, 0, 0, 5] },
                { text: note, fontSize: 12, margin: [0, 0, 0, 12] }
            ] : [])
        ];

        return content as Content[];
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

        const infoLabel = (text: string) => ({ text, fontSize: 10, bold: true, color: muted, margin: [0, 0, 0, 4] });
        const infoValue = (text: string) => ({ text, fontSize: 13, margin: [0, 0, 0, 3] });

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
                            { text: 'COMPROBANTE DE VENTA', fontSize: 16, bold: true, color: brand, alignment: 'right' },
                            { text: storeSale?.saleNumber != null ? `No. ${storeSale.saleNumber}` : 'No. --', fontSize: 14, bold: true, alignment: 'right', margin: [0, 3, 0, 0] },
                            { text: dateText(storeSale?.creationDate), fontSize: 11, color: muted, alignment: 'right' },
                            { text: statusText || '--', fontSize: 11, color: isCancelled ? '#c0392b' : muted, alignment: 'right' }
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
                                { text: `NIT: ${storeSale?.nitClient || 'C/F'}`, fontSize: 11, color: muted }
                            ]
                        },
                        {
                            fillColor: '#f7f7f7', margin: [10, 10, 10, 10], border: [false, false, false, false],
                            stack: [
                                infoLabel('DATOS DE LA VENTA'),
                                infoValue(storeName || '--'),
                                { text: `Forma de pago: ${paymentText}`, fontSize: 11, color: muted, margin: [0, 3, 0, 0] }
                            ]
                        }
                    ]]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 18]
            },

            { text: 'DETALLE DE PRODUCTOS', fontSize: 11, bold: true, color: muted, margin: [0, 0, 0, 8] },

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
                            { text: p.productForSale?.finishedProduct?.name ?? '--', fontSize: 12 },
                            { text: `${p.quantity ?? '0'} ${p.measure?.identifier ?? ''}`.trim(), fontSize: 12, alignment: 'right' },
                            { text: money(Number(p.price || 0)), fontSize: 12, alignment: 'right' },
                            { text: Number(p.totalDiscount || 0) > 0 ? '-' + money(Number(p.totalDiscount)) : '--', fontSize: 12, alignment: 'right', color: Number(p.totalDiscount || 0) > 0 ? '#1e7e34' : muted },
                            { text: money(Number(p.total || 0)), fontSize: 12, alignment: 'right', bold: true }
                        ]))
                    ]
                },
                layout: {
                    hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.8 : 0.4,
                    vLineWidth: () => 0,
                    hLineColor: (i: number) => i === 1 ? brand : lineColor,
                    fillColor: (rowIndex: number) => (rowIndex > 0 && rowIndex % 2 === 0) ? '#fbfbfb' : null,
                    paddingTop: () => 8,
                    paddingBottom: () => 8
                },
                margin: [0, 0, 0, 16]
            },

            // Totales
            {
                columns: [
                    { width: '*', text: '' },
                    {
                        width: 290,
                        table: {
                            widths: ['*', 'auto'],
                            body: [
                                [{ text: 'Subtotal sin descuentos', fontSize: 12, color: muted, border: [false, false, false, false] },
                                 { text: money(subtotalWithoutDiscount), fontSize: 12, alignment: 'right', border: [false, false, false, false] }],
                                ...(totalDiscount > 0 ? [[
                                    { text: 'Descuento total', fontSize: 12, color: '#1e7e34', border: [false, false, false, false] },
                                    { text: '-' + money(totalDiscount), fontSize: 12, alignment: 'right', color: '#1e7e34', border: [false, false, false, false] }
                                ]] : []),
                                ...(deliveryCost > 0 ? [[
                                    { text: 'Costo de envío', fontSize: 12, color: muted, border: [false, false, false, false] },
                                    { text: money(deliveryCost), fontSize: 12, alignment: 'right', border: [false, false, false, false] }
                                ]] : []),
                                [{ text: 'TOTAL', fontSize: 16, bold: true, color: brand, margin: [0, 5, 0, 0], border: [false, true, false, false], borderColor: [lineColor, lineColor, lineColor, lineColor] },
                                 { text: money(total), fontSize: 16, bold: true, color: brand, alignment: 'right', margin: [0, 5, 0, 0], border: [false, true, false, false], borderColor: [lineColor, lineColor, lineColor, lineColor] }]
                            ]
                        },
                        layout: {
                            paddingTop: () => 4,
                            paddingBottom: () => 4,
                            paddingLeft: () => 0,
                            paddingRight: () => 0
                        }
                    }
                ],
                margin: [0, 0, 0, 18]
            },

            // Estado de pago: saldo en rojo o sello de pagado
            totalPending > 0
                ? {
                    table: {
                        widths: ['*'],
                        body: [[{
                            fillColor: '#fdecea', margin: [14, 12, 14, 12], border: [false, false, false, false],
                            stack: [
                                { text: 'SALDO PENDIENTE', fontSize: 10, bold: true, color: '#c0392b' },
                                {
                                    columns: [
                                        { text: 'Monto pendiente total', fontSize: 13, bold: true, color: '#c0392b', margin: [0, 5, 0, 0] },
                                        { text: money(totalPending), fontSize: 16, bold: true, color: '#c0392b', alignment: 'right', margin: [0, 3, 0, 0] }
                                    ]
                                },
                                ...(totalPaid > 0 ? [{ text: `Abonado a la fecha: ${money(totalPaid)}`, fontSize: 11, color: muted, margin: [0, 5, 0, 0] }] : [])
                            ]
                        }]]
                    },
                    layout: 'noBorders',
                    margin: [0, 0, 0, 18]
                }
                : {
                    table: {
                        widths: ['auto'],
                        body: [[{
                            text: 'PAGADO', fontSize: 15, bold: true, color: '#1e7e34',
                            fillColor: '#e8f5e9', margin: [18, 10, 18, 10], border: [false, false, false, false]
                        }]]
                    },
                    layout: 'noBorders',
                    margin: [0, 0, 0, 18]
                },

            // Notas — sólo si la venta trae una
            ...(storeSale?.nota ? [
                { text: 'NOTAS', fontSize: 11, bold: true, color: muted, margin: [0, 0, 0, 5] },
                { text: storeSale.nota, fontSize: 12, margin: [0, 0, 0, 12] }
            ] : [])
        ];

        const docDefinition: TDocumentDefinitions = {
            // A4 vertical, igual que el resto de documentos (es el default de pdfmake).
            // El ancho útil resultante es 515pt, que es el que usan las líneas del canvas.
            pageSize: 'A4',
            pageMargins: [40, 40, 40, 80],
            content: content,
            ...(isCancelled ? { watermark: { text: 'CANCELADA', color: '#c0392b', opacity: 0.15, bold: true } } : {}),
            footer: ((currentPage: number, pageCount: number) => ({
                margin: [40, 10, 40, 0],
                stack: [
                    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: lineColor }] },
                    {
                        columns: [
                            { text: `Documento creado: ${documentDate}`, fontSize: 9, color: muted },
                            { text: `Página ${currentPage} de ${pageCount}`, fontSize: 9, color: muted, alignment: 'right' }
                        ],
                        margin: [0, 6, 0, 0]
                    },
                    { text: 'Documento no fiscal', fontSize: 10, color: muted, alignment: 'center', margin: [0, 4, 0, 0] }
                ]
            })) as any,
            styles: {
                v2TableHeader: {
                    bold: true,
                    fontSize: 11,
                    color: '#ffffff',
                    fillColor: brand
                }
            }
        };

        pdfMake.createPdf(docDefinition).open();
    }

}