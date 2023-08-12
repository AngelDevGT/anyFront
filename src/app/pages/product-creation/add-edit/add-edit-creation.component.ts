import { Component, OnInit } from '@angular/core';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {concatMap, first, map, startWith} from 'rxjs/operators';
import {
    DataUrl,
    DOC_ORIENTATION,
    NgxImageCompressService,
    UploadResponse,
} from 'ngx-image-compress';

import { AccountService, AlertService, DataService } from '@app/services';
import {
AbstractControl,
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';
import { Establishment } from '@app/models/establishment.model';
import { ActivatedRoute, Router } from '@angular/router';
import { Provider } from '@app/models/system/provider.model';
import { InventoryElement } from '@app/models/inventory/inventory-element.model';
import { RawMaterialOrderElement } from '@app/models/raw-material/raw-material-order-element.model';
import { RawMaterialByProvider } from '@app/models/raw-material/raw-material-by-provider.model';
import { Constant } from '@app/models/auxiliary/constant.model';
import { RawMaterialBase } from '@app/models/raw-material/raw-material-base.model';
import { FinishedProduct } from '@app/models/product/finished-product.model';
import { ProductCreationElement } from '@app/models/product/product-creation-element.model';
import { ProductCreation } from '@app/models/product/product-creation.model';

@Component({ 
    selector: 'page-add-edit-creation',
    templateUrl: 'add-edit-creation.component.html',
    styleUrls: ['add-edit-creation.component.scss']
})
export class AddEditProductCreationComponent implements OnInit{

    //Form
    orderForm!: FormGroup;
    selectedFinishedProductSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedProviderSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    providerOptions?: Provider[];
    constantes?: Constant[];
    selectedFinishedProduct?: FinishedProduct;
    finishedProducts?: FinishedProduct[];
    rawMaterials?: RawMaterialBase[];
    allRawMaterials?: RawMaterialBase[];
    selectedRawMaterials?: InventoryElement[];
    rawMaterialOrderElements?: RawMaterialOrderElement[];
    productCreationElements?: ProductCreationElement[];
    productCreation?: ProductCreation;
    totalDiscount = 0;
    subtotal = 0;
    total = 0;
    id?: string;
    title!: string;
    loading = false;
    submitting = false;
    hasErrors = false;
    listMaxLength = {
        name : 50,
        quantity : 10
    };
    
    minDate: Date = new Date();

    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute,
        private imageCompress: NgxImageCompressService, private alertService: AlertService,
        private router: Router) {

        // this.selectedProviderSubject.subscribe(value => {
        //     this.setProvider(value);
        // })
        this.selectedFinishedProductSubject.subscribe(value => {
            this.selectProduct(value);
        });
    }

    ngOnInit(): void {

        this.id = this.route.snapshot.params['id'];

        this.loading = true;

        this.orderForm = this.createFormGroup();
        this.title = 'Crear Producto';

        if (this.id){
            this.title = 'Actualizar Creacion de producto';
        }

        this.selectedRawMaterials = [];
        this.rawMaterialOrderElements = [];
        this.productCreationElements = [];


        this.dataService.getAllFinishedProductByFilter({"status": { "id": 2}})
            .pipe(
                concatMap((products: any) => {
                    this.finishedProducts = products.retrieveFinishedProductResponse?.FinishedProducts;
                    return this.dataService.getAllRawMaterialsByFilter({"status": { "id": 2}});
                })
            )
            .pipe(first())
            .subscribe({
                next: (rawMaterials: any) => {
                    this.rawMaterials = rawMaterials.retrieveRawMaterialResponse?.rawMaterial;
                    this.allRawMaterials = this.rawMaterials;
                    this.loading = false;
                }
            });

    }

    onResetForm() {
        this.orderForm.reset();
    }

    onSaveForm() {
        this.alertService.clear();
        this.submitting = true;
        // this.saveProvider()
        //     .pipe(first())
        //     .subscribe({
        //         next: () => {
        //             this.alertService.success('Producto guardado', { keepAfterRouteChange: true });
        //             this.router.navigateByUrl('/products');
        //         },
        //         error: error => {
        //             let errorResponse = error.error;
        //             errorResponse = errorResponse.addProductResponse ? errorResponse.addProductResponse : errorResponse.updateProductResponse ? errorResponse.updateProductResponse : 'Error, consulte con el administrador';
        //             this.alertService.error(errorResponse.AcknowledgementDescription);
        //             this.submitting = false;
        //         }
        //     });
    }

    get f() {
        return this.orderForm.controls;
    }

    get providertSelect(){
        return this.orderForm.get('provider');
    }

    // setProvider(provider: any){
    //     this.filterByProvider(provider);
    // }

    selectProduct(productId?: String){
        if(productId){
            this.selectedFinishedProduct = this.finishedProducts?.find(prod => String(prod._id) === productId);
        }
    }

    // filterByProvider(providerId: string){
    //     if(this.allRawMaterials){
    //         this.rawMaterials = this.allRawMaterials?.filter((val) => {
    //             return providerId === val.provider?._id;
    //         });
    //     }
    // }


    changeProvider(e: any){
        this.providertSelect!.setValue(e.target.value, {
        onlySelf: true
        });
    }

    selectRawMaterial(rawMaterial: RawMaterialBase, indexToRemove: number){
        this.rawMaterials?.splice(indexToRemove, 1);
        let newProductCreationElement: ProductCreationElement = {
            rawMaterialBase: rawMaterial,
            quantity: "1"
        };
        this.productCreationElements?.push(newProductCreationElement);
    }

    unselectRawMaterial(creationElement: ProductCreationElement, indexToRemove: number){
        this.productCreationElements?.splice(indexToRemove, 1);
        this.rawMaterials?.push(creationElement.rawMaterialBase!);
    }

    createFormGroup() {
        return new FormGroup({
          comment: new FormControl('', [
            Validators.minLength(1),
            Validators.maxLength(100),
            ]),
          finishedProduct: new FormControl('', [Validators.required]),
          quantity: new FormControl('', [Validators.required, Validators.pattern(/\d+/),])
        });
    }

    onQuantityKeydown(event: KeyboardEvent) {
        // Obtener el código de la tecla presionada
        const key = event.key;
    
        // Permitir solo teclas numéricas y las teclas de navegación
        if (!/^[0-9]$/.test(key) && key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'Backspace' && key !== 'Delete') {
            event.preventDefault();
        }
    }

}