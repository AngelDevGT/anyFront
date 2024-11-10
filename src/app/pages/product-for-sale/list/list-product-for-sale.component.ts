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
import { ActivatedRoute } from '@angular/router';

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
    storeID = '';
    filteredNameOptions?: Observable<string[]>;
    filteredCreatorUserOptions?: Observable<string[]>;
    cards?: any[];

    constructor(private dataService: DataService, private route: ActivatedRoute, public _builder: FormBuilder) {}

    ngOnInit() {

        this.route.queryParams.subscribe(params => {
            this.storeID = params['store'];
        });

        this.retriveProductsForSale();

    }

    retriveProductsForSale(){
        this.productsForSale = undefined;
        let requestArray = [];
        if(this.storeID){
            requestArray.push(this.dataService.getAllProductForSaleByFilter({"establishment": { "_id": this.storeID}}));
            forkJoin(requestArray).subscribe({
                next: (result: any) => {
                    this.productsForSale = result[0].retrieveProductForSaleResponse?.productsForSale;
                    this.allProductsForSale = this.productsForSale;
                },
                error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
                complete: () => {
                    this.getCards();
                }
            });
        } else {
            this.cards = [];
        }
    }

    getCards(){
        let newCards: any[] = [];
        if (this.productsForSale){
            this.productsForSale.forEach(element => {
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
                newCards.push(currentCard);
            });
            this.cards = newCards;
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