import { Component, OnInit } from '@angular/core';

import { AlertService, DataService} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Measure } from '@app/models';
import { UnitBase } from '@app/models/auxiliary/unit-base.model';
import { forkJoin } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ShopResume } from '@app/models/store/shop-resume.model';
import { Establishment } from '@app/models/establishment.model';

@Component({ 
    templateUrl: 'list-store-sales-pfs.component.html',
    styleUrls: ['list-store-sales-pfs.component.scss']
})
export class ListStoreSalesPFSComponent implements OnInit {

    establishment?: Establishment;
    submitting = false;
    storeName?: string;
    shopResumes?: ShopResume[];
    allShopResumes?: ShopResume[];
    selectedInventoryElement?: ShopResume;
    rawMaterialForm!: FormGroup;
    selectedMeasure?: Measure;
    elements: any = [];
    measureOptions?: Measure[];
    inventoryUnitBase?: UnitBase;
    currentMeasureQuantity = 0;
    filteredMeasureOptions?: Measure[];
    selectedQuantity = 0;
    formQuantity = 0;
    modalSelectedQuantity = 0;
    modalUnitBaseTotalQuantity = 0;
    searchTerm?: string;
    entries = [5, 10, 20, 50];
    pageSize = 5;
    page = 1;
    tableElementsValues?: any;

    constructor(private dataService: DataService, private route: ActivatedRoute, private alertService: AlertService, private router: Router) {}

    ngOnInit() {
        let establishmentId = this.route.snapshot.params['id'];
        let requestArray = [];

        requestArray.push(this.dataService.getShopHistory({establecimiento: { _id: establishmentId}}));
        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "measure", enableElements: "true"})); // measureRequest
        requestArray.push(this.dataService.getEstablishmentById(establishmentId));

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.shopResumes = result[0].retrieveShopHistoryResponse?.FinishedProducts;
                this.allShopResumes = this.shopResumes;
                this.measureOptions = result[1].retrieveCatalogGenericResponse.elements;
                this.establishment = result[2].getEstablishmentResponse.establishment;
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.shopResumes = this.shopResumes?.sort((a,b) => {
                    const fechaA = new Date(a.updateDate!);
                    const fechaB = new Date(b.updateDate!);
                    return fechaB.getTime() - fechaA.getTime();
                });
                this.setTableElements(this.shopResumes);
                this.storeName = this.establishment?.name;
            }
        });
        this.rawMaterialForm = this.createMaterialFormGroup();
    }

    search(value: any): void {
        if (this.allShopResumes){
            this.shopResumes = this.allShopResumes?.filter((val) => {
                if(this.searchTerm){
                    return true;
                    // const nameMatch = val.finishedProduct?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    // const measureMatch = val.finishedProduct?.measure?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());

                    // return nameMatch || measureMatch;
                }
                return true;
            });
        }
        this.setTableElements(this.shopResumes);
    }

    setTableElements(elements?: ShopResume[]){
        // Filtrar para mostrar solo elementos activos
        elements = elements?.filter(element => element.status?.id !== 8);
        this.tableElementsValues = [];
        elements?.forEach((element: ShopResume) => {
            const curr_row = [
                    { type: "text", value: this.dataService.getLocalDateFromUTCTime(element.updateDate!), header_name: "Fecha", style: "width: 10%" },
                    // { type: "text", value: element.establecimiento?.name, header_name: "Tienda", style: "width: 15%" },
                    // { type: "text", value: element.totalDiscount, header_name: "Descuento" },
                    // { type: "text", value: Number(element.total) - Number(element.totalDiscount), header_name: "Subtotal" },
                    { type: "text", value: element.itemsList?.map(item => " " + item.productForSale?.finishedProduct?.name), header_name: "Productos", style: "width: 30%" },
                    { type: "text", value: this.dataService.getFormatedPrice(Number(element.total)), header_name: "Monto Total", style: "width: 15%" },
                    { type: "text", value: element.nameClient ? element.nameClient : "--", header_name: "Cliente", style: "width: 10%" },
                    { type: "text", value: element.nota ? element.nota : "--", header_name: "Notas", style: "width: 20%" },
            ];

            let actionsButtons = [
                {
                    type: "button",
                    routerLink: "/store/sales/history/view/" + element._id,
                    is_absolute: true,
                    class: "btn btn-success btn-sm pb-0 mx-1",
                    icon: {
                        class: "material-icons",
                        icon: "visibility"
                    }
                }
            ];

            let rowButtons = {
                type: "button",
                style: "white-space: nowrap; width: 10%",
                value: undefined,
                header_name: "Acciones",
                button: [
                    ...actionsButtons
                ]
            }

            curr_row.push(rowButtons);

            this.tableElementsValues.push(curr_row);
        });
    }

    get r() {
        return this.rawMaterialForm.controls;
    }

    selectMeasure(measureId?: string){
        return this.measureOptions?.find(measure => String(measure.id) === measureId);
    }

    get quantityInput(){
        return this.rawMaterialForm.get('quantity');
    }

    get measureSelect(){
        return this.rawMaterialForm.get('measure');
    }

    closeRawMaterialDialog(){
        this.onResetMaterialForm();
    }

    onResetMaterialForm(){
        this.rawMaterialForm.reset();
        this.selectedInventoryElement = undefined;
        this.selectedMeasure = undefined;
        this.currentMeasureQuantity = 0;
        this.formQuantity = 0;
        this.modalSelectedQuantity = 0;
        this.modalUnitBaseTotalQuantity = 0;
        this.elements = [];
    }

    createMaterialFormGroup() {
        return new FormGroup({
            quantity: new FormControl('', [Validators.required, Validators.pattern(/^\d+$/)]),
            measure: new FormControl('', [Validators.required])
        });
    }

    saveSale(){
        let saveSalePath = '/store/sales/create';
        let queryParams = {
            strId: this.establishment?._id
        };
        this.router.navigate([saveSalePath], { queryParams: queryParams});
    }

}