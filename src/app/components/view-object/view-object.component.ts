import { Component, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import { first } from 'rxjs/operators';

import { AlertService, DataService } from '@app/services';
import { ActivatedRoute, Router } from '@angular/router';
import { Provider } from '@app/models/system/provider.model';

@Component({ 
    selector: 'view-object',
    templateUrl: 'view-object.component.html',
    styleUrls: ['view-object.component.scss']
})
export class ViewObjectComponent implements OnInit, OnChanges{
    @Input() objectElements?: any;
    @Input() imgIdentifier?: any;

    cardPhoto?: string;
    loading = false;

    constructor(private dataService: DataService, private alertService: AlertService,
        private route: ActivatedRoute, private router: Router) {
    }

    ngOnInit(): void {

        if (this.imgIdentifier){
            this.loadImage();
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['imgIdentifier']) {
            if (this.imgIdentifier){
                this.loadImage();
            }
        }
    }

    loadImage(){
        this.cardPhoto = this.dataService.getImageWithURL(this.imgIdentifier);
        // this.loading = true;
        //     this.dataService.getImageById(this.imgIdentifier)
        //         .pipe(first())
        //         .subscribe({
        //             next: (img: any) => {
        //                 this.cardPhoto = img.getImageResponse.image.image;
        //                 this.loading = false;
        //             }
        //     });
    }

}