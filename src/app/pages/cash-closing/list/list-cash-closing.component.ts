import { Component, OnInit } from '@angular/core';
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
    pageSize = this.dataService.defaultPageSize;
    title = '';
    tableElementsValues?: any;
    establishmentId?: string;
    availableStatuses: string[] = [];
    statusFilter: string | null = null;

    constructor(private dataService: DataService, private router: Router, private route: ActivatedRoute, private alertService: AlertService) {}

    ngOnInit() {
        this.establishmentId = this.route.snapshot.params['id'];
        this.title = 'Cierres de caja';
        this.retriveCashClosing();
    }

    retriveCashClosing() {
        this.cashClosings = undefined;
        this.dataService.listCashClosingByFilter({establishment_id: this.establishmentId})
            .pipe(first())
            .subscribe({
                next: (cashClosings: any) => {
                    this.cashClosings = this.dataService.findJsonValue(cashClosings, 'json_result') || [];
                    this.cashClosings = this.cashClosings?.sort((a, b) =>
                        new Date(b.creationDate!).getTime() - new Date(a.creationDate!).getTime()
                    );
                    this.allCashClosings = this.cashClosings;
                    this.availableStatuses = [...new Set(
                        (this.allCashClosings || []).map(e => e.status?.identifier).filter((s): s is string => !!s)
                    )];
                    this.setTableElements(this.cashClosings || []);
                }
            });
    }

    filterByStatus(status: string | null) {
        this.statusFilter = status;
        this.search(null);
    }

    search(value: any): void {
        if (this.allCashClosings) {
            this.cashClosings = this.allCashClosings.filter((val) => {
                const textMatch = !this.searchTerm ||
                    val.creationDate?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                    val.userRequest?.name?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                    val.status?.identifier?.toLowerCase().includes(this.searchTerm.toLowerCase());
                const statusMatch = !this.statusFilter || val.status?.identifier === this.statusFilter;
                return textMatch && statusMatch;
            });
        }
        this.setTableElements(this.cashClosings || []);
    }

    setTableElements(elements: CashClosing[]) {
        this.tableElementsValues = [];
        elements?.forEach((element: CashClosing) => {
            if (element.status?.id === deleteStatus.status.id) return;
            const curr_row = [
                { type: 'text', value: this.dataService.getLocalDateTimeFromUTCTime(element.creationDate!), header_name: 'Fecha' },
                { type: 'text', value: element.note, header_name: 'Notas' },
                { type: 'text', value: element.userRequest?.name, header_name: 'Persona a cargo' },
                {
                    type: 'badge',
                    value: element.status?.text || element.status?.identifier,
                    identifier: element.status?.identifier?.toLowerCase(),
                    bg_color: element.status?.bg_color,
                    color: element.status?.color,
                    header_name: 'Estado'
                },
                {
                    type: 'button',
                    header_name: 'Acciones',
                    button: [
                        {
                            type: 'button',
                            routerLink: '/cashClosing/view/' + element.id,
                            query_params: { store: this.establishmentId },
                            is_absolute: true,
                            colorClass: 'dt-btn-view',
                            icon: { class: 'material-icons', icon: 'visibility' }
                        }
                    ]
                }
            ];
            this.tableElementsValues.push(curr_row);
        });
    }

    createCashClosing() {
        this.router.navigate(['/cashClosing/create/0'], { queryParams: { store: this.establishmentId } });
    }
}
