import { Component, OnInit } from '@angular/core';
import {first, map, startWith} from 'rxjs/operators';
import { AlertService, DataService, PagerState, PaginationStateService } from '@app/services';
import {
AbstractControl,
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';
import { Observable } from 'rxjs';
import { FinishedProduct } from '@app/models/product/finished-product.model';
import { ActivatedRoute } from '@angular/router';

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
    pager!: PagerState;
    readonly pageSizes = [8, 12, 24, 48, 96];
    minDate: Date = new Date();
    nameOptions: string[] = ['Longaniza', 'Chorizo', 'Posta'];
    filteredNameOptions?: Observable<string[]>;
    establishmentOptions: string[] = ['La Democracia', 'La Esperanza', 'Los Altos'];
    filteredEstablishmentOptions?: Observable<string[]>;
    creatorUserOptions: string[] = ['User10', 'User21', 'User43'];
    filteredCreatorUserOptions?: Observable<string[]>;

    cards?: any[];
    productType = 1;
    basePath = '/finishedProducts';
    pageTitle = 'Productos';
    pageSubtitle = 'Administra los productos terminados';
    createLabel = 'Crear Producto';

    savingOrder = false;

    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute, private alertService: AlertService, private paginationState: PaginationStateService) {}

    ngOnInit() {
        this.pager = this.paginationState.createPager(8);
        this.productType = this.route.snapshot.data['productType'] ?? 1;
        this.basePath = this.productType === 2 ? '/abarrotes' : '/finishedProducts';
        this.pageTitle = this.productType === 2 ? 'Abarrotes' : 'Productos';
        this.pageSubtitle = this.productType === 2 ? 'Administra los abarrotes' : 'Administra los productos terminados';
        this.createLabel = this.productType === 2 ? 'Crear Abarrote' : 'Crear Producto';
        this.retriveProducts();
    }

    retriveProducts(){
        this.products = undefined;
        this.dataService.getAllFinishedProductByFilterV3({"status_id": 36, "finished_product_type_id": this.productType})
            .pipe(first())
            .subscribe({
                next: (products: any) => {
                    this.products = this.dataService.findJsonValue(products, 'json_result') || [];
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
                let descriptions = [
                    {name:'Descripción', value: currProduct.description},
                    {name:'Creado', value: currProduct.creationDate ? this.dataService.getLocalDateTimeFromUTCTime(currProduct.creationDate) : null},
                    {name:'Última actualización', value: currProduct.updatedDate ? this.dataService.getLocalDateTimeFromUTCTime(currProduct.updatedDate) : null}
                ].filter(d => d.value != null && ('' + d.value).trim() !== '');
                let currentCard = {
                    title: currProduct.name,
                    subtitle: currProduct.measure?.identifier,
                    photo: currProduct.photo,
                    thumb: currProduct.thumb,
                    link: this.basePath + '/view/' + currProduct.id,
                    descriptions : descriptions,
                    buttons: [
                        {title: 'Editar', value: 'edit_note', link: this.basePath + '/edit/' + currProduct.id},
                        // {title: 'Eliminar', value: 'delete', link: this.basePath + '/delete/' + currProduct.id},
                    ]
                }
                this.cards.push(currentCard);
            }
        }
        this.pager.onDataChange(this.cards.length);
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

    get sortItems() {
        return (this.allProducts ?? []).map(p => ({ id: p.id!, title: p.name, subtitle: p.measure?.identifier }));
    }

    onSaveOrder(items: { id: string }[]) {
        this.savingOrder = true;
        const payload = items.map((it, index) => ({ id: it.id, sort_order: index }));
        this.dataService.updateFinishedProductSortOrder(payload)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.savingOrder = false;
                    this.alertService.success('Orden actualizado correctamente');
                    this.retriveProducts();
                },
                error: () => {
                    this.savingOrder = false;
                    this.alertService.error('No se pudo actualizar el orden, intente nuevamente');
                }
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