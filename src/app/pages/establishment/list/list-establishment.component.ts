import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import {map, startWith} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';

import { AccountService, AlertService, DataService} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Establishment } from '@app/models/establishment.model';
import { ActivatedRoute } from '@angular/router';

@Component({ 
    templateUrl: 'list-establishment.component.html',
    styleUrls: ['list-establishment.component.scss']
})
export class ListEstablishmentComponent implements OnInit {
    establishments?: Establishment[];
    allEstablishments?: Establishment[];
    searchTerm?: string;
    entries = [5, 10, 20, 50];
    pageSize = 5;
    page = 1;
    title = '';
    viewOption = '';
    isInventory = false;
    tableElementsValues?: any;
    tableHeaders = [
        {
            style: "width: 15%",
            name: "Nombre"
        },
        {
            style: "width: 30%",
            name: "Direccion"
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

    constructor(private dataService: DataService, private route: ActivatedRoute,private alertService: AlertService) {}

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            this.viewOption = params['opt'];
        });

        this.title = 'Tiendas';
  
        if (this.viewOption && this.viewOption === "inventory"){
            this.isInventory = true;
            this.title = 'Inventarios de Tiendas'
        }
        this.retriveEstablishments();
    }

    retriveEstablishments(){
        this.establishments = undefined;
        this.dataService.getAllEstablishmentsByFilter({"status": 1})
            .pipe(first())
            .subscribe({
                next: (establishments: any) => {
                    this.establishments = establishments.findEstablishmentResponse?.establishment;
                    this.allEstablishments = this.establishments;
                    this.setTableElements(this.establishments);
                }
            });
    }

    search(value: any): void {
        if (this.allEstablishments){
            this.establishments = this.allEstablishments?.filter((val) => {
                if(this.searchTerm){
                    const nameMatch = val.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const addressMatch = val.address?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const descriptionMatch = val.description?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return nameMatch || addressMatch || descriptionMatch;
                }
                return true;
            });
        }
        this.setTableElements(this.establishments);
    }

    setTableElements(elements: any){
        this.tableElementsValues = {
            headers: this.tableHeaders,
            rows: []
        }
        elements?.forEach((element: any) => {
            let buttonsRow = {
                type: "button",
                style: "white-space: nowrap",
                button: [
                    {
                        type: "button",
                        routerLink: "view/" + element._id,
                        query_params: {opt: this.viewOption},
                        class: "btn btn-success btn-sm pb-0 mx-1",
                        icon: {
                            class: "material-icons",
                            icon: "visibility"
                        }
                    },
                    {
                        type: "button",
                        routerLink: "edit/" + element._id,
                        query_params: {opt: this.viewOption},
                        class: "btn btn-primary btn-sm pb-0 mx-1",
                        icon: {
                            class: "material-icons",
                            icon: "edit"
                        }
                    }
                ]
            };
            if(this.isInventory){
                buttonsRow = {
                    type: "button",
                    style: "white-space: nowrap",
                    button: [
                        {
                            type: "button",
                            routerLink: "inventory/" + element._id,
                            query_params: {opt: element.name},
                            class: "btn btn-primary btn-sm pb-0 mx-1",
                            icon: {
                                class: "material-icons",
                                icon: "inventory_2"
                            }
                        },
                        {
                            type: "button",
                            routerLink: "sales/" + element._id,
                            query_params: {opt: this.viewOption},
                            class: "btn btn-warning btn-sm pb-0 mx-1",
                            icon: {
                                class: "material-icons",
                                icon: "local_grocery_store"
                            }
                        }
                    ]
                };
            };
            const curr_row = {
                row: [
                    { type: "text", value: element.name, header_name: "Nombre" },
                    { type: "text", value: element.address, header_name: "Direccion" },
                    { type: "text", value: element.description, header_name: "Descripcion" },
                    buttonsRow
                  ],
            }
            this.tableElementsValues.rows.push(curr_row);
        });
    }

}