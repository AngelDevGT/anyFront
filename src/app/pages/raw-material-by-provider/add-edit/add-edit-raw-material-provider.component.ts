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

@Component({ 
    selector: 'page-add-edit-raw-material-provider',
    templateUrl: 'add-edit-raw-material-provider.component.html',
    styleUrls: ['add-edit-raw-material-provider.component.scss']
})
export class AddEditRawMateriaByProviderComponent implements OnInit{

    //Form
    rawMaterialForm!: FormGroup;
    currentRawMaterial?: RawMaterialByProvider;
    selectedProviderSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedProvider?: Provider;
    providerOptions?: Provider[];

    rawMaterials?: RawMaterialBase[];
    allRawMaterials?: RawMaterialBase[];
    selectedRawMaterial?: RawMaterialBase;

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

        this.selectedProviderSubject.subscribe(value => {
            this.setProvider(String(value));
        })
    }

    ngOnInit(): void {

        this.id = this.route.snapshot.params['id'];

        this.loading = true;

        this.rawMaterialForm = this.createFormGroup();
        this.title = 'Crear Materia Prima por Proveedor';

        if (this.id){
            this.title = 'Actualizar Materia Prima por Proveedor';
        }

        this.rawMaterials = [];
        this.allRawMaterials = this.rawMaterials;

        this.dataService.getAllProvidersByFilter({"status_id": 30})
            .pipe(
                concatMap((providers: any) => {
                    this.providerOptions = this.dataService.findJsonValue(providers, 'json_result') || [];
                    return this.dataService.getAllRawMaterialsByFilter({"status_id": 32});
                }),
                concatMap((rawMaterials: any) => {
                    this.rawMaterials = this.dataService.findJsonValue(rawMaterials, 'json_result') || [];
                    this.allRawMaterials = this.rawMaterials;
                    if(this.id){
                        return this.dataService.getRawMaterialByProviderById(this.id);
                    }
                    this.loading = false;
                    return of(null);    
                })
            )
            .subscribe((rawMat: any) => {
                if (rawMat){
                    let rawMaterial = this.dataService.findJsonValue(rawMat, 'json_result') || {};
                    this.currentRawMaterial = rawMaterial;
                    this.priceValue?.patchValue(this.currentRawMaterial?.price);
                    this.selectedRawMaterial = this.currentRawMaterial?.rawMaterialBase;
                }
                this.allRawMaterials = this.rawMaterials;
                this.loading = false;
            });

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
                    this.alertService.success('Materia Prima Por Proveedor guardado', { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/rawMaterialsByProvider');
                },
                error: error => {
                    let errorResponse = this.dataService.findJsonValue(error, 'error');
                    let ackError = this.dataService.findJsonValue(error, 'AcknowledgementDescription');
                    let errorMessage = 'Error al guardar la materia prima por proveedor, consulte con el administrador';
                    if (ackError && errorResponse) {
                        errorMessage = `${ackError}: ${errorResponse}`;
                    }
                    this.alertService.error(errorMessage);
                    this.submitting = false;
                }
            });
    }

    get f() {
        return this.rawMaterialForm.controls;
    }

    get priceValue() {
        return this.rawMaterialForm.get('price');
    }

    setProvider(providerId: string){
        if(providerId){
            this.selectedProvider = this.providerOptions?.find(prov => String(prov.id) === providerId);
        }
    }

    selectRawMaterial(rawMaterial: RawMaterialBase){
        this.selectedRawMaterial = rawMaterial;
        this.setRawMaterialElements(rawMaterial);
        // if(this.selectedRawMaterial.photo && this.selectedRawMaterial.photo !== ""){
        //     this.getImage(this.selectedRawMaterial.photo);
        // }
    }

    unselectRawMaterial(){
        this.selectedRawMaterial = undefined;
        this.elements = [];
        this.cardPhoto = undefined;
    }

    saveRawMaterial(){
        if(this.id){
            delete this.currentRawMaterial?.price;
            let updatedRawMaterial = {
                ...this.rawMaterialForm.value,
                ...this.currentRawMaterial
            }
            return this.dataService.updateRawMaterialByProvider(this.id, updatedRawMaterial);
        }
        let newRawMaterial = {
            ...this.rawMaterialForm.value,
            rawMaterialBase: this.selectedRawMaterial,
            provider: this.selectedProvider
        };
        return this.dataService.addRawMaterialByProvider(newRawMaterial);
    }

    createFormGroup() {
        return new FormGroup({
          price: new FormControl('', [
            Validators.required,
            Validators.pattern(/^\d+(\.\d{1,2})?$/),
          ]),
          provider: new FormControl('', [this.id ? Validators.nullValidator : Validators.required])
        });
    }

    setRawMaterialElements(rawMaterial: RawMaterialBase){
        this.elements.push({icon : "inventory_2", name : "Nombre", value : rawMaterial.name});
        this.elements.push({icon : "scale", name : "Medida", value : rawMaterial.measure?.identifier});
        this.elements.push({icon : "feed", name : "Descripción", value : rawMaterial.description});
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