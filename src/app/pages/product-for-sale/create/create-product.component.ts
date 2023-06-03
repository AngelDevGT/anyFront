import { Component, OnInit } from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {first, map, startWith} from 'rxjs/operators';
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
import { Router } from '@angular/router';

@Component({ 
    selector: 'page-create-product',
    templateUrl: 'create-product.component.html',
    styleUrls: ['create-product.component.scss']
})
export class CreateProductComponent implements OnInit{

    productForm!: FormGroup;
    fileList: FileList | null | undefined;
    imagenCargada: string | ArrayBuffer | null | undefined;
    options: string[] = ['La Democracia', 'La Esperanza', 'Los Altos'];
    filteredOptions?: Observable<string[]>;
    selectedMeasureSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    measureOptions: boolean[] = [false, false]; // 0: price, 1: pricePerDozen
    imgResultAfterResizeMax: DataUrl = '';
    establishmentOptions?: Establishment[];
    id?: string;
    title!: string;
    loading = false;
    submitting = false;
    
    minDate: Date = new Date();

    constructor(private dataService: DataService, public _builder: FormBuilder, 
        private imageCompress: NgxImageCompressService, private alertService: AlertService,
        private router: Router) {
        this.retriveOptions();
        this.productForm = this.createFormGroup();
        this.selectedMeasureSubject.subscribe(value => {
            this.setMeasureOptions(value);
          });
        // this.minDate.setDate(this.minDate.getDate() - 1);
    }

    ngOnInit(): void {
        //this.buscarCursos();
        this.filteredOptions = this.productForm.get('establishment')!.valueChanges.pipe(
            startWith(''),
            map(value => this._filter(value || '')),
        );
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
        if(measure == 'unidad'){
            this.measureOptions[0] = true;
            this.measureOptions[1] = true;
        } else if (measure == 'peso'){
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
        return this.dataService.addProduct(this.productForm.value, this.imgResultAfterResizeMax);
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

    private _filter(value: string): string[] {
        const filterValue = value.toLowerCase();

        return this.options.filter(option => option.toLowerCase().includes(filterValue));
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