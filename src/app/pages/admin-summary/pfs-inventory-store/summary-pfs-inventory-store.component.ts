import { Component, OnInit } from '@angular/core';
import { ngxCsv } from 'ngx-csv';

import { AlertService, DataService } from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Establishment } from '@app/models/establishment.model';
import { forkJoin } from 'rxjs';
import { InventoryElement } from '@app/models/inventory/inventory-element.model';
import { Inventory } from '@app/models/inventory/inventory.model';

@Component({
    templateUrl: 'summary-pfs-inventory-store.component.html',
    styleUrls: ['summary-pfs-inventory-store.component.scss']
})
export class SummaryProductForSaleInventoryFactoryComponent implements OnInit {
    inventoryElements?: InventoryElement[];
    allInventoryElements?: InventoryElement[];
    establishmentOptions?: Establishment[];
    productForm!: FormGroup;
    maxDate: Date = new Date();
    searchTerm?: string;
    entries = this.dataService.tableEntries;
    pageSize = this.dataService.defaultPageSize;
    page = 1;
    tableElementsValues?: any;

    constructor(private dataService: DataService, private alertService: AlertService) {}

    ngOnInit() {
        this.productForm = this.createFormGroup();
        this.retriveInventoryElements();
    }

    retriveInventoryElements() {
        this.inventoryElements = undefined;

        const requestArray = [
            this.dataService.getInventoryByType({inventory_type: "product_for_sale"}, 'retrieveAllProductForSaleInventoryV2'),
            this.dataService.getAnyComponent({s: {id: 28}}, 'retrieveEstablishments')
        ];

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                const inventories: Inventory[] = this.dataService.findJsonValue(result[0], 'json_result') || [];
                this.establishmentOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];

                this.allInventoryElements = inventories.flatMap(inv =>
                    (inv.inventoryElements || []).map(el => ({ ...el, establishment: inv.establishment }))
                );
            },
            error: (e) => console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.inventoryElements = this.allInventoryElements;
                this.setTableElements(this.inventoryElements);
            }
        });
    }

    search(value: any): void {
        if (this.allInventoryElements) {
            this.inventoryElements = this.allInventoryElements.filter(val => {
                if (this.searchTerm) {
                    const nameMatch = val.productForSale?.finishedProduct?.name?.toLowerCase().includes(this.searchTerm.toLocaleLowerCase());
                    const measureMatch = val.measure?.identifier?.toLowerCase().includes(this.searchTerm.toLocaleLowerCase());
                    const establishmentMatch = val.establishment?.name?.toLowerCase().includes(this.searchTerm.toLocaleLowerCase());
                    return nameMatch || measureMatch || establishmentMatch;
                }
                return true;
            });
        }
        this.setTableElements(this.inventoryElements);
    }

    setTableElements(elements?: InventoryElement[]) {
        this.tableElementsValues = [];
        elements?.forEach((element: InventoryElement) => {
            const curr_row = [
                { type: "text", value: element.productForSale?.finishedProduct?.name, header_name: "Producto" },
                { type: "text", value: element.establishment?.name, header_name: "Tienda" },
                { type: "text", value: "Activo", header_name: "Estado" },
                { type: "text", value: element.measure?.identifier, header_name: "Medida" },
                { type: "text", value: this.dataService.getFormatedPrice(Number(element.productForSale?.price)), header_name: "Precio" },
                { type: "text", value: element.quantity, header_name: "Cantidad" }
            ];
            this.tableElementsValues.push(curr_row);
        });
    }

    createFormGroup() {
        return new FormGroup({
            establishment: new FormControl('', [Validators.maxLength(45)])
        });
    }

    filterElements() {
        const filters = this.productForm.value;
        if (this.allInventoryElements) {
            this.inventoryElements = this.allInventoryElements.filter(val =>
                filters.establishment === "" || val.establishment?.id === filters.establishment
            );
        }
        this.setTableElements(this.inventoryElements);
    }

    exportDataToCsv() {
        const finalCsvValues = this.inventoryElements?.map(element => ({
            Nombre: element.productForSale?.finishedProduct?.name,
            Tienda: element.establishment?.name,
            Estado: "Activo",
            Medida: element.measure?.identifier,
            Cantidad: element.quantity
        }));
        const csvOptions = {
            fieldSeparator: ',',
            quoteStrings: '"',
            decimalseparator: '.',
            showLabels: true,
            headers: ["Nombre", "Tienda", "Estado", "Medida", "Cantidad"]
        };
        new ngxCsv(finalCsvValues, "Resumen_inventario_pfs_tienda_" + this.maxDate.getTime(), csvOptions);
    }
}
