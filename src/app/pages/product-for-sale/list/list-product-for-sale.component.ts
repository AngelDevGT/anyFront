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
    pager!: PagerState;
    readonly pageSizes = [8, 12, 24, 48, 96];
    searchTerm?: string;
    minDate: Date = new Date();
    nameOptions: string[] = ['Longaniza', 'Chorizo', 'Posta'];
    storeID = '';
    filteredNameOptions?: Observable<string[]>;
    filteredCreatorUserOptions?: Observable<string[]>;
    cards?: any[];
    savingOrder = false;

    constructor(private dataService: DataService, private route: ActivatedRoute, public _builder: FormBuilder, private alertService: AlertService, private paginationState: PaginationStateService) {}

    ngOnInit() {

        this.pager = this.paginationState.createPager(8);

        this.route.queryParams.subscribe(params => {
            this.storeID = params['store'];
        });

        this.retriveProductsForSale();

    }

    retriveProductsForSale(){
        this.productsForSale = undefined;
        let requestArray = [];
        if(this.storeID){
            requestArray.push(this.dataService.getAllProductForSaleByFilterV3({"establishment_id": this.storeID, status_id: 50}));
            forkJoin(requestArray).subscribe({
                next: (result: any) => {
                    this.productsForSale = this.dataService.findJsonValue(result[0], 'json_result') || [];
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
                let descriptions = [
                    {name:'Tienda', value: element.establishment?.name},
                    {name:'Medida', value: element.finishedProduct?.measure?.identifier},
                    {name:'Descripción', value: element.finishedProduct?.description},
                    {name:'Creado', value: element.creationDate ? this.dataService.getLocalDateTimeFromUTCTime(element.creationDate) : null},
                    {name:'Última actualización', value: element.updatedDate ? this.dataService.getLocalDateTimeFromUTCTime(element.updatedDate) : null}
                ].filter(d => d.value != null && ('' + d.value).trim() !== '');
                let currentCard = {
                    title: element.finishedProduct?.name,
                    subtitle: element.price != null ? this.dataService.getFormatedPrice(Number(element.price)) : null,
                    photo: element.finishedProduct?.photo,
                    thumb: element.finishedProduct?.thumb,
                    link: '/productsForSale/view/' + element.id,
                    params: { store: this.storeID },
                    descriptions : descriptions,
                    buttons: [
                        {title: 'Editar', value: 'edit_note', link: '/productsForSale/edit/' + element.id, params: { store: this.storeID }},
                        // {title: 'Eliminar', value: 'delete', link: '/productsForSale/delete/' + element.id, params: { store: this.storeID }},
                    ]
                };
                newCards.push(currentCard);
            });
            this.cards = newCards;
        }
        this.pager.onDataChange(this.cards?.length ?? 0);
    }

    get sortItems() {
        return (this.allProductsForSale ?? []).map(p => ({
            id: p.id!,
            title: p.finishedProduct?.name,
            subtitle: p.price != null ? this.dataService.getFormatedPrice(Number(p.price)) : undefined
        }));
    }

    onSaveOrder(items: { id: string }[]) {
        this.savingOrder = true;
        const payload = items.map((it, index) => ({ id: it.id, sort_order: index }));
        this.dataService.updateProductForSaleSortOrder(payload)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.savingOrder = false;
                    this.alertService.success('Orden actualizado correctamente');
                    this.retriveProductsForSale();
                },
                error: () => {
                    this.savingOrder = false;
                    this.alertService.error('No se pudo actualizar el orden, intente nuevamente');
                }
            });
    }

    search(value: any): void {
        if (this.allProductsForSale){
            this.productsForSale = this.allProductsForSale?.filter((val) => {
                if(this.searchTerm){
                    const nameMatch = val.finishedProduct?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const measureMatch = val.finishedProduct?.measure?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const descriptionMatch = val.finishedProduct?.description?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const establishmentMatch = val.establishment?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const priceMatch = String(val.price ?? '').includes(this.searchTerm);
                    return nameMatch || measureMatch || descriptionMatch || establishmentMatch || priceMatch;
                }
                return true;
            });
            this.getCards();
        }
    }

}