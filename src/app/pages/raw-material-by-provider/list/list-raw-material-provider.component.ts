import { Component, OnInit } from '@angular/core';
import {first, map, startWith} from 'rxjs/operators';
import { DataService } from '@app/services';
import {
AbstractControl,
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';
import { BehaviorSubject, Observable, forkJoin } from 'rxjs';
import { RawMaterialByProvider } from '@app/models/raw-material/raw-material-by-provider.model';
import { Provider } from '@app/models/system/provider.model';

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
    selectedProviderSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedProvider?: Provider;
    providerOptions?: Provider[];

    cards?: any[];

    constructor(private dataService: DataService, public _builder: FormBuilder) {}

    ngOnInit() {
        this.retriveRawMaterials();

        this.selectedProviderSubject.subscribe(value => {
            this.setProvider(String(value));
        });
    }

    setProvider(providerId: string){
        this.selectedProvider = this.providerOptions?.find(provid => provid._id === providerId);
        console.log('setProvider', this.selectedProvider);
        if(this.selectedProvider){
            this.getCards();
        }
    }

    retriveRawMaterials(){
        this.rawMaterials = undefined;

        let requestArray = [];
        requestArray.push(this.dataService.getAllRawMaterialsByProviderByFilter({"status": { "id": 2}}));
        requestArray.push(this.dataService.getAllProvidersByFilter({"status": { "id": 2}}));

        forkJoin(requestArray).subscribe({
            next: (result: any) => {

                this.rawMaterials = result[0].retrieveRawMaterialByProviderResponse?.rawMaterial;
                this.allRawMaterials = this.rawMaterials;
                this.providerOptions = result[1].retrieveProviderResponse?.providers;
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.getCards();
            }
        });

        // this.dataService.getAllRawMaterialsByProviderByFilter({"status": { "id": 2}})
        //     .pipe(first())
        //     .subscribe({
        //         next: (rawMaterials: any) => {
        //             this.rawMaterials = rawMaterials.retrieveRawMaterialByProviderResponse?.rawMaterial;
        //             this.allRawMaterials = this.rawMaterials;
        //             this.getCards();
        //         }
        //     });
    }

    getCards(){
        this.cards = [];
        if (this.rawMaterials && this.selectedProvider){
            this.rawMaterials.forEach(element => {
                if (element.provider?._id !== this.selectedProvider?._id) return;
                let currentCard = {
                    title: element.rawMaterialBase?.name,
                    photo: element.rawMaterialBase?.photo,
                    descriptions: [
                        {name:'Proveedor:', value: element.provider?.name},
                        {name:'Precio:', value: this.dataService.getFormatedPrice(Number(element.price))},
                        {name:'Medida:', value: element.rawMaterialBase?.measure?.identifier},
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
                    const measureMatch = val.rawMaterialBase?.measure?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
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