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

@Component({ 
    selector: 'page-add-edit-product',
    templateUrl: 'add-edit-product.component.html',
    styleUrls: ['add-edit-product.component.scss']
})
export class AddEditProductComponent implements OnInit{

    productForm!: FormGroup;
    fileList: FileList | null | undefined;
    imagenCargada: string | ArrayBuffer | null | undefined;
    filteredOptions?: Observable<string[]>;
    selectedMeasureSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    measureOptions: boolean[] = [false, false]; // 0: price, 1: pricePerDozen
    imgResultAfterResizeMax: DataUrl = '';
    establishmentOptions?: Establishment[];
    id?: string;
    title!: string;
    loading = true;
    submitting = false;
    
    minDate: Date = new Date();

    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute,
        private imageCompress: NgxImageCompressService, private alertService: AlertService,
        private router: Router) {
        this.selectedMeasureSubject.subscribe(value => {
            this.setMeasureOptions(value);
          });
    }

    ngOnInit(): void {
        this.retriveOptions();

        this.id = this.route.snapshot.params['id'];

        this.productForm = this.createFormGroup();
        this.title = 'Crear Producto';

        if (this.id){
            this.title = 'Actualizar Producto';
        }

        this.dataService.getAllEstablishmentsByFilter({"status": 1})
            .pipe(
                concatMap((establishments: any) => {
                    this.establishmentOptions = establishments.findEstablishmentResponse?.establishment;
                    if (this.id){
                        return this.dataService.getProductById(this.id);
                    }
                    return of(null);
                }),
                concatMap((prod: any) => {
                    if(prod){
                        let product = prod.getProductResponse?.product;
                        if (product){
                            this.productForm.patchValue(product);
                            this.setMeasureOptions(product.measure);
                            if (product.photo){
                                return this.dataService.getImageById(product.photo);
                            }
                        }
                    }
                    this.loading = false;
                    return of(null);
                })
            )
            .subscribe((img: any) => {
                if(img){
                    console.log(img)
                    let dataPhoto = img.getImageResponse.image.image;
                    if (dataPhoto){
                        this.imgResultAfterResizeMax = dataPhoto;
                        this.productPhoto!.setValue(dataPhoto);
                    }
                }
                this.loading = false;
            });

    }

    retriveOptions(){
        this.establishmentOptions = undefined;
        this.dataService.getAllEstablishmentsByFilter({"status": 1})
            .pipe(first())
            .subscribe({
                next: (establishments: any) => {
                    this.establishmentOptions = establishments.findEstablishmentResponse?.establishment;
                }
            });
    }

    onResetForm() {
        this.productForm.reset();
    }

    onSaveForm() {
        this.alertService.clear();
        this.submitting = true;
        this.saveProduct()
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Producto guardado', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/products');
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
        return this.productForm.controls;
    }

    // Getter method to access formcontrols
    get measureSelect() {
        return this.productForm.get('measure');
    }

    get productPhoto(){
        return this.productForm.get('photo');
    }

    get establishmentSelect(){
        return this.productForm.get('establishment');
    }

    resetMeasureOptions(){
        for (let mo = 0; mo < this.measureOptions.length; mo++) {
            this.measureOptions[mo] = false;
        }
    }

    setMeasureOptions(measure: any){
        this.resetMeasureOptions();
        if(measure == 'unit'){
            this.measureOptions[0] = true;
            this.measureOptions[1] = true;
        } else if (measure == 'onz'){
            this.measureOptions[0] = true;
        }
    }

    changeMeasure(e: any){
        this.measureSelect!.setValue(e.target.value, {
        onlySelf: true
        });
    }

    changeEstablishment(e: any){
        this.establishmentSelect!.setValue(e.target.value, {
        onlySelf: true
        });
    }

    saveProduct(){
        return this.id
        ? this.dataService.updateProduct(this.id, this.productForm.value, this.imgResultAfterResizeMax)
        : this.dataService.addProduct(this.productForm.value, this.imgResultAfterResizeMax);
    }

    createFormGroup() {
        return new FormGroup({
            name: new FormControl('', [
            Validators.required,
            Validators.minLength(1),
            Validators.maxLength(50),
          ]),
          measure: new FormControl('', [Validators.required]),
          pricePerDozen: new FormControl(''),
          price: new FormControl('', [Validators.required]),
          photo: new FormControl(''),
          establishment: new FormControl('', [Validators.required]),
          applyDate: new FormControl('', [Validators.required])
        });
    }

    uploadAndReturnWithMaxSize() {
        return this.imageCompress.uploadAndGetImageWithMaxSize(1, true).then(
            (result: DataUrl) => {
                this.imgResultAfterResizeMax = result;
                },
                (result: string) => {
                console.error(
                    "The compression algorithm didn't succed! The best size we can do is",
                    this.imageCompress.byteCount(result),
                    'bytes'
                );
                this.imgResultAfterResizeMax = result;
                this.productPhoto!.setValue(result);
            }
        );
    }

    removePhoto(){
        this.imgResultAfterResizeMax = '';
        this.productPhoto!.setValue('');
    }

}