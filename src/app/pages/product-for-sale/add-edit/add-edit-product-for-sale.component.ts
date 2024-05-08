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
    finishedProductForm!: FormGroup;
    currentProductForSale?: ProductForSale;
    productForSaleElements?: ProductForSale[];
    selectedEstablishmentSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedEstablishment?: Establishment;
    establishmentOptions?: Establishment[];

    finishedProducts?: FinishedProduct[];
    unselectedFinishedProducts?: FinishedProduct[];
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
        this.finishedProductForm = this.createFinishedProductFormGroup();
        this.title = 'Crear Producto para Venta';

        if (this.id){
            this.title = 'Actualizar Producto para Venta';
        }

        this.finishedProducts = [];
        this.allFinishedProducts = this.finishedProducts;
        this.unselectedFinishedProducts = [];
        this.productForSaleElements = [];

        this.dataService.getAllEstablishments()
            .pipe(
                concatMap((establishments: any) => {
                    this.establishmentOptions = establishments.findEstablishmentResponse?.establishment;
                    this.establishmentOptions = this.establishmentOptions?.filter(est => est.status?.id === 2);
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
        this.selectedFinishedProduct = undefined;
        this.elements = [];
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

    get r() {
        return this.finishedProductForm.controls;
    }

    get priceValue() {
        return this.productoForSaleForm.get('price');
    }

    setEstablishment(establishmentId: string){
        this.productForSaleElements = [];
        this.unselectedFinishedProducts = [];
        this.finishedProducts = this.allFinishedProducts;
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
        return this.dataService.addMultiProductForSale(this.productForSaleElements!);
    }

    createFormGroup() {
        return new FormGroup({
        //   price: new FormControl('', [
        //     Validators.required,
        //     Validators.pattern(/^\d+(\.\d{1,2})?$/),
        //   ]),
          establishment: new FormControl('', [this.id ? Validators.nullValidator : Validators.required]),
          price: new FormControl('', [this.id ? Validators.required : Validators.nullValidator, Validators.pattern(/^\d+(\.\d{1,2})?$/)])
        });
    }

    setFinishedProductElements(finishedProd: FinishedProduct){
        this.elements.push({icon : "inventory_2", name : "Nombre", value : finishedProd.name});
        this.elements.push({icon : "scale", name : "Medida", value : finishedProd.measure?.identifier});
        this.elements.push({icon : "feed", name : "Descripción", value : finishedProd.description});
    }

    selectFinishedProductV2(finishedProd: FinishedProduct, indexToRemove: number){
        this.selectedFinishedProduct = finishedProd;
        this.elements = [];
        this.setFinishedProductElements(this.selectedFinishedProduct);
        // this.rawMaterialIndexToRemove = indexToRemove;
        // let newOrderElement: RawMaterialOrderElement = {
        //     rawMaterialByProvider: rawMaterial,
        //     price: rawMaterial.price,
        //     discount: "0",
        //     quantity: "1"
        // };
        // this.rawMaterialOrderElements?.push(newOrderElement);
    }

    unselectFinishedProductV2(productForSale: ProductForSale, indexToRemove: number){
        this.productForSaleElements?.splice(indexToRemove, 1);
        this.findAndMoveFinishedProductById(false, productForSale.finishedProduct?._id);
    }

    onSaveFinishedProductForm(){
        let newProductForSale: ProductForSale = {
            finishedProduct: this.selectedFinishedProduct,
            establishment: this.selectedEstablishment,
            ...this.finishedProductForm.value,
        };
        this.productForSaleElements?.push(newProductForSale);
        this.findAndMoveFinishedProductById(true, this.selectedFinishedProduct?._id);
        this.onResetFinishedProductForm();
    }

    findAndMoveFinishedProductById(isSelect: boolean, finishedProductId?: string){
        if (isSelect){
            let fpResult = this.finishedProducts?.find(fp => fp._id === finishedProductId);
            if (fpResult) {
                this.finishedProducts = this.finishedProducts?.filter(fp => fp._id !== finishedProductId);
                this.unselectedFinishedProducts?.push(fpResult);
            }
        } else { // unselect
            let fpResult = this.unselectedFinishedProducts?.find(fp => fp._id === finishedProductId);
            if (fpResult){
                this.unselectedFinishedProducts = this.unselectedFinishedProducts?.filter(fp => fp._id !== finishedProductId);
                this.finishedProducts?.push(fpResult);
            }
        }
    }

    closeFinishedProductDialog(){
        this.onResetFinishedProductForm();
    }

    createFinishedProductFormGroup() {
        return new FormGroup({
            price: new FormControl('', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)])
        });
    }

    onResetFinishedProductForm(){
        this.finishedProductForm.reset();
        this.selectedFinishedProduct = undefined;
        this.elements = [];
    }

}