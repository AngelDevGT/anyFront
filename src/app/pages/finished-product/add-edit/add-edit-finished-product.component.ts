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
import { RawMaterialBase } from '@app/models/raw-material/raw-material-base.model';
import { FinishedProduct } from '@app/models/product/finished-product.model';

@Component({ 
    selector: 'page-add-edit-finished-product',
    templateUrl: 'add-edit-finished-product.component.html',
    styleUrls: ['add-edit-finished-product.component.scss']
})
export class AddEditFinishedProductComponent implements OnInit{

    productForm!: FormGroup;
    currentProduct?: FinishedProduct;
    fileList: FileList | null | undefined;
    imagenCargada: string | ArrayBuffer | null | undefined;
    imgResultAfterResizeMax: DataUrl = '';
    id?: string;
    title!: string;
    loading = false;
    submitting = false;
    listMaxLength = {
        name : 50,
        description : 200
    };
    
    minDate: Date = new Date();

    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute,
        private imageCompress: NgxImageCompressService, private alertService: AlertService,
        private router: Router) {
    }

    ngOnInit(): void {

        this.id = this.route.snapshot.params['id'];

        this.productForm = this.createFormGroup();
        this.title = 'Crear Producto Terminado';

        if (this.id){
            
            this.title = 'Actualizar Producto Terminado';
            this.loading = true;

            this.dataService.getFinishedProductById(this.id)
                .pipe(
                    concatMap((prod: any) => {
                        let product = prod.getFinishedProductResponse.FinishedProduct;
                        if (product){
                            this.currentProduct = product;
                            this.productForm.patchValue(product);
                            if(product.photo){
                                return this.dataService.getImageById(product.photo);
                            }
                        }
                        this.loading = false;
                        return of(null);
                    })
                )
                .subscribe((img: any) => {
                    if(img){
                        let dataPhoto = img.getImageResponse.image.image;
                        if (dataPhoto){
                            this.imgResultAfterResizeMax = dataPhoto;
                            this.productPhoto!.setValue(dataPhoto);
                        }
                    }
                    this.loading = false;
                });
        }


    }

    onResetForm() {
        this.productForm.reset();
    }

    onSaveForm() {
        this.alertService.clear();
        this.submitting = true;
        this.saveRawMaterial()
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Producto Terminado guardado', { keepAfterRouteChange: true });
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

    get f() {
        return this.productForm.controls;
    }

    get productPhoto(){
        return this.productForm.get('photo');
    }

    saveRawMaterial(){
        if(this.id){
            let newProduct = {
                ...this.currentProduct,
                ...this.productForm.value
            };
            return this.dataService.updateFinishedProduct(this.id, newProduct, this.imgResultAfterResizeMax);
        }
        return this.dataService.addFinishedProduct(this.productForm.value, this.imgResultAfterResizeMax);
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