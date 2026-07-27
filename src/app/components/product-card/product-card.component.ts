import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'app-product-card',
    templateUrl: './product-card.component.html',
    styleUrls: ['./product-card.component.scss']
})

export class ProductCardComponent implements OnInit {
    @Input() cardElements: any;
    loading = false;
    cardPhoto?: string;

    constructor(private router: Router) { }

    ngOnInit() {
        // En listados se prioriza el thumbnail (más liviano); si no hay, se usa la imagen full.
        const imageId = this.cardElements['thumb'] || this.cardElements['photo'];
        if (imageId) {
            this.loading = true;
            this.getImage(imageId);
            this.loading = false;
        }
    }

    getImage(imageId: any) {
        this.cardPhoto = "https://storageembutidosany.blob.core.windows.net/image-container/" + imageId;
    }

    onCardClick() {
        // Al hacer click en la card se ejecuta la acción de "ver".
        const link = this.cardElements['link'];
        if (link) {
            this.router.navigate([link], { queryParams: this.cardElements['params'] || {} });
        }
    }

    onOption(button: any, event: Event) {
        // Evita que el click en una opción del menú dispare la acción de la card.
        event.stopPropagation();
        if (button?.link) {
            this.router.navigate([button.link], { queryParams: button.params || {} });
        }
    }
}
