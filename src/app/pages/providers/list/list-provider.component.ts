import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import {map, startWith} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';

import { AccountService, AlertService, DataService} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Provider } from '@app/models/provider.model';

@Component({ 
    templateUrl: 'list-provider.component.html',
    styleUrls: ['list-provider.component.scss']
})
export class ListProviderComponent implements OnInit {
    providers?: Provider[];
    allProviders?: Provider[];
    searchTerm?: string;
    pageSize = 5;
    page = 1;
    dataSource!: MatTableDataSource<any>;
    displayedColumns: string[] = ['name', 'email', 'role'];
    isDeleting = false;

    constructor(private dataService: DataService, private alertService: AlertService) {}

    ngOnInit() {
        this.retriveProviders();
    }

    retriveProviders(){
        this.providers = undefined;
        this.dataService.getAllProvidersByFilter({"status": 1})
            .pipe(first())
            .subscribe({
                next: (providers: any) => {
                    this.providers = providers.retrieveProviderResponse?.providers;
                    this.allProviders = this.providers;
                    this.dataSource = new MatTableDataSource(this.providers);
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
        }
    }

    deleteProvider(prov: any) {
        let deleteProvider = Object.assign({}, prov);
        deleteProvider.status = 3;
        prov.status = 1000;
        this.dataService.deleteProvider(deleteProvider)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Proveedor eliminado')
                this.retriveProviders()
                },
                error: error => {
                    this.alertService.error('Error al eliminar el proveedor');
                }});
    }


    createFormGroup() {
        return new FormGroup({
            field: new FormControl(''),
        });
    }

}