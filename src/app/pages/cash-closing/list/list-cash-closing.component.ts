import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';

import { AlertService, DataService, deleteStatus} from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { CashClosing } from '@app/models/store/cash-closing.model';

@Component({ 
    templateUrl: 'list-cash-closing.component.html',
    styleUrls: ['list-cash-closing.component.scss']
})
export class ListCashClosingComponent implements OnInit {
    cashClosings?: CashClosing[];
    allCashClosings?: CashClosing[];
    searchTerm?: string;
    entries = [5, 10, 20, 50];
    pageSize = 5;
    page = 1;
    title = '';
    tableElementsValues?: any;
    establishmentId?: string;

    constructor(private dataService: DataService, private router: Router, private route: ActivatedRoute,private alertService: AlertService) {}

    ngOnInit() {
        this.establishmentId = this.route.snapshot.params['id'];

        this.title = 'Cierres de caja';

        this.retriveCashClosing();
    }

    retriveCashClosing(){
        this.cashClosings = undefined;
        this.dataService.getAllCashClosingV2ByFilter({storeID: this.establishmentId})
            .pipe(first())
            .subscribe({
                next: (cashClosings: any) => {
                    this.cashClosings = cashClosings.retrieveStoreCashClosingResponse?.StoreCashClosing;
                    this.cashClosings = this.cashClosings?.sort((a,b) => {
                        const fechaA = new Date(a.creationDate!);
                        const fechaB = new Date(b.creationDate!);
                        return fechaB.getTime() - fechaA.getTime();
                    });
                    this.allCashClosings = this.cashClosings;
                    this.setTableElements(this.cashClosings || []);
                }
            });
    }

    search(value: any): void {
        if (this.allCashClosings){
            this.cashClosings = this.allCashClosings?.filter((val) => {
                if(this.searchTerm){
                    const dateMatch = val.creationDate?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const personInChargeMatch = val.userRequest?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const statusMatch = val.status?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return dateMatch || personInChargeMatch || statusMatch;
                }
                return true;
            });
        }
        this.setTableElements(this.cashClosings || []);
    }

    setTableElements(elements: CashClosing[]){
        this.tableElementsValues = [];
        elements?.forEach((element: CashClosing) => {
            if(element.status?.id === deleteStatus.status.id) return;
            let buttonsRow = {};
            buttonsRow = {
                type: "button_text_icon",
                style: "white-space: nowrap",
                header_name: "Acciones",
                button: [
                    {
                        type: "button",
                        routerLink: "/cashClosing/view/" + element._id,
                        query_params: { store: this.establishmentId },
                        is_absolute: true,
                        class: "btn btn-success btn-sm mx-1",
                        icon: {
                            class: "material-icons",
                            icon: "visibility"
                        }
                    }
                ]
            };
            const curr_row = [
                    { type: "text", value: this.dataService.getLocalDateTimeFromUTCTime(element.creationDate!), header_name: "Fecha"},
                    { type: "text", value: element.note, header_name: "Notas" },
                    { type: "text", value: element.userRequest?.name, header_name: "Persona a cargo" },
                    { type: "text", value: element.status?.identifier, header_name: "Cierre de caja" },
                    buttonsRow
            ]
            this.tableElementsValues.push(curr_row);
        });
    }

    createCashClosing(){
        this.router.navigate(['/cashClosing/create/0'], {
            queryParams: {
                store: this.establishmentId
            }
        });
    }

}