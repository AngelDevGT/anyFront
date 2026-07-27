import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';
import {first} from 'rxjs/operators';
import { DataService } from '@app/services';

@Component({
    selector: 'app-card',
    templateUrl: './card.component.html',
    styleUrls: ['./card.component.scss']
})

export class CardComponent implements OnInit {
    @Input() cardElements: any;
    loading = false;
    cardPhoto?: string;

    constructor(private router: Router, private dataService: DataService) { }

    ngOnInit() {
        // En listados se prioriza el thumbnail (más liviano); si no hay, se usa la imagen full.
        const imageId = this.cardElements['thumb'] || this.cardElements['photo'];
        if (imageId){
            this.loading = true;
            this.getImage(imageId)
            this.loading = false;
        }
    }

    getImage(imageId : any){
        this.cardPhoto = "https://storageembutidosany.blob.core.windows.net/image-container/" + imageId;
    // return this.dataService.getImageById(imageId)
    //             .pipe(first())
    //             .subscribe({
    //                 next: (img: any) => {
    //                     this.cardPhoto = img.getImageResponse.image.image;
    //                     this.loading = false;
    //                 }
    //             });
    }

}