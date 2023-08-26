import { Component, OnInit} from '@angular/core';
import { first } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { Establishment } from '@app/models/establishment.model';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';

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
    tableHeaders = [
        {
            style: "width: 20%",
            name: "Nombre"
        },
        {
            style: "width: 10%",
            name: "Medida"
        },
        {
            style: "width: 10%",
            name: "Cantidad"
        },
        {
            style: "width: 15%",
            name: "Precio"
        },
        {
            style: "width: 15%",
            name: "Descuento"
        },
        {
            style: "width: 15%",
            name: "Medida Base"
        },
        {
            style: "width: 15%",
            name: "Cantidad Base"
        }
    ];

    constructor(private dataService: DataService, private alertService: AlertService,
        private route: ActivatedRoute, private router: Router) {
    }

    ngOnInit(): void {
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
        this.elements.push({icon : "credit_card", name : "Tipo de pago", value : rmOrder.paymentType?.identifier});
        this.elements.push({icon : "task_alt", name : "Estado de pago", value : rmOrder.paymentStatus?.identifier});
        // this.elements.push({icon : "shopping_cart", name : "Monto total", value : this.dataService.getFormatedPrice(Number(rmOrder.finalAmount))});
        // this.elements.push({icon : "production_quantity_limits", name : "Monto pendiente", value : this.dataService.getFormatedPrice(Number(rmOrder.pendingAmount))});
        this.elements.push({icon : "info", name : "Estado", value : rmOrder.status?.identifier});
        this.elements.push({icon : "calendar_today", name : "Fecha Creación", value : this.dataService.getLocalDateTimeFromUTCTime(rmOrder.creationDate!)});
        this.elements.push({icon : "calendar_today", name : "Fecha Actualización", value : this.dataService.getLocalDateTimeFromUTCTime(rmOrder.updateDate!.replaceAll("\"",""))});
        this.elements.push({icon : "badge", name : "Usuario Creador", value : "Pendiente..."});
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
                    { type: "text", value: element.measure.identifier, header_name: "Medida" },
                    { type: "text", value: element.quantity, header_name: "Cantidad" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.price)), header_name: "Precio" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.discount)), header_name: "Descuento" },
                    { type: "text", value: element.measure.unitBase.name, header_name: "Medida Base" },
                    { type: "text", value: element.measure.unitBase.quantity, header_name: "Cantidad Base" },
                  ],
            }
            this.tableElementsValues.rows.push(curr_row);
        });
    }



}