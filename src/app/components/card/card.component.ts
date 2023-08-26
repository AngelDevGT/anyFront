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
        // this.cardElements['photo'] = undefined;
        if (this.cardElements['photo']){
            this.loading = true;
            this.getImage(this.cardElements['photo'])
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