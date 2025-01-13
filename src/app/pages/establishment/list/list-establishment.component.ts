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

    constructor(private dataService: DataService, private route: ActivatedRoute,private alertService: AlertService, private accountService: AccountService) {}

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            this.viewOption = params['opt'];
        });

        this.title = 'Tiendas';
  
        if (this.viewOption && this.viewOption === "inventory"){
            this.isInventory = true;
        }
        this.retriveEstablishments();
    }

    retriveEstablishments(){
        this.establishments = undefined;
        this.dataService.getAllEstablishments()
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
        this.tableElementsValues = [];
        const userEmail = this.accountService.userEmail;
        const userRole = this.accountService.userRole;
        elements?.forEach((element: any) => {
            let curr_row;
            let buttonsRow = {};
            if(this.isInventory){
                buttonsRow = {
                    type: "button_text_icon",
                    style: "white-space: nowrap",
                    header_name: "Acciones",
                    button: [
                        {
                            type: "button",
                            routerLink: "inventory/" + element._id,
                            class: "btn btn-outline-primary m-1",
                            icon: {
                                class: "material-icons",
                                icon: "inventory_2"
                            },
                            text: "Inventario"
                        },
                        {
                            type: "button",
                            routerLink: "/store/sales/history/" + element._id,
                            is_absolute: true,
                            class: "btn btn-outline-success m-1",
                            icon: {
                                class: "material-icons",
                                icon: "shopping_bag"
                            },
                            text: "Ventas"
                        },
                        {
                            type: "button",
                            routerLink: "/productsForSale/order",
                            is_absolute: true,
                            query_params: {opt: "store", store: element._id, name: element.name},
                            class: "btn btn-outline-secondary m-1",
                            icon: {
                                class: "material-icons",
                                icon: "local_shipping"
                            },
                            text: "Pedidos"
                        },
                        {
                            type: "button",
                            routerLink: "/cashClosing/" + element._id,
                            is_absolute: true,
                            class: "btn btn-outline-danger m-1",
                            icon: {
                                class: "material-icons",
                                icon: "dns"
                            },
                            text: "Caja"
                        }
                    ]
                };
                curr_row = [
                    { type: "text", value: element.name, header_name: "Nombre", style: "width: 20%;" },
                    { type: "text", value: element.address, header_name: "Direccion", style: "width: 20%;" },
                    buttonsRow
                ];
            } else {
                buttonsRow = {
                    type: "button_text_icon",
                    style: "white-space: nowrap",
                    header_name: "Acciones",
                    button: [
                        {
                            type: "button",
                            routerLink: "view/" + element._id,
                            query_params: {opt: this.viewOption},
                            class: "btn btn-outline-success m-1",
                            icon: {
                                class: "material-icons",
                                icon: "visibility"
                            },
                            text: "Ver"
                        },
                        {
                            type: "button",
                            routerLink: "edit/" + element._id,
                            query_params: {opt: this.viewOption},
                            is_absolute: false,
                            class: "btn btn-outline-primary m-1",
                            icon: {
                                class: "material-icons",
                                icon: "edit"
                            },
                            text: "Editar"
                        },
                        {
                            type: "button",
                            routerLink: "/productsForSale",
                            query_params: { store: element._id },
                            is_absolute: true,
                            class: "btn btn-outline-danger m-1",
                            icon: {
                                class: "material-icons",
                                icon: "shopping_bag"
                            },
                            text: "Productos"
                        }
                    ]
                };
                curr_row = [
                    { type: "text", value: element.name, header_name: "Nombre", style: "width: 20%;" },
                    { type: "text", value: element.address, header_name: "Direccion", style: "width: 20%;" },
                    { type: "text", value: element.description, header_name: "Descripcion", style: "width: 20%;" },
                    buttonsRow
                ];
            };
            const emails = this.accountService.extractEmails(element.description);
            // if(false){
            if(this.accountService.isAdminUser()){
                this.tableElementsValues.push(curr_row);
            } else if(emails.length > 0){
                if(userEmail){
                    if(emails.includes(userEmail)){
                        this.tableElementsValues.push(curr_row);
                    }
                }
            }
        });
    }

}