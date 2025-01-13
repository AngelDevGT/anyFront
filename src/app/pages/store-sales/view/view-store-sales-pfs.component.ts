import { Component, OnInit} from '@angular/core';
import { concatMap, first } from 'rxjs/operators';

import { AlertService, DataService, PdfService } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { Provider } from '@app/models/system/provider.model';
import { ShopResume } from '@app/models/store/shop-resume.model';
import { ItemsList } from '@app/models/store/item-list.model';
import { ActivityLog } from '@app/models/system/activity-log';

@Component({ 
    selector: 'page-view-store-sales-pfs',
    templateUrl: 'view-store-sales-pfs.component.html',
    styleUrls: ['view-store-sales-pfs.component.scss']
})
export class ViewStoreSalesPFSComponent implements OnInit{

    id?: string;
    shopResume?: ShopResume;
    tableElementsValues?: any;
    submitting = false;
    loading = false;
    pageSize = 5;
    elements: any = [];
    deleteOption = false;
    activityLogName = "Acciones de Producto para Venta en tienda";

    constructor(private dataService: DataService, private alertService: AlertService,
        private route: ActivatedRoute, private pdfService: PdfService, private router: Router) {
    }

    ngOnInit(): void {
        this.id = this.route.snapshot.params['id'];

        this.loading = true;

        if (this.id){
            this.dataService.getShopHistory({_id: this.id})
                .pipe(first())
                .subscribe((shopResumRes: any) => {
                    let shopRes = shopResumRes.retrieveShopHistoryResponse?.FinishedProducts;
                    if (shopRes[0]){
                        this.shopResume = shopRes[0];
                        if(this.shopResume?.status?.id === 3){
                            this.deleteOption = true;
                        }
                        this.setElements(this.shopResume);
                        this.activityLogName = this.activityLogName + "|||" + this.shopResume?.establecimiento?._id;
                        this.loading = false;
                    }
                });
        }
    }


    deleteSale() {
        this.submitting = true;
        this.dataService.deleteShopHistory(this.shopResume)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Venta eliminado', { keepAfterRouteChange: true });
                this.router.navigateByUrl('/store/sales/history/' + this.shopResume?.establecimiento?._id);
                },
                error: error => {
                    this.alertService.error('Error al eliminar la venta, contacte con Administracion');
                }});
    }

    cancelSale() {
        let activityLog: ActivityLog = {
            action: "cancel",
            section: this.activityLogName,
            description: "Cancelacion de venta de producto en tienda '" + this.shopResume?.itemsList?.map((item: ItemsList) => item.productForSale?.finishedProduct?.name).join(", ") + "'",
            extra: {
                reason: "Cancelacion de venta de producto en tienda",
            },
            request: this.shopResume
        }
        this.submitting = true;
        this.dataService.cancelShop({
            "inventoryID": "65bf467e008f7e88678d3927",
            "RegisterShop": {
                "_id": this.shopResume?._id,
            }
        })
            .pipe(concatMap((result: any) => {
                        activityLog.response = result;
                        activityLog.status = result.cancelShopRegisterResponse.AcknowledgementIndicator;
                        return this.dataService.addActivityLog(activityLog);
                }))
            .subscribe({
                next: () => {
                this.alertService.success('Venta cancelada', { keepAfterRouteChange: true });
                this.router.navigateByUrl('/store/sales/history/' + this.shopResume?.establecimiento?._id);
                },
                error: error => {
                    this.alertService.error('Error al eliminar la venta, contacte con Administracion');
                }});
    }

    editSale() {
        this.router.navigateByUrl('/store/sales/history/edit/' + this.id);
    }

    setElements(shopResume?: ShopResume){
        // this.elements.push({icon : "store", name : "Tienda", value : shopResume?.establecimiento?.name});
        this.elements.push({icon : "person", name : "Cliente", value : shopResume?.nameClient ? shopResume?.nameClient : "--"});
        this.elements.push({icon : "tag", name : "NIT", value : shopResume?.nitClient ? shopResume?.nitClient : "--"});
        this.elements.push({icon : "feed", name : "Notas", value : shopResume?.nota ? shopResume?.nota : "--"});
        // this.elements.push({icon : "credit_card", name : "Tipo de pago", value : shopResume?.paymentType?.identifier});
        this.elements.push({icon : "info", name : "Estado", value : shopResume?.status?.identifier});
        this.elements.push({icon : "calendar_today", name : "Fecha Creación", value : this.dataService.getLocalDateTimeFromUTCTime(shopResume!.creationDate!.replaceAll("\"",""))});
        this.elements.push({icon : "calendar_today", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(shopResume!.updateDate!.replaceAll("\"",""))});
        this.elements.push({icon : "badge", name : "Vendido por", value : shopResume?.creatorUser?.name});
        this.setTableElements(shopResume?.itemsList);
    }

    setTableElements(elements?: ItemsList[]){
        this.tableElementsValues = [];
        elements?.forEach((element: ItemsList) => {
            let curr_row = [
                    { type: "text", value: element.productForSale?.finishedProduct?.name, header_name: "Nombre" },
                    // { type: "text", value: element.rawMaterialOrderElements.length, header_name: "Cantidad" },
                    { type: "text", value: element.measure?.identifier, header_name: "Medida" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.price)), header_name: "Precio" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.discount)), header_name: "Descuento" },
                    { type: "text", value: element.quantity, header_name: "Cantidad" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.totalDiscount)), header_name: "Descuento Total" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.total)), header_name: "Total" },
                    // { type: "text", value: element.measure.unitBase.name, header_name: "Medida Base" },
                    // { type: "text", value: element.measure.unitBase.quantity, header_name: "Cantidad Base" },
            ];
            this.tableElementsValues.push(curr_row);
        });
    }

    getSubTotal(){
        return Number(this.shopResume?.total || 0) - Number(this.shopResume?.delivery || 0);
    }

    getSubTotalWithoutDiscount(){
        return Number(this.shopResume?.total || 0) + Number(this.shopResume?.totalDiscount) - Number(this.shopResume?.delivery || 0);
    }

    generatePDF() {  
        this.pdfService.generateStoreSalePDF(this.shopResume!);
    }

}