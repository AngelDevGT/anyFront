import { Component, Input } from '@angular/core';

/**
 * Estado vacio de una seccion de Tienda a la que se entro sin tienda elegida: en lugar de datos, el
 * selector en grande. Lo usan los listados cuando la ruta trae el placeholder o una tienda que el
 * usuario no tiene asignada.
 */
@Component({
    selector: 'store-required',
    templateUrl: './store-required.component.html',
    styleUrls: ['./store-required.component.scss']
})
export class StoreRequiredComponent {
    @Input() message = 'Selecciona una tienda para continuar';
}
