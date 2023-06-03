import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';
import {first, map, startWith} from 'rxjs/operators';
import { DataService } from '@app/services';

@Component({
    selector: 'app-card',
    templateUrl: './card.component.html',
    styleUrls: ['./card.component.scss']
})

export class CardComponent implements OnInit {
    @Input() cardElements: any;
    cardPhoto = '';

    constructor(private router: Router, private dataService: DataService) { }

    ngOnInit() {
        // if (this.cardElements['photo']){
        //     this.getImage(this.cardElements['photo'])
        // }
    }

    getImage(imageId : any){
    return this.dataService.getImageById(imageId)
                .pipe(first())
                .subscribe({
                    next: (img: any) => {
                        this.cardPhoto = img.getImageResponse.image.image;
                    }
                });
    }

}