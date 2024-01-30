import { Component, OnInit } from '@angular/core';
import {first, map, startWith} from 'rxjs/operators';

import { User } from '@app/models';
import { AccountService } from '@app/services';
import { DataService } from '@app/services';
import {
AbstractControl,
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';
import { Observable } from 'rxjs';
import { RawMaterialBase } from '@app/models/raw-material/raw-material-base.model';

@Component({ 
    selector: 'page-list-raw-material',
    templateUrl: 'list-raw-material.component.html',
    styleUrls: ['list-raw-material.component.scss']
})
export class ListRawMaterialComponent implements OnInit {

    rawMaterials?: RawMaterialBase[];
    allRawMaterials?: RawMaterialBase[];
    rawMaterialForm!: FormGroup;
    pageSize = 5;
    page = 1;
    searchTerm?: string;
    minDate: Date = new Date();
    nameOptions: string[] = ['Longaniza', 'Chorizo', 'Posta'];
    filteredNameOptions?: Observable<string[]>;
    establishmentOptions: string[] = ['La Democracia', 'La Esperanza', 'Los Altos'];
    filteredEstablishmentOptions?: Observable<string[]>;
    creatorUserOptions: string[] = ['User10', 'User21', 'User43'];
    filteredCreatorUserOptions?: Observable<string[]>;

    cards?: any[];

    constructor(private dataService: DataService, public _builder: FormBuilder) {}

    ngOnInit() {
        this.retriveRawMaterials();
    }

    retriveRawMaterials(){
        this.rawMaterials = undefined;
        this.dataService.getAllRawMaterialsByFilter({"status": { "id": 2}})
            .pipe(first())
            .subscribe({
                next: (rawMaterials: any) => {
                    this.rawMaterials = rawMaterials.retrieveRawMaterialResponse?.rawMaterial;
                    this.allRawMaterials = this.rawMaterials;
                    this.getCards();
                }
            });
    }

    getCards(){
        this.cards = [];
        if (this.rawMaterials){
            this.rawMaterials.forEach(element => {
                let currentCard = {
                    title: element.name,
                    photo: element.photo,
                    descriptions: [
                        {name:'Descripcion:', value: element.description},
                        {name:'Medida:', value: element.measure?.identifier},
                        {name:'Creacion:', value: this.dataService.getLocalDateTimeFromUTCTime(element.creationDate!)},
                        {name:'Modificacion:', value: this.dataService.getLocalDateTimeFromUTCTime(element.updateDate!)},
                    ],
                    buttons: [
                        {title: 'Ver', value: 'visibility', link: '/rawMaterials/view/' + element._id},
                        {title: 'Editar', value: 'edit_note', link: '/rawMaterials/edit/' + element._id},
                        // {title: 'Eliminar', value: 'delete', link: '/products/delete' + currRawMaterial._id},
                    ]
                };
                this.cards!.push(currentCard);
            });
        }
    }

    search(value: any): void {
        if (this.rawMaterials){
            this.rawMaterials = this.allRawMaterials?.filter((val) => {
                if(this.searchTerm){
                    const nameMatch = val.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const measureMatch = val.measure?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const descriptionMatch = val.description?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return nameMatch || measureMatch || descriptionMatch;
                }
                return true;
            });
            this.getCards();
        }
    }

}