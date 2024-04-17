import { Component, OnInit } from '@angular/core';

import { User } from '@app/models/system/user.model';
import { AccountService, DataService } from '@app/services';
import {
AbstractControl,
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';
import { RawMaterialOrder } from '@app/models/raw-material/raw-material-order.model';
import { forkJoin } from 'rxjs';
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { ShopResume } from '@app/models/store/shop-resume.model';
import { CashClosing } from '@app/models/store/cash-closing.model';

@Component({ 
    selector: 'app-home',
    templateUrl: 'home.component.html',
    styleUrls: ['home.component.scss']
})
export class HomeComponent implements OnInit{

    isLoading = true;
    rawMaterialOrders?: RawMaterialOrder[];
    productForSaleOrdes?: ProductForSaleStoreOrder[];
    shopResumes?: ShopResume[];
    cashClosings?: CashClosing[];
    stats?: any = {};

    constructor(private dataService: DataService) {
        
    }

    ngOnInit() {
        
        let requestArray = [];

        requestArray.push(this.dataService.getAllRawMaterialOrderByFilter({"status": 1}));
        requestArray.push(this.dataService.getAllProducForSaleOrder());
        requestArray.push(this.dataService.getShopHistory({}));
        requestArray.push(this.dataService.getAllCashClosingByFilter({}));
        forkJoin(requestArray).subscribe({
            next: (result: any) => {
                this.rawMaterialOrders = result[0].retrieveRawMaterialOrderResponse?.rawMaterial;
                this.productForSaleOrdes = result[1].retrieveProductForSaleStoreOrderResponse?.saleStoreOrder;
                this.shopResumes = result[2].retrieveShopHistoryResponse?.FinishedProducts;
                // this.cashClosings = result[3].retrieveStoreCashClosingResponse?.StoreCashClosing;
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.setStats();
                this.isLoading = false;
            }
        });
    }

    setStats(){
        let rawMaterialOrdersStats = {
            total: 0,
            active: 0,
            received: 0,
            verified: 0
        };

        let productForSaleOrdersStats = {
            total: 0,
            pending: 0,
            onWay: 0,
            received: 0,
            ready: 0
        };

        let storeSalesStats = {
            total: this.shopResumes?.length,
            pending: 0,
            received: 0,
            ready: 0
        };

        // let cashClosingStats = {
        //     total: 0,
        //     pending: 0,
        //     active: 0,
        //     verified: 0
        // };

        this.rawMaterialOrders?.forEach((order) => {
            rawMaterialOrdersStats.total++;
            if(order.status?.id == 2){
                rawMaterialOrdersStats.active++;
            } else if(order.status?.id == 10){
                rawMaterialOrdersStats.verified++;
            } else if(order.status?.id == 7){
                rawMaterialOrdersStats.received++;
            }
        });
        
        this.productForSaleOrdes?.forEach((order) => {
            productForSaleOrdersStats.total++;
            if(order.storeStatus?.id == 1){
                productForSaleOrdersStats.pending++;
            } else if(order.storeStatus?.id == 2){
                productForSaleOrdersStats.onWay++;
            } else if(order.storeStatus?.id == 7){
                productForSaleOrdersStats.ready++;
            } else if(order.storeStatus?.id == 3){
                productForSaleOrdersStats.received++;
            }
        });

        // this.cashClosings?.forEach((order) => {
        //     cashClosingStats.total++;
        //     if(order.status?.id == 10){
        //         cashClosingStats.verified++;
        //     } else if(order.status?.id == 2){
        //         cashClosingStats.active++;
        //     }
        
        // });

        this.stats.rawMaterialOrders = rawMaterialOrdersStats;
        this.stats.productForSaleOrders = productForSaleOrdersStats;
        this.stats.shopResumes = storeSalesStats;
        // this.stats.cashClosing = cashClosingStats;

    }

}