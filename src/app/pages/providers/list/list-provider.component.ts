import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import {map, startWith} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';

import { AccountService, AlertService, DataService} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { BehaviorSubject, Observable } from 'rxjs';
import { Provider } from '@app/models/system/provider.model';

@Component({ 
    templateUrl: 'list-provider.component.html',
    styleUrls: ['list-provider.component.scss']
})
export class ListProviderComponent implements OnInit {
    providers?: Provider[];
    allProviders?: Provider[];
    searchTerm?: string;
    page = 1;
    isDeleting = false;
    entries = [5, 10, 20, 50];
    pageSize = 5;
    tableElementsValues?: any;
    tableHeaders = [
        {
            style: "width: 15%",
            name: "Nombre"
        },
        {
            style: "width: 15%",
            name: "Telefono"
        },
        {
            style: "width: 15%",
            name: "Empresa"
        },
        {
            style: "width: 40%",
            name: "Descripcion"
        },
        {
            style: "width: 15%",
            name: "Acciones"
        }
    ];

    constructor(private dataService: DataService, private alertService: AlertService) {}

    ngOnInit() {
        this.retriveProviders();
    }

    retriveProviders(){
        this.providers = undefined;
        this.dataService.getAllProvidersByFilter({"status": { "id": 2}})
            .pipe(first())
            .subscribe({
                next: (providers: any) => {
                    this.providers = providers.retrieveProviderResponse?.providers;
                    this.allProviders = this.providers;
                    this.setTableElements(this.providers);
                }
            });
    }

    search(value: any): void {
        if (this.providers){
            this.providers = this.allProviders?.filter((val) => {
                if(this.searchTerm){
                    const nameMatch = val.name!.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const companyMatch = val.company!.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const descriptionMatch = val.description!.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return nameMatch || companyMatch || descriptionMatch;
                }
                return true;
            });
        };
        this.setTableElements(this.providers);
    }

    setTableElements(elements: any){
        this.tableElementsValues = {
            headers: this.tableHeaders,
            rows: []
        }
        elements?.forEach((provider: any) => {
            const curr_row = {
                row: [
                    { type: "text", value: provider.name, header_name: "Nombre" },
                    { type: "text", value: provider.phone, header_name: "Telefono" },
                    { type: "text", value: provider.company, header_name: "Empresa" },
                    { type: "text", value: provider.description, header_name: "Descripcion" },
                    {
                        type: "button",
                        style: "white-space: nowrap",
                        button: [
                            {
                                type: "button",
                                routerLink: "view/" + provider._id,
                                class: "btn btn-success btn-sm pb-0 mx-1",
                                icon: {
                                    class: "material-icons",
                                    icon: "visibility"
                                }
                            },
                            {
                                type: "button",
                                routerLink: "edit/" + provider._id,
                                class: "btn btn-primary btn-sm pb-0 mx-1",
                                icon: {
                                    class: "material-icons",
                                    icon: "edit"
                                }
                            }
                        ]
                    }
                  ],
            }
            this.tableElementsValues.rows.push(curr_row);
        });
    }

}