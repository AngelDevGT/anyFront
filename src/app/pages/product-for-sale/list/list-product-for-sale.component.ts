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
import { RawMaterialByProvider } from '@app/models/raw-material/raw-material-by-provider.model';
import { ProductForSale } from '@app/models/product/producto-for-sale.model';

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
    establishmentOptions: string[] = ['La Democracia', 'La Esperanza', 'Los Altos'];
    filteredEstablishmentOptions?: Observable<string[]>;
    creatorUserOptions: string[] = ['User10', 'User21', 'User43'];
    filteredCreatorUserOptions?: Observable<string[]>;

    cards?: any[];

    constructor(private dataService: DataService, public _builder: FormBuilder) {}

    ngOnInit() {
        this.retriveProductsForSale();
    }

    retriveProductsForSale(){
        this.productsForSale = undefined;
        this.dataService.getAllProductForSaleByFilter({"status": { "id": 2}})
            .pipe(first())
            .subscribe({
                next: (prodForSale: any) => {
                    this.productsForSale = prodForSale.retrieveProductForSaleResponse?.productsForSale;
                    this.allProductsForSale = this.productsForSale;
                    this.getCards();
                }
            });
    }

    getCards(){
        this.cards = [];
        if (this.productsForSale){
            this.productsForSale.forEach(element => {
                let currentCard = {
                    title: element.finishedProduct?.name,
                    photo: element.finishedProduct?.photo,
                    descriptions : [
                        {name:'Proveedor:', value: element.establishment?.name},
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