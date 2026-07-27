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
    productType = 1;
    basePath = '/finishedProducts';
    maxFileSize = 10485760;
    listMaxLength = {
        name : 50,
        description : 200
    };
    selectedImage?: string;
    selectedFileImage?: File;
    selectedFileThumb?: File;

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
        this.productType = this.route.snapshot.data['productType'] ?? 1;
        this.basePath = this.productType === 2 ? '/abarrotes' : '/finishedProducts';

        this.productForm = this.createFormGroup();
        this.title = this.productType === 2 ? 'Crear Abarrote' : 'Crear Producto Terminado';

        let requestArray = [];

        requestArray.push(this.dataService.getAnyComponent({}, 'getUnitBase')); // measureRequest
        if (this.id){
            this.title = this.productType === 2 ? 'Actualizar Abarrote' : 'Actualizar Producto Terminado';
            requestArray.push(this.dataService.getFinishedProductByIdV2(this.id));
        }

        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.measureOptions = this.dataService.findJsonValue(result[0], 'json_result') || {};
                if (this.id){
                    this.currentProduct = this.dataService.findJsonValue(result[1], 'json_result') || {};
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
            // Se suben full y thumb en paralelo; cada uno recibe su propio nombre del backend.
            forkJoin({
                full: this.dataService.uploadImage(this.selectedFileImage),
                thumb: this.dataService.uploadImage(this.selectedFileThumb!)
            })
            .pipe(
                concatMap((res: any) => {
                    return this.saveFinishedProduct(res.full?.name, res.thumb?.name);
                })
            ).subscribe({
                next: () => {
                    this.alertService.success('Producto terminado guardado', { keepAfterRouteChange: true });
                    this.router.navigateByUrl(this.basePath);
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
            let thumbName = undefined;
            if(this.selectedImage && this.selectedImage !== ""){
                imgName = this.currentProduct?.photo;
                thumbName = this.currentProduct?.thumb;
            }
            this.saveFinishedProduct(imgName, thumbName)
                .pipe(first())
                .subscribe({
                    next: () => {
                        this.alertService.success('Producto terminado guardado', { keepAfterRouteChange: true });
                        this.router.navigateByUrl(this.basePath);
                    },
                    error: error => {
                        let errorResponse = this.dataService.findJsonValue(error, 'error');
                        let ackError = this.dataService.findJsonValue(error, 'AcknowledgementDescription');
                        let errorMessage = 'Error al guardar el producto terminado, consulte con el administrador';
                        if (ackError && errorResponse) {
                            errorMessage = `${ackError}: ${errorResponse}`;
                        }
                        this.alertService.error(errorMessage);
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

    saveFinishedProduct(imgName?: string, thumbName?: string){
        if(this.id){
            let newProduct = {
                ...this.currentProduct,
                ...this.productForm.value
            };
            return this.dataService.updateFinishedProductV2(this.id, newProduct, imgName, thumbName);
        }
        let newProduct = {
            ...this.productForm.value,
            measure: this.selectedMeasure,
            finishedProductTypeId: this.productType
        }
        return this.dataService.addFinishedProductV2(newProduct, imgName, thumbName);
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
        const file: File = event.target.files[0];
        if (!file) { return; }
        const reader = new FileReader();
        reader.onload = async (e: any) => {
            const originalDataUrl: string = e.target.result;
            try {
                // full: se limita a 1280px de lado mayor con calidad 75
                const fullDataUrl = await this.imageCompress.compressFile(
                    originalDataUrl, DOC_ORIENTATION.Default, 100, 75, 1280, 1280);
                // thumb: miniatura de 300px con calidad 70 (para listados)
                const thumbDataUrl = await this.imageCompress.compressFile(
                    originalDataUrl, DOC_ORIENTATION.Default, 100, 70, 300, 300);

                this.selectedImage = fullDataUrl; // preview
                this.selectedFileImage = this.dataUrlToFile(fullDataUrl, file.name);
                this.selectedFileThumb = this.dataUrlToFile(thumbDataUrl, this.buildThumbName(file.name));
            } catch (err) {
                console.error('Error al comprimir la imagen', err);
                this.alertService.error('No se pudo procesar la imagen seleccionada');
            }
        };
        reader.readAsDataURL(file);
    }

    /** Convierte un DataUrl (base64) en un objeto File para subirlo vía FormData. */
    private dataUrlToFile(dataUrl: string, fileName: string): File {
        const [header, base64] = dataUrl.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        const binary = atob(base64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        return new File([array], fileName, { type: mime });
    }

    /** Inserta el sufijo _thumb antes de la extensión (foto.jpg -> foto_thumb.jpg). */
    private buildThumbName(fileName: string): string {
        return fileName.replace(/(\.[^.]+)$/, '_thumb$1');
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
        this.selectedFileThumb = undefined;
        imageInput.value = '';
    }

}