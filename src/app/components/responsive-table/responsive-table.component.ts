import { Component, OnInit, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '@app/services';

@Component({
    selector: 'responsive-table',
    templateUrl: './responsive-table.component.html',
    styleUrls: ['./responsive-table.component.scss']
})

export class ResponsiveTableComponent implements OnInit, OnChanges {
    @Input() tableElements: any;
    @Input() pageSize: number = 0;
    @Output() sentData = new EventEmitter<any>();
    
    page = 1;

    rows?: any[];
    headers?: any[];


    constructor(private router: Router) {
    }

    ngOnInit() {
        this.updateTableElements();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['tableElements']) {
            this.updateTableElements();
        }
    }

    updateTableElements(){
        this.rows = this.tableElements;
        this.headers = this.tableElements[0];
    }

    sendData(data: any){
        this.sentData.emit(data);
    }

    navigateWithParams(routerLink: string, queryParams?: { [key: string]: any }, isAbsolute?: boolean){
        const pathActual = this.router.url.split('?')[0];
        let newPath = `${pathActual}/${routerLink}`;
        if(isAbsolute){
            newPath = routerLink;
        }
        if(queryParams){
          this.router.navigate([newPath], { queryParams: queryParams, queryParamsHandling: 'merge' });
        } else {
          this.router.navigate([newPath]);
        }
    }

}