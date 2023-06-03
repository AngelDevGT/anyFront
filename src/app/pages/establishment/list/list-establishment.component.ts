import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import {map, startWith} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';

import { AccountService, AlertService, DataService} from '@app/services';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Establishment } from '@app/models/establishment.model';

@Component({ 
    templateUrl: 'list-establishment.component.html',
    styleUrls: ['list-establishment.component.scss']
})
export class ListEstablishmentComponent implements OnInit {
    establishments?: Establishment[];
    allEstablishments?: Establishment[];
    searchTerm?: string;
    pageSize = 5;
    page = 1;
    dataSource!: MatTableDataSource<any>;
    displayedColumns: string[] = ['name', 'email', 'role'];
    isDeleting = false;

    constructor(private dataService: DataService, private alertService: AlertService) {}

    ngOnInit() {
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
                    this.dataSource = new MatTableDataSource(this.establishments);
                }
            });
    }

    search(value: any): void {
        if (this.allEstablishments){
            this.establishments = this.allEstablishments?.filter((val) => {
                if(this.searchTerm){
                    const nameMatch = val.name!.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const emailMatch = val.address!.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return nameMatch || emailMatch;
                }
                return true;
            });
        }
    }

    deleteUser(estbl: any) {
        let deleteEstablishment = Object.assign({}, estbl);
        deleteEstablishment.status = 3;
        estbl.status = 1000;
        this.dataService.deleteEstablishment(deleteEstablishment)
            .pipe(first())
            .subscribe({
                next: () => {
                this.alertService.success('Establecimiento eliminado')
                this.retriveEstablishments()
                },
                error: error => {
                    this.alertService.error('Error al eliminar el establecmiento');
                }});
    }


    createFormGroup() {
        return new FormGroup({
            field: new FormControl(''),
        });
    }

}