import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup } from '@angular/forms';
import { DataService } from '@app/services';
import { ShopResume } from '@app/models/store/shop-resume.model';

interface EstablishmentSummary {
    id: string;
    name: string;
    salesCount: number;
    total: number;
    totalDiscount: number;
}

const CANCELLED_STATUS_ID = 8;

@Component({
    templateUrl: 'summary-store-sales.component.html',
    styleUrls: ['summary-store-sales.component.scss'],
    providers: [DatePipe]
})
export class SummaryStoreSalesComponent implements OnInit {

    sales?: ShopResume[];
    summaryByEstablishment: EstablishmentSummary[] = [];
    grandTotal = 0;
    grandTotalDiscount = 0;
    grandTotalSales = 0;
    dateRange?: string;
    maxDate: Date = new Date();
    filterForm!: FormGroup;
    tableElementsValues?: any;
    entries = this.dataService.tableEntries;
    pageSize = this.dataService.defaultPageSize;

    constructor(public dataService: DataService, private datePipe: DatePipe) {}

    ngOnInit() {
        this.filterForm = this.createFormGroup();
        this.loadSales();
    }

    loadSales(startDate?: string, endDate?: string) {
        const nowObject = new Date();
        let startDateObject = new Date(nowObject.getFullYear(), nowObject.getMonth(), 1, 0, 0, 0, 0);
        let endDateObject = nowObject;

        if (startDate && endDate) {
            startDateObject = new Date(startDate);
            endDateObject = new Date(endDate);
            endDateObject.setHours(23, 59, 59, 999);
        }

        const formattedStart = this.datePipe.transform(startDateObject, 'yyyy-MM-dd HH:mm:ss', 'UTC');
        const formattedEnd = this.datePipe.transform(endDateObject, 'yyyy-MM-dd HH:mm:ss', 'UTC');

        const startLabel = startDateObject.toLocaleDateString('es-GT');
        const endLabel = endDateObject.toLocaleDateString('es-GT');
        this.dateRange = `${startLabel} - ${endLabel}`;

        const params = JSON.stringify({
            ss: {
                'creation_date$gte': formattedStart,
                'creation_date$lte': formattedEnd
            },
            s: {
                name: "Activo"
            }
        });

        this.sales = undefined;
        this.tableElementsValues = undefined;

        this.dataService.getShopSaleSummary(params).subscribe({
            next: (result: any) => {
                const raw: ShopResume[] = this.dataService.findJsonValue(result, 'json_result') || [];
                this.sales = raw.filter(s => s.status?.id !== CANCELLED_STATUS_ID);
            },
            error: (e) => console.error(e),
            complete: () => {
                this.buildSummary();
            }
        });
    }

    buildSummary() {
        const map = new Map<string, EstablishmentSummary>();

        this.sales?.forEach(sale => {
            const id = sale.establishment?.id ?? 'unknown';
            const name = sale.establishment?.name ?? 'Sin tienda';
            const total = Number(sale.total ?? 0);
            const discount = Number(sale.totalDiscount ?? 0);

            if (!map.has(id)) {
                map.set(id, { id, name, salesCount: 0, total: 0, totalDiscount: 0 });
            }
            const entry = map.get(id)!;
            entry.salesCount++;
            entry.total += total;
            entry.totalDiscount += discount;
        });

        this.summaryByEstablishment = Array.from(map.values()).sort((a, b) => b.total - a.total);
        this.grandTotal = this.summaryByEstablishment.reduce((acc, e) => acc + e.total, 0);
        this.grandTotalDiscount = this.summaryByEstablishment.reduce((acc, e) => acc + e.totalDiscount, 0);
        this.grandTotalSales = this.summaryByEstablishment.reduce((acc, e) => acc + e.salesCount, 0);

        this.setTableElements();
    }

    setTableElements() {
        this.tableElementsValues = [];
        this.summaryByEstablishment.forEach(entry => {
            const row = [
                { type: 'text', value: entry.name, header_name: 'Tienda', style: 'width: 35%' },
                { type: 'text', value: entry.salesCount, header_name: 'Ventas', style: 'width: 15%' },
                { type: 'text', value: this.dataService.getFormatedPriceWithSeparators(entry.total), header_name: 'Monto Total', style: 'width: 25%' },
                { type: 'text', value: this.dataService.getFormatedPriceWithSeparators(entry.totalDiscount), header_name: 'Descuento Total', style: 'width: 25%' },
            ];
            this.tableElementsValues.push(row);
        });
    }

    filterElements() {
        const { startDate, endDate } = this.filterForm.value;
        this.loadSales(startDate, endDate);
    }

    createFormGroup() {
        return new FormGroup({
            startDate: new FormControl(''),
            endDate: new FormControl('')
        });
    }
}