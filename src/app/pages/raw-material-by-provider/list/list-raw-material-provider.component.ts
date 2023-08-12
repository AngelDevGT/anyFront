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
import { ProductForSale } from '@app/models/producto-for-sale.model';
import { RawMaterialBase } from '@app/models/raw-material/raw-material-base.model';
import { RawMaterialByProvider } from '@app/models/raw-material/raw-material-by-provider.model';

@Component({ 
    selector: 'page-list-raw-material-provider',
    templateUrl: 'list-raw-material-provider.component.html',
    styleUrls: ['list-raw-material-provider.component.scss']
})
export class ListRawMaterialByProviderComponent implements OnInit {

    rawMaterials?: RawMaterialByProvider[];
    allRawMaterials?: RawMaterialByProvider[];
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
        this.dataService.getAllRawMaterialsByProviderByFilter({"status": { "id": 2}})
            .pipe(first())
            .subscribe({
                next: (rawMaterials: any) => {
                    this.rawMaterials = rawMaterials.retrieveRawMaterialByProviderResponse?.rawMaterial;
                    this.allRawMaterials = this.rawMaterials;
                    console.log(this.rawMaterials);
                    this.getCards();
                }
            });
    }

    getCards(){
        this.cards = [];
        if (this.rawMaterials){
            this.rawMaterials.forEach(element => {
                let currentCard = {
                    title: element.rawMaterialBase?.name,
                    photo: element.rawMaterialBase?.photo,
                    descriptions: [
                        {name:'Proveedor:', value: element.provider?.name},
                        {name:'Precio:', value: element.price},
                        {name:'Medida:', value: element.rawMaterialBase?.measure},
                        {name:'Descripcion:', value: element.rawMaterialBase?.description},
                        {name:'Modificacion:', value: this.dataService.getLocalDateTimeFromUTCTime(element.updateDate!)},
                    ],
                    buttons: [
                        {title: 'Ver', value: 'visibility', link: '/rawMaterialsByProvider/view/' + element._id},
                        {title: 'Editar', value: 'edit_note', link: '/rawMaterialsByProvider/edit/' + element._id},
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
                    const nameMatch = val.rawMaterialBase?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const measureMatch = val.rawMaterialBase?.measure?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const descriptionMatch = val.rawMaterialBase?.description?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const priceMatch = val.price?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const providerMatch = val.provider?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return nameMatch || measureMatch || descriptionMatch || priceMatch || providerMatch;
                }
                return true;
            });
            this.getCards();
        }
    }

}