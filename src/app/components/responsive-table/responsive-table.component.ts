import { Component, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from '@app/services';

@Component({
    selector: 'responsive-table',
    templateUrl: './responsive-table.component.html',
    styleUrls: ['./responsive-table.component.scss']
})

export class ResponsiveTableComponent implements OnInit, OnChanges {
    @Input() tableElements: any;
    @Input() pageSize: number = 0;
    
    page = 1;

    rows?: any[];
    headers?: any[];


    constructor(private router: Router, private dataService: DataService) {
    }

    ngOnInit() {
        this.updateTableElements();
        // this.cardElements['photo'] = undefined;
        // if (this.cardElements['photo']){
        //     this.getImage(this.cardElements['photo'])
        // } else {
        //     this.loading = false;
        // }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['tableElements']) {
            this.updateTableElements();
        }
    }

    // getImage(imageId : any){
    // return this.dataService.getImageById(imageId)
    //             .pipe(first())
    //             .subscribe({
    //                 next: (img: any) => {
    //                     this.cardPhoto = img.getImageResponse.image.image;
    //                     this.loading = false;
    //                 }
    //             });
    // }

    updateTableElements(){
        this.rows = this.tableElements.rows;
        this.headers = this.tableElements.headers;
    }

}