import { Component, OnInit } from '@angular/core';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {concatMap, first, map, startWith} from 'rxjs/operators';
import {
    NgxImageCompressService
} from 'ngx-image-compress';

import { AlertService, DataService } from '@app/services';
import {
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';
import { Establishment } from '@app/models/establishment.model';
import { ActivatedRoute, Router } from '@angular/router';
import { FinishedProduct } from '@app/models/product/finished-product.model';
import { ProductForSale } from '@app/models/product/producto-for-sale.model';

@Component({ 
    selector: 'page-add-edit-product-for-sale',
    templateUrl: 'add-edit-product-for-sale.component.html',
    styleUrls: ['add-edit-product-for-sale.component.scss']
})
export class AddEditProductoForSaleComponent implements OnInit{

    //Form
    productoForSaleForm!: FormGroup;
    currentProductForSale?: ProductForSale;
    selectedEstablishmentSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedEstablishment?: Establishment;
    establishmentOptions?: Establishment[];

    finishedProducts?: FinishedProduct[];
    allFinishedProducts?: FinishedProduct[];
    selectedFinishedProduct?: FinishedProduct;

    elements: any = [];
    cardPhoto = undefined;
    loadingPhoto = false;

    id?: string;
    title!: string;
    loading = false;
    submitting = false;
    hasErrors = false;

    listMaxLength = {
        price : 10
    };
    
    minDate: Date = new Date();

    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute,
        private imageCompress: NgxImageCompressService, private alertService: AlertService,
        private router: Router) {

        this.selectedEstablishmentSubject.subscribe(value => {
            this.setEstablishment(String(value));
        })
    }

    ngOnInit(): void {

        this.id = this.route.snapshot.params['id'];

        this.loading = true;

        this.productoForSaleForm = this.createFormGroup();
        this.title = 'Crear Producto para Venta';

        if (this.id){
            this.title = 'Actualizar Producto para Venta';
        }

        this.finishedProducts = [];
        this.allFinishedProducts = this.finishedProducts;

        this.dataService.getAllEstablishmentsByFilter({"status": { "id": 2}})
            .pipe(
                concatMap((establishments: any) => {
                    this.establishmentOptions = establishments.findEstablishmentResponse?.establishment;
                    return this.dataService.getAllFinishedProductByFilter({"status": { "id": 2}});
                }),
                concatMap((products: any) => {
                    this.finishedProducts = products.retrieveFinishedProductResponse?.FinishedProducts;
                    this.allFinishedProducts = this.finishedProducts;
                    if(this.id){
                        return this.dataService.getProductForSaleById(this.id);
                    }
                    this.loading = false;
                    return of(null);    
                })
            )
            .subscribe((prod: any) => {
                if (prod){
                    let productForSale = prod.getProductForSaleResponse.productForSale;
                    this.currentProductForSale = productForSale;
                    this.priceValue?.patchValue(this.currentProductForSale?.price);
                    this.selectedFinishedProduct = this.currentProductForSale?.finishedProduct;
                }
                this.allFinishedProducts = this.finishedProducts;
                this.loading = false;
            });

    }

    onResetForm() {
        this.productoForSaleForm.reset();
    }

    onSaveForm() {
        this.alertService.clear();
        this.submitting = true;
        this.saveProductForSale()
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Producto para Venta guardado', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/productsForSale');
                },
                error: error => {
                    let errorResponse = error.error;
                    errorResponse = errorResponse.addProductResponse ? errorResponse.addProductResponse : errorResponse.updateProductResponse ? errorResponse.updateProductResponse : 'Error, consulte con el administrador';
                    this.alertService.error(errorResponse.AcknowledgementDescription);
                    this.submitting = false;
                }
            });
    }

    get f() {
        return this.productoForSaleForm.controls;
    }

    get priceValue() {
        return this.productoForSaleForm.get('price');
    }

    setEstablishment(establishmentId: string){
        if(establishmentId){
            this.selectedEstablishment = this.establishmentOptions?.find(establ => String(establ._id) === establishmentId);
        }
    }

    selectFinishedProduct(finishedProd: FinishedProduct){
        this.selectedFinishedProduct = finishedProd;
        this.setFinishedProductElements(finishedProd);
        // if(this.selectedRawMaterial.photo && this.selectedRawMaterial.photo !== ""){
        //     this.getImage(this.selectedRawMaterial.photo);
        // }
    }

    unselectFinishedProduct(){
        this.selectedFinishedProduct = undefined;
        this.elements = [];
        this.cardPhoto = undefined;
    }

    saveProductForSale(){
        if(this.id){
            delete this.currentProductForSale?.price;
            let updatedProductoForSale = {
                ...this.productoForSaleForm.value,
                ...this.currentProductForSale
            }
            return this.dataService.updateProductForSale(this.id, updatedProductoForSale);
        }
        let newProductForSale = {
            ...this.productoForSaleForm.value,
            finishedProduct: this.selectedFinishedProduct,
            establishment: this.selectedEstablishment
        };
        return this.dataService.addProductForSale(newProductForSale);
    }

    createFormGroup() {
        return new FormGroup({
          price: new FormControl('', [
            Validators.required,
            Validators.pattern(/^\d+(\.\d{1,2})?$/),
          ]),
          establishment: new FormControl('', [this.id ? Validators.nullValidator : Validators.required])
        });
    }

    setFinishedProductElements(finishedProd: FinishedProduct){
        this.elements.push({icon : "inventory_2", name : "Nombre", value : finishedProd.name});
        this.elements.push({icon : "scale", name : "Medida", value : finishedProd.measure?.identifier});
        this.elements.push({icon : "feed", name : "Descripción", value : finishedProd.description});
    }

    // getImage(imageId : any){
    //     this.loadingPhoto = true;
    //     return this.dataService.getImageById(imageId)
    //         .pipe(first())
    //         .subscribe({
    //             next: (img: any) => {
    //                 this.cardPhoto = img.getImageResponse.image.image;
    //                 this.loadingPhoto = false;
    //             }
    //         });
    //     }

}