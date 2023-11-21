import { Component, OnInit } from '@angular/core';
import {BehaviorSubject, Observable, forkJoin, of} from 'rxjs';
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
import { RawMaterialBase } from '@app/models/raw-material/raw-material-base.model';
import { FinishedProduct } from '@app/models/product/finished-product.model';
import { Measure } from '@app/models';

@Component({ 
    selector: 'page-add-edit-finished-product',
    templateUrl: 'add-edit-finished-product.component.html',
    styleUrls: ['add-edit-finished-product.component.scss']
})
export class AddEditFinishedProductComponent implements OnInit{

    productForm!: FormGroup;
    measureOptions?: Measure[];
    currentProduct?: FinishedProduct;
    selectedMeasureSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedMeasure?: Measure;
    fileList: FileList | null | undefined;
    imagenCargada: string | ArrayBuffer | null | undefined;
    imgResultAfterResizeMax: DataUrl = '';
    id?: string;
    title!: string;
    loading = true;
    submitting = false;
    maxFileSize = 10485760;
    listMaxLength = {
        name : 50,
        description : 200
    };
    selectedImage?: string;
    selectedFileImage?: File;
    
    minDate: Date = new Date();

    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute,
        private imageCompress: NgxImageCompressService, private alertService: AlertService,
        private router: Router) {

            this.selectedMeasureSubject.subscribe(value => {
                this.setMeasure(String(value));
            });
    }

    ngOnInit(): void {

        this.id = this.route.snapshot.params['id'];

        this.productForm = this.createFormGroup();
        this.title = 'Crear Producto Terminado';

        let requestArray = [];

        requestArray.push(this.dataService.getAllConstantsByFilter({fc_id_catalog: "unitBase", enableElements: "true"})); // measureRequest
        if (this.id){
            this.title = 'Actualizar Producto Terminado';
            requestArray.push(this.dataService.getFinishedProductById(this.id));
        }

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.measureOptions = result[0].retrieveCatalogGenericResponse.elements;
                if (this.id){
                    this.currentProduct = result[1].getFinishedProductResponse.FinishedProduct;
                }
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                if (this.currentProduct){
                    this.productForm.patchValue(this.currentProduct);
                    if(this.currentProduct.photo){
                        this.selectedImage = this.dataService.getImageWithURL(this.currentProduct.photo);
                    }
                }
                this.loading = false;
            }
        });

        // if (this.id){
            
        //     this.title = 'Actualizar Producto Terminado';
        //     this.loading = true;

        //     this.dataService.getFinishedProductById(this.id)
        //         .pipe(
        //             concatMap((prod: any) => {
        //                 let product = prod.getFinishedProductResponse.FinishedProduct;
        //                 if (product){
        //                     this.currentProduct = product;
        //                     this.productForm.patchValue(product);
        //                     if(product.photo){
        //                         return this.dataService.getImageById(product.photo);
        //                     }
        //                 }
        //                 this.loading = false;
        //                 return of(null);
        //             })
        //         )
        //         .subscribe((img: any) => {
        //             if(img){
        //                 let dataPhoto = img.getImageResponse.image.image;
        //                 if (dataPhoto){
        //                     this.imgResultAfterResizeMax = dataPhoto;
        //                     this.productPhoto!.setValue(dataPhoto);
        //                 }
        //             }
        //             this.loading = false;
        //         });
        // }


    }

    onResetForm() {
        this.productForm.reset();
    }

    onSaveForm() {
        this.alertService.clear();
        this.submitting = true;

        if(this.selectedFileImage){
            this.dataService.uploadImage(this.selectedFileImage)
            .pipe(
                concatMap((imgResponse: any) => {
                    let imgName = imgResponse.name;
                    return this.saveFinishedProduct(imgName);
                })
            ).subscribe({
                next: () => {
                    this.alertService.success('Producto terminado guardado', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/finishedProducts');
                },
                error: error => {
                    let errorResponse = error.error;
                    errorResponse = errorResponse.addProductResponse ? errorResponse.addProductResponse : errorResponse.updateRawMaterial ? errorResponse.updateRawMaterial : 'Error, consulte con el administrador';
                    this.alertService.error(errorResponse.AcknowledgementDescription);
                    this.submitting = false;
                }
            });
        } else {
            let imgName = undefined;
            if(this.selectedImage && this.selectedImage !== ""){
                imgName = this.currentProduct?.photo;
            }
            this.saveFinishedProduct(imgName)
                .pipe(first())
                .subscribe({
                    next: () => {
                        this.alertService.success('Producto terminado guardado', { keepAfterRouteChange: true });
                        this.router.navigateByUrl('/finishedProducts');
                    },
                    error: error => {
                        let errorResponse = error.error;
                        errorResponse = errorResponse.addProductResponse ? errorResponse.addProductResponse : errorResponse.updateRawMaterial ? errorResponse.updateRawMaterial : 'Error, consulte con el administrador';
                        this.alertService.error(errorResponse.AcknowledgementDescription);
                        this.submitting = false;
                    }
            });
        }
    }

    setMeasure(measureId: string){
        if(measureId){
            this.selectedMeasure = this.measureOptions?.find(meas => String(meas.id) === measureId);
        }
    }

    get f() {
        return this.productForm.controls;
    }

    get productPhoto(){
        return this.productForm.get('photo');
    }

    saveFinishedProduct(imgName?: string){
        if(this.id){
            let newProduct = {
                ...this.currentProduct,
                ...this.productForm.value
            };
            return this.dataService.updateFinishedProduct(this.id, newProduct, imgName);
        }
        let newProduct = {
            ...this.productForm.value,
            measure: this.selectedMeasure
        }
        return this.dataService.addFinishedProduct(newProduct, imgName);
    }

    createFormGroup() {
        return new FormGroup({
          name: new FormControl('', [
            Validators.required
          ]),
          measure: new FormControl('', [Validators.required]),
          description: new FormControl('', [
            Validators.required
          ]),
          photo: new FormControl('')
        });
    }

    onFileSelected(event: any): void {
        this.selectedFileImage = event.target.files[0];
        console.log(this.selectedFileImage);
        const reader = new FileReader();
            reader.onload = (e: any) => {
            this.selectedImage = e.target.result;
            };
        reader.readAsDataURL(this.selectedFileImage!);
    }

    // uploadAndReturnWithMaxSize() {
    //     return this.imageCompress.uploadAndGetImageWithMaxSize(1, true).then(
    //         (result: DataUrl) => {
    //             this.imgResultAfterResizeMax = result;
    //             },
    //             (result: string) => {
    //             console.error(
    //                 "The compression algorithm didn't succed! The best size we can do is",
    //                 this.imageCompress.byteCount(result),
    //                 'bytes'
    //             );
    //             this.imgResultAfterResizeMax = result;
    //             this.productPhoto!.setValue(result);
    //         }
    //     );
    // }

    removePhoto(imageInput: any){
        this.selectedImage = undefined;
        this.selectedFileImage = undefined;
        imageInput.value = '';
    }

}