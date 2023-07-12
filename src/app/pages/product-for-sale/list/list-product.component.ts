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

@Component({ 
    selector: 'page-list-product',
    templateUrl: 'list-product.component.html',
    styleUrls: ['list-product.component.scss']
})
export class ListProductComponent implements OnInit {

    products?: ProductForSale[];
    allProducts?: ProductForSale[];
    productForm!: FormGroup;
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

    constructor(private dataService: DataService, public _builder: FormBuilder) {
        this.retriveProducts();
    }

    ngOnInit() {
        this.productForm = this.createFormGroup();
        this.filteredNameOptions = this.productForm.get('name')!.valueChanges.pipe(
            startWith(''),
            map(value => this._filter(value || '', this.nameOptions)),
        );
        this.filteredEstablishmentOptions = this.productForm.get('establishment')!.valueChanges.pipe(
            startWith(''),
            map(value => this._filter(value || '', this.establishmentOptions)),
        );
        this.filteredCreatorUserOptions = this.productForm.get('creatorUser')!.valueChanges.pipe(
            startWith(''),
            map(value => this._filter(value || '', this.creatorUserOptions)),
        )
    }

    retriveProducts(){
        this.products = [];
        this.dataService.getAllProductsByFilter({"status": 1})
            .pipe(first())
            .subscribe({
                next: (products: any) => {
                    this.products = products.findProductResponse?.products;
                    this.getCards();
                }
            });
    }

    retriveProductsWithParams(product: ProductForSale){
        let productFilter: any = {};
        if (product.name && product.name != '')
            productFilter['name'] = product.name;
        if (product.price != 0)
            productFilter['price'] = product.price
        if (product.establishment && product.establishment != '')
            productFilter['establishment'] = product.establishment
        if (product.applyDate && product.applyDate != '')
            productFilter['applyDate'] = product.applyDate
        if (product.creatorUser && product.creatorUser != '')
            productFilter['creatorUser'] = product.creatorUser
        this.products = [];
        this.dataService.getAllProductsByFilter({"status": 1, ...productFilter})
            .pipe(first())
            .subscribe({
                next: (products: any) => {
                    this.products = products.findProductResponse?.products;
                    console.log(this.products);
                    this.getCards();
                }
            });
    }

    getCards(){
        this.cards = [];
        if (this.products){
            for (let i=0; i < this.products!.length; i++){
                let currProduct = this.products![i];
                let currentCard = {
                    title: currProduct.name,
                    photo: currProduct.photo,
                    descriptions : [
                        {name:'Establecimiento:', value: currProduct.establishment},
                        {name:'Precio:', value: currProduct.price},
                        currProduct.pricePerDozen ? {name:'Precio Docena:', value: currProduct.pricePerDozen} : '',
                        {name:'Fecha aplicacion:', value: currProduct.applyDate}
                    ],
                    buttons: [
                        {title: 'Ver', value: 'visibility', link: '/products/view/' + currProduct._id},
                        {title: 'Editar', value: 'edit_note', link: '/products/edit/' + currProduct._id},
                        // {title: 'Eliminar', value: 'delete', link: '/products/delete' + currProduct._id},
                    ]
                }
                this.cards.push(currentCard);
            }
        }
    }

    getImage(imageId : any){
        return this.dataService.getImageById(imageId)
                    .pipe(first())
                    .subscribe({
                        next: (img: any) => {
                            return img.getImageResponse.image.image;
                        }
                    });
      }

    private _filter(value: string, options: string[]): string[] {
        const filterValue = value.toLowerCase();

        return options.filter(option => option.toLowerCase().includes(filterValue));
    }

    enviar(values: any) {
        console.log(values);
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

    filterProducts(){
        this.retriveProductsWithParams(this.productForm.value);
        console.log('filterProducts...');
    }
}