import { Component } from '@angular/core';

import { User } from '@app/models';
import { AccountService } from '@app/services';

@Component({ templateUrl: 'home.component.html' })
export class HomeComponent {

    pageSize = 5;
    page = 1;

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

    constructor(private accountService: AccountService) {
        this.user = this.accountService.userValue;
    }
}