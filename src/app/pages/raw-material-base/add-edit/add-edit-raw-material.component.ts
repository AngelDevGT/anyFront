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
import { Measure } from '@app/models';

@Component({ 
    selector: 'page-add-edit-raw-material',
    templateUrl: 'add-edit-raw-material.component.html',
    styleUrls: ['add-edit-raw-material.component.scss']
})
export class AddEditRawMaterialComponent implements OnInit{

    rawMaterialForm!: FormGroup;
    currentRawMaterial?: RawMaterialBase;
    selectedMeasureSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedMeasure?: Measure;
    measureOptions?: Measure[];
    fileList: FileList | null | undefined;
    imagenCargada: string | ArrayBuffer | null | undefined;
    imgResultAfterResizeMax: DataUrl = '';
    id?: string;
    title!: string;
    loading = false;
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

        this.rawMaterialForm = this.createFormGroup();
        this.title = 'Crear Materia Prima';

        if (this.id){
            this.title = 'Actualizar Materia Prima';
        }

        this.loading = true;

        this.dataService.getAllConstantsByFilter({fc_id_catalog: "unitBase", enableElements: "true"})
            .pipe(
                concatMap((measures: any) => {
                    this.measureOptions = measures.retrieveCatalogGenericResponse.elements;
                    if (this.id){
                        return this.dataService.getRawMaterialById(this.id);
                    }
                    this.loading = false;
                    return of(null);
                })
            )
            .subscribe((rawMat: any) => {
                if (rawMat){
                    let rawMaterial = rawMat.GetRawMaterialResponse.rawMaterial;
                    if (rawMaterial){
                        this.currentRawMaterial = rawMaterial;
                        this.rawMaterialForm.patchValue(rawMaterial);
                        if(rawMaterial.photo){
                            this.selectedImage = this.dataService.getImageWithURL(rawMaterial.photo);
                        }
                    }
                }
                this.loading = false;
            });

    }

    onResetForm() {
        this.rawMaterialForm.reset();
    }

    onSaveForm() {
        this.alertService.clear();
        this.submitting = true;
        if(this.selectedFileImage){
            this.dataService.uploadImage(this.selectedFileImage)
            .pipe(
                concatMap((imgResponse: any) => {
                    let imgName = imgResponse.name;
                    return this.saveRawMaterial(imgName);
                })
            ).subscribe({
                next: () => {
                    this.alertService.success('Materia prima guardada', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/rawMaterials');
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
                imgName = this.currentRawMaterial?.photo;
            }
            this.saveRawMaterial(imgName)
                .pipe(first())
                .subscribe({
                    next: () => {
                        this.alertService.success('Materia prima guardada', { keepAfterRouteChange: true });
                        this.router.navigateByUrl('/rawMaterials');
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

    get f() {
        return this.rawMaterialForm.controls;
    }

    get productPhoto(){
        return this.rawMaterialForm.get('photo');
    }

    setMeasure(measureId: string){
        if(measureId){
            this.selectedMeasure = this.measureOptions?.find(meas => String(meas.id) === measureId);
        }
    }
    
    saveRawMaterial(imgName?: string){
        if(this.id){
            let newRawMaterial = {
                ...this.currentRawMaterial,
                ...this.rawMaterialForm.value
            };
            return this.dataService.updateRawMaterial(this.id, newRawMaterial, imgName);
        }
        let newRawMaterial = {
            ...this.rawMaterialForm.value,
            measure: this.selectedMeasure
        }
        return this.dataService.addRawMaterial(newRawMaterial, imgName);
    }

    createFormGroup() {
        return new FormGroup({
          name: new FormControl('', [
            Validators.required
          ]),
          measure: new FormControl('', [Validators.required]),
          description: new FormControl('', [
            // Validators.required
          ]),
        //   photo: new FormControl('')
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

    removePhoto(imageInput: any){
        // this.imgResultAfterResizeMax = '';
        // this.productPhoto!.setValue('');
        this.selectedImage = undefined;
        this.selectedFileImage = undefined;
        imageInput.value = '';
    }

    onFileSelected(event: any): void {
        this.selectedFileImage = event.target.files[0];
        console.log(this.selectedFileImage);
        const reader = new FileReader();
            reader.onload = (e: any) => {
            this.selectedImage = e.target.result;
            };
        reader.readAsDataURL(this.selectedFileImage!);
        // if (file) {
        //     if (file.size > this.maxFileSize) {
        //       console.log('El archivo es demasiado grande. Tamaño máximo permitido: 10MB');
        //       // Puedes mostrar un mensaje de error al usuario si lo deseas.
        //     } else {
        //       // Cargar la imagen como URL de datos (data URL)
        //       const reader = new FileReader();
        //       reader.onload = (e: any) => {
        //         this.selectedImage = e.target.result;
        //       };
        //       reader.readAsDataURL(file);
        //     }
        //   }
        // this.imageUploadService.uploadImage(file);
    }

}