import { Component, OnInit } from '@angular/core';
import {map, startWith} from 'rxjs/operators';

import { User } from '@app/models';
import { AccountService } from '@app/services';
import {
AbstractControl,
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';
import { Observable } from 'rxjs';

@Component({ 
    selector: 'page-view-product',
    templateUrl: 'view-product.component.html',
    styleUrls: ['view-product.component.scss']
})
export class ViewProductComponent implements OnInit {

    productForm!: FormGroup;
    pageSize = 5;
    page = 1;
    minDate: Date = new Date();
    nameOptions: string[] = ['Longaniza', 'Chorizo', 'Posta'];
    filteredNameOptions?: Observable<string[]>;
    establishmentOptions: string[] = ['La Democracia', 'La Esperanza', 'Los Altos'];
    filteredEstablishmentOptions?: Observable<string[]>;
    creatorUserOptions: string[] = ['User10', 'User21', 'User43'];
    filteredCreatorUserOptions?: Observable<string[]>;

    cards = [
        {
            title: 'Longaniza pequeña',
            descriptions : [
                {name:'Establecimiento:', value: 'Tienda Central'},
                {name:'Precio:', value: 'Q 1.50'},
                {name:'Fecha aplicacion:', value: '2023/05/05'}
            ],
            buttons: [
                {title: 'Ver producto', value: 'visibility'},
                {title: 'Editar producto', value: 'edit'},
                {title: 'Eliminar producto', value: 'delete'},
            ]
        },
        {
            title: 'Chorizo pequeño',
            descriptions : [
                {name:'Establecimiento:', value: 'Tienda Central'},
                {name:'Precio:', value: 'Q 1.50'},
                {name:'Fecha aplicacion:', value: '2023/05/05'}
            ],
            buttons: [
                {title: 'Ver producto', value: 'visibility'},
                {title: 'Editar producto', value: 'edit'},
                {title: 'Eliminar producto', value: 'delete'},
            ]
        },
        {
            title: 'Pasta de Longaniza',
            descriptions : [
                {name:'Establecimiento:', value: 'Tienda Central'},
                {name:'Precio:', value: 'Q 10.00'},
                {name:'Fecha aplicacion:', value: '2023/05/05'}
            ],
            buttons: [
                {title: 'Ver producto', value: 'visibility'},
                {title: 'Editar producto', value: 'edit'},
                {title: 'Eliminar producto', value: 'delete'},
            ]
        },
        {
            title: 'Pasta de Chorizo',
            descriptions : [
                {name:'Establecimiento:', value: 'Tienda Central'},
                {name:'Precio:', value: 'Q 10.00'},
                {name:'Fecha aplicacion:', value: '2023/05/05'}
            ],
            buttons: [
                {title: 'Ver producto', value: 'visibility'},
                {title: 'Editar producto', value: 'edit'},
                {title: 'Eliminar producto', value: 'delete'},
            ]
        },
        {
            title: 'Longaniza mediana',
            descriptions : [
                {name:'Establecimiento:', value: 'Tienda Central'},
                {name:'Precio:', value: 'Q 3.00'},
                {name:'Fecha aplicacion:', value: '2023/05/05'}
            ],
            buttons: [
                {title: 'Ver producto', value: 'visibility'},
                {title: 'Editar producto', value: 'edit'},
                {title: 'Eliminar producto', value: 'delete'},
            ]
        },
        {
            title: 'Chorizo mediano',
            descriptions : [
                {name:'Establecimiento:', value: 'Tienda Central'},
                {name:'Precio:', value: 'Q 3.00'},
                {name:'Fecha aplicacion:', value: '2023/05/05'}
            ],
            buttons: [
                {title: 'Ver producto', value: 'visibility'},
                {title: 'Editar producto', value: 'edit'},
                {title: 'Eliminar producto', value: 'delete'},
            ]
        }
    ];

    user: User | null;

    constructor(private accountService: AccountService, public _builder: FormBuilder) {
        this.user = this.accountService.userValue;
    }

    ngOnInit() {
        this.productForm = this.createFormGroup();
        this.filteredNameOptions = this.productForm.get('name')!.valueChanges.pipe(
            startWith(''),
            map(value => this._filter(value || '', this.nameOptions)),
        );
        this.filteredEstablishmentOptions = this.productForm.get('establishment')!.valueChanges.pipe(
            startWith(''),
            map(value => this._filter(value || '', this.establishmentOptions)),
        );
        this.filteredCreatorUserOptions = this.productForm.get('creatorUser')!.valueChanges.pipe(
            startWith(''),
            map(value => this._filter(value || '', this.creatorUserOptions)),
        )
    }

    private _filter(value: string, options: string[]): string[] {
        const filterValue = value.toLowerCase();

        return options.filter(option => option.toLowerCase().includes(filterValue));
    }

    enviar(values: any) {
        console.log(values);
    }

    createFormGroup() {
        return new FormGroup({
            name: new FormControl('', [Validators.maxLength(45)]),
            price: new FormControl('', [Validators.maxLength(45)]),
            establishment: new FormControl('', [Validators.maxLength(45)]),
            applyDate: new FormControl('', [Validators.maxLength(45)]),
            creatorUser: new FormControl('', [Validators.maxLength(45)]),
        });
    }

    filterProducts(){
        console.log('filterProducts...');
    }
}