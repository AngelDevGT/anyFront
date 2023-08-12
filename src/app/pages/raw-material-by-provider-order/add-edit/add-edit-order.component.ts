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

@Component({ 
    selector: 'page-add-edit-order',
    templateUrl: 'add-edit-order.component.html',
    styleUrls: ['add-edit-order.component.scss']
})
export class AddEditRawMateriaByProviderOrderComponent implements OnInit{

    //Form
    orderForm!: FormGroup;
    selectedProviderSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    providerOptions?: Provider[];
    constantes?: Constant[];
    rawMaterials?: RawMaterialByProvider[];
    allRawMaterials?: RawMaterialByProvider[];
    selectedRawMaterials?: InventoryElement[];
    rawMaterialOrderElements?: RawMaterialOrderElement[];
    totalDiscount = 0;
    subtotal = 0;
    total = 0;
    id?: string;
    title!: string;
    loading = true;
    submitting = false;
    hasErrors = false;
    
    minDate: Date = new Date();

    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute,
        private imageCompress: NgxImageCompressService, private alertService: AlertService,
        private router: Router) {

        this.selectedProviderSubject.subscribe(value => {
            this.setProvider(value);
        })
    }

    ngOnInit(): void {

        this.id = this.route.snapshot.params['id'];

        this.orderForm = this.createFormGroup();
        this.title = 'Crear Orden de Materia Prima';

        if (this.id){
            this.title = 'Actualizar Orden';
        }

        this.rawMaterials = [];
        this.allRawMaterials = this.rawMaterials;
        this.selectedRawMaterials = [];
        this.rawMaterialOrderElements = [];


        this.dataService.getAllProvidersByFilter({"status": 1})
            .pipe(first())
            .subscribe({
                next: (providers: any) => {
                    this.providerOptions = providers.retrieveProviderResponse?.providers;
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

    setProvider(provider: any){
        this.filterByProvider(provider);
    }

    filterByProvider(providerId: string){
        if(this.allRawMaterials){
            this.rawMaterials = this.allRawMaterials?.filter((val) => {
                return providerId === val.provider?._id;
            });
        }
    }


    changeProvider(e: any){
        this.providertSelect!.setValue(e.target.value, {
        onlySelf: true
        });
    }

    selectRawMaterial(rawMaterial: RawMaterialByProvider, indexToRemove: number){
        this.rawMaterials?.splice(indexToRemove, 1);
        let newOrderElement: RawMaterialOrderElement = {
            rawMaterialByProvider: rawMaterial,
            price: rawMaterial.price,
            discount: "0",
            quantity: "1"
        };
        this.rawMaterialOrderElements?.push(newOrderElement);
    }

    unselectRawMaterial(orderElement: RawMaterialOrderElement, indexToRemove: number){
        console.log(orderElement);
        this.rawMaterialOrderElements?.splice(indexToRemove, 1);
        this.rawMaterials?.push(orderElement.rawMaterialByProvider!);
    }

    // saveProvider(){
    //     return this.id
    //     ? this.dataService.updateProvider(this.id, this.providerForm.value)
    //     : this.dataService.addProvider(this.providerForm.value);
    // }

    calculateSubtotal() {
        let subtotal = 0;
        if (this.rawMaterialOrderElements){
            for(const orderElement of this.rawMaterialOrderElements){
                subtotal += Number(orderElement.price)*Number(orderElement.quantity) || 0;
            }
        }
        this.subtotal = subtotal;
        return subtotal;
    }

    calculateTotalDiscount() {
        let totalDiscount = 0;
        if (this.rawMaterialOrderElements){
            for (const orderElement of this.rawMaterialOrderElements) {
                totalDiscount += Number(orderElement.discount)*Number(orderElement.quantity) || 0;
            }
        }
        this.totalDiscount = totalDiscount;
        return totalDiscount;
    }

    calculateTotal(){
        this.total = this.subtotal - this.totalDiscount;
        return this.total;
    }

    createFormGroup() {
        return new FormGroup({
            name: new FormControl('', [
            Validators.required,
            Validators.minLength(1),
            Validators.maxLength(50),
          ]),
          comment: new FormControl('', [
            Validators.minLength(1),
            Validators.maxLength(100),
            ]),
          provider: new FormControl('', [Validators.required]),
          applyDate: new FormControl('', [Validators.required])
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

    onDiscountKeydown(event: KeyboardEvent) {
        const key = event.key;
    
        // Permitir solo teclas numéricas, punto decimal, teclas de navegación y eliminación
        if (!/^[0-9.]$/.test(key) && key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'Backspace' && key !== 'Delete') {
            event.preventDefault();
        }
    
        // Si ya hay un punto decimal en el input, no permitir otro
        if (key === '.' && (event.target as HTMLInputElement).value.includes('.')) {
            event.preventDefault();
        }
    }

    onDiscountInput(event: any, orderElement: RawMaterialOrderElement) {
        const input = event.target.value;
        let finalValue = "0";
    
        let maxValue = Number(orderElement.rawMaterialByProvider?.price);
        // const maxValue = 100; // Cambia este valor según tu necesidad
        const numericValue = parseFloat(input);
        if (!isNaN(numericValue) && numericValue > maxValue) {
            // event.target.value = maxValue.toFixed(2);
            finalValue = maxValue.toFixed(2);
        } else {
            // Limitar a dos decimales
            const match = input.match(/^\d*\.?\d{0,2}$/);
            if (match) {
                finalValue = match[0];
                // event.target.value = match[0];
            } else {
                finalValue = '';
                // event.target.value = ''; // Solo reiniciar si no hay coincidencia
            }
        }
        event.target.value = finalValue;
        orderElement.discount = finalValue;
    }

}