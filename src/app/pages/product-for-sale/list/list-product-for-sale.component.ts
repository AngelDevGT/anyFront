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
import { ProductForSale } from '@app/models/product/producto-for-sale.model';
import { Measure } from '@app/models';
import { Establishment } from '@app/models/establishment.model';

@Component({ 
    selector: 'page-list-product-for-sale',
    templateUrl: 'list-product-for-sale.component.html',
    styleUrls: ['list-product-for-sale.component.scss']
})
export class ListProductForSaleComponent implements OnInit {

    productsForSale?: ProductForSale[];
    allProductsForSale?: ProductForSale[];
    ProductForSaleForm!: FormGroup;
    pageSize = 5;
    page = 1;
    searchTerm?: string;
    minDate: Date = new Date();
    nameOptions: string[] = ['Longaniza', 'Chorizo', 'Posta'];
    filteredNameOptions?: Observable<string[]>;
    establishmentOptions?: Establishment[];
    selectedEstablishment?: Establishment;
    selectedEstablishmentSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    filteredEstablishmentOptions?: Observable<string[]>;
    creatorUserOptions: string[] = ['User10', 'User21', 'User43'];
    filteredCreatorUserOptions?: Observable<string[]>;
    cards?: any[];

    constructor(private dataService: DataService, public _builder: FormBuilder) {}

    ngOnInit() {
        this.retriveProductsForSale();

        this.selectedEstablishmentSubject.subscribe(value => {
            this.setEstablishment(String(value));
        });

    }

    setEstablishment(establishmentId: string){
        console.log('setEstablishment', establishmentId);
        this.selectedEstablishment = this.establishmentOptions?.find(establishment => establishment._id === establishmentId);
        if(this.selectedEstablishment){
            this.getCards();
        }
    }

    retriveProductsForSale(){
        this.productsForSale = undefined;
        let requestArray = [];
        requestArray.push(this.dataService.getAllProductForSaleByFilter({"status": { "id": 2}}));
        requestArray.push(this.dataService.getAllEstablishmentsByFilter({"status": 1}));

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.productsForSale = result[0].retrieveProductForSaleResponse?.productsForSale;
                this.allProductsForSale = this.productsForSale;
                this.establishmentOptions = result[1].findEstablishmentResponse?.establishment;
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.getCards();
            }
        });
    }

    getCards(){
        this.cards = [];
        if (this.productsForSale && this.selectedEstablishment){
            this.productsForSale.forEach(element => {
                if(element.establishment?._id !== this.selectedEstablishment?._id) return;
                let currentCard = {
                    title: element.finishedProduct?.name,
                    photo: element.finishedProduct?.photo,
                    descriptions : [
                        {name:'Tienda:', value: element.establishment?.name},
                        {name:'Precio:', value: this.dataService.getFormatedPrice(Number(element.price))},
                        {name:'Medida:', value: element.finishedProduct?.measure?.identifier},
                        {name:'Descripcion:', value: element.finishedProduct?.description},
                        {name:'Fecha creacion:', value: this.dataService.getLocalDateTimeFromUTCTime(element.creationDate!)},
                        {name:'Fecha actualizacion:', value: this.dataService.getLocalDateTimeFromUTCTime(element.updateDate!)}
                    ],
                    buttons: [
                        {title: 'Ver', value: 'visibility', link: '/productsForSale/view/' + element._id},
                        {title: 'Editar', value: 'edit_note', link: '/productsForSale/edit/' + element._id},
                        // {title: 'Eliminar', value: 'delete', link: '/products/delete' + currProduct._id},
                    ]
                };
                this.cards!.push(currentCard);
            });
        }
    }

    search(value: any): void {
        if (this.productsForSale){
            this.productsForSale = this.allProductsForSale?.filter((val) => {
                if(this.searchTerm){
                    const nameMatch = val.finishedProduct?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const measureMatch = val.finishedProduct?.measure?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const descriptionMatch = val.finishedProduct?.description?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const establishmentMatch = val.establishment?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const priceMatch = val.price?.includes(this.searchTerm);
                    return nameMatch || measureMatch || descriptionMatch || establishmentMatch || priceMatch;
                }
                return true;
            });
            this.getCards();
        }
    }

}