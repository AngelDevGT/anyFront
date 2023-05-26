import { Component, OnInit } from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {map, startWith} from 'rxjs/operators';
import {
    DataUrl,
    DOC_ORIENTATION,
    NgxImageCompressService,
    UploadResponse,
} from 'ngx-image-compress';

import { User } from '@app/models';
import { AccountService } from '@app/services';
import {
AbstractControl,
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';

@Component({ 
    selector: 'page-create-product',
    templateUrl: 'create-product.component.html',
    styleUrls: ['create-product.component.scss']
})
export class CreateProductComponent implements OnInit{

    user: User | null;
    productForm!: FormGroup;
    fileList: FileList | null | undefined;
    imagenCargada: string | ArrayBuffer | null | undefined;
    options: string[] = ['La Democracia', 'La Esperanza', 'Los Altos'];
    filteredOptions?: Observable<string[]>;
    selectedMeasureSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    measureOptions: boolean[] = [false, false]; // 0: price, 1: pricePerDozen
    imgResultAfterResizeMax: DataUrl = '';
    
    minDate: Date = new Date();

    constructor(private accountService: AccountService, public _builder: FormBuilder, private imageCompress: NgxImageCompressService) {
        this.user = this.accountService.userValue;
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

    onResetForm() {
        this.productForm.reset();
    }

    onSaveForm() {
        console.log(this.productForm.value);
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

    cargarImagen(e: Event) {
        const element = e.currentTarget as HTMLInputElement;
        this.fileList = element.files;
        if (this.fileList) {
            const target = e.target as HTMLInputElement;
            const file: File = (target.files as FileList)[0];
            const reader = new FileReader();
            reader.onload = (e) => (this.imagenCargada = reader.result);
            reader.readAsDataURL(file);
        }
    }

    changeMeasure(e: any){
        this.measureSelect!.setValue(e.target.value, {
        onlySelf: true
        });
    }

    createFormGroup() {
        return new FormGroup({
            productName: new FormControl('', [
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