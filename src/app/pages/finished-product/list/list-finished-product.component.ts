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
import { Observable } from 'rxjs';
import { FinishedProduct } from '@app/models/product/finished-product.model';

@Component({ 
    selector: 'page-list-finished-product',
    templateUrl: 'list-finished-product.component.html',
    styleUrls: ['list-finished-product.component.scss']
})
export class ListFinishedProductComponent implements OnInit {

    products?: FinishedProduct[];
    allProducts?: FinishedProduct[];
    productForm!: FormGroup;
    searchTerm?: string;
    pageSize = 5;
    page = 1;
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
        this.retriveProducts();
    }

    retriveProducts(){
        this.products = undefined;
        this.dataService.getAllFinishedProductByFilter({"status": { "id": 2}})
            .pipe(first())
            .subscribe({
                next: (products: any) => {
                    this.products = products.retrieveFinishedProductResponse?.FinishedProducts;
                    this.allProducts = this.products;
                    this.getCards();
                }
            });
    }

    getCards(){
        this.cards = [];
        if (this.products){
            for (let i=0; i < this.products?.length; i++){
                let currProduct = this.products[i];
                let currentCard = {
                    title: currProduct.name,
                    photo: currProduct.photo,
                    descriptions : [
                        {name:'Descripcion:', value: currProduct.description},
                        {name:'Medida:', value: currProduct.measure?.identifier},
                        {name:'Fecha creacion:', value: this.dataService.getLocalDateTimeFromUTCTime(currProduct.creationDate!)},
                        {name:'Fecha actualizacion:', value: this.dataService.getLocalDateTimeFromUTCTime(currProduct.updateDate!)}
                    ],
                    buttons: [
                        {title: 'Ver', value: 'visibility', link: '/finishedProducts/view/' + currProduct._id},
                        {title: 'Editar', value: 'edit_note', link: '/finishedProducts/edit/' + currProduct._id},
                        // {title: 'Eliminar', value: 'delete', link: '/products/delete' + currProduct._id},
                    ]
                }
                this.cards.push(currentCard);
            }
        }
    }

    createFormGroup() {
        return new FormGroup({
            name: new FormControl('', [Validators.maxLength(45)]),
            price: new FormControl('', [Validators.maxLength(45)]),
            establishment: new FormControl('', [Validators.maxLength(45)]),
            applyDate: new FormControl('', [Validators.maxLength(45)]),
            creatorUser: new FormControl('', [Validators.maxLength(45)]),
        });
    }

    search(value: any): void {
        if (this.products){
            this.products = this.allProducts?.filter((val) => {
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