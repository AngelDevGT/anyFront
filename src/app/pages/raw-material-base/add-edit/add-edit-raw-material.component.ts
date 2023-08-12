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

@Component({ 
    selector: 'page-add-edit-raw-material',
    templateUrl: 'add-edit-raw-material.component.html',
    styleUrls: ['add-edit-raw-material.component.scss']
})
export class AddEditRawMaterialComponent implements OnInit{

    rawMaterialForm!: FormGroup;
    currentRawMaterial?: RawMaterialBase;
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

        this.rawMaterialForm = this.createFormGroup();
        this.title = 'Crear Materia Prima';

        if (this.id){
            
            this.title = 'Actualizar Materia Prima';
            this.loading = true;

            this.dataService.getRawMaterialById(this.id)
                .pipe(
                    concatMap((rawMat: any) => {
                        let rawMaterial = rawMat.GetRawMaterialResponse.rawMaterial;
                        if (rawMaterial){
                            this.currentRawMaterial = rawMaterial;
                            this.rawMaterialForm.patchValue(rawMaterial);
                            if(rawMaterial.photo){
                                return this.dataService.getImageById(rawMaterial.photo);
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
        this.rawMaterialForm.reset();
    }

    onSaveForm() {
        this.alertService.clear();
        this.submitting = true;
        this.saveRawMaterial()
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

    get f() {
        return this.rawMaterialForm.controls;
    }

    get productPhoto(){
        return this.rawMaterialForm.get('photo');
    }

    saveRawMaterial(){
        if(this.id){
            let newRawMaterial = {
                ...this.currentRawMaterial,
                ...this.rawMaterialForm.value
            };
            console.log("update", newRawMaterial);
            return this.dataService.updateRawMaterial(this.id, newRawMaterial, this.imgResultAfterResizeMax);
        }
        return this.dataService.addRawMaterial(this.rawMaterialForm.value, this.imgResultAfterResizeMax);
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