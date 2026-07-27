import { Component, OnInit } from '@angular/core';
import {first, map, startWith} from 'rxjs/operators';
import { AlertService, DataService, PagerState, PaginationStateService } from '@app/services';
import { ActivatedRoute } from '@angular/router';
import {
AbstractControl,
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';
import { BehaviorSubject, Observable, forkJoin } from 'rxjs';
import { RawMaterialByProvider } from '@app/models/raw-material/raw-material-by-provider.model';
import { Provider } from '@app/models/system/provider.model';

@Component({ 
    selector: 'page-list-raw-material-provider',
    templateUrl: 'list-raw-material-provider.component.html',
    styleUrls: ['list-raw-material-provider.component.scss']
})
export class ListRawMaterialByProviderComponent implements OnInit {

    rawMaterials?: RawMaterialByProvider[];
    allRawMaterials?: RawMaterialByProvider[];
    rawMaterialForm!: FormGroup;
    pager!: PagerState;
    readonly pageSizes = [8, 12, 24, 48, 96];
    pageSubtitle = 'Administra la materia prima por proveedor';
    searchTerm?: string;
    minDate: Date = new Date();
    nameOptions: string[] = ['Longaniza', 'Chorizo', 'Posta'];
    filteredNameOptions?: Observable<string[]>;
    establishmentOptions: string[] = ['La Democracia', 'La Esperanza', 'Los Altos'];
    filteredEstablishmentOptions?: Observable<string[]>;
    creatorUserOptions: string[] = ['User10', 'User21', 'User43'];
    filteredCreatorUserOptions?: Observable<string[]>;
    selectedProviderSubject: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(undefined);
    selectedProvider?: Provider;
    providerOptions?: Provider[];
    materialType = 1;
    pageTitle = 'Ingreso de proveedores';
    basePath = '/rawMaterialsByProvider';

    cards?: any[];
    savingOrder = false;

    constructor(private dataService: DataService, public _builder: FormBuilder, private route: ActivatedRoute, private alertService: AlertService, private paginationState: PaginationStateService) {}

    ngOnInit() {
        this.pager = this.paginationState.createPager(8);
        this.materialType = this.route.snapshot.data['materialType'] ?? 1;
        this.basePath = this.materialType === 2 ? '/empaques' : '/rawMaterialsByProvider';
        this.pageTitle = this.materialType === 2 ? 'Material de Empaque' : 'Ingreso de proveedores';
        this.pageSubtitle = this.materialType === 2 ? 'Administra el material de empaque por proveedor' : 'Administra la materia prima por proveedor';
        this.retriveRawMaterials();

        this.selectedProviderSubject.subscribe(value => {
            this.setProvider(String(value));
        });
    }

    setProvider(providerId: string){
        this.selectedProvider = this.providerOptions?.find(provid => provid.id === providerId);
        if(this.selectedProvider){
            this.getCards();
        }
    }

    retriveRawMaterials(){
        this.rawMaterials = undefined;

        let requestArray = [];
        requestArray.push(this.dataService.getAllRawMaterialsByProviderByFilterV2({"status_id": 34, "raw_material_by_provider_type_id": this.materialType}));
        requestArray.push(this.dataService.getAllProvidersByFilter({"status_id": 30})); // providerRequest

        forkJoin(requestArray).subscribe({
            next: (result: any) => {

                this.rawMaterials = this.dataService.findJsonValue(result[0], 'json_result') || [];
                this.allRawMaterials = this.rawMaterials;
                this.providerOptions = this.dataService.findJsonValue(result[1], 'json_result') || [];
            },
            error: (e) =>  console.error('Se ha producido un error al realizar una(s) de las peticiones', e),
            complete: () => {
                this.rawMaterials = this.rawMaterials?.filter(rm => (rm.rawMaterialByProviderTypeId ?? 1) === this.materialType);
                this.allRawMaterials = this.rawMaterials;
                this.getCards();
            }
        });

        // this.dataService.getAllRawMaterialsByProviderByFilter({"status": { "id": 2}})
        //     .pipe(first())
        //     .subscribe({
        //         next: (rawMaterials: any) => {
        //             this.rawMaterials = rawMaterials.retrieveRawMaterialByProviderResponse?.rawMaterial;
        //             this.allRawMaterials = this.rawMaterials;
        //             this.getCards();
        //         }
        //     });
    }

    getCards(){
        this.cards = [];
        if (this.rawMaterials && this.selectedProvider){
            this.rawMaterials.forEach(element => {
                if (element.provider?.id !== this.selectedProvider?.id) return;
                let descriptions = [
                    {name:'Proveedor', value: element.provider?.name},
                    {name:'Medida', value: element.rawMaterialBase?.measure?.identifier},
                    {name:'Descripción', value: element.rawMaterialBase?.description},
                    {name:'Última actualización', value: element.updatedDate ? this.dataService.getLocalDateTimeFromUTCTime(element.updatedDate) : null},
                ].filter(d => d.value != null && ('' + d.value).trim() !== '');
                let currentCard = {
                    title: element.rawMaterialBase?.name,
                    subtitle: element.price != null ? this.dataService.getFormatedPrice(Number(element.price)) : null,
                    photo: element.rawMaterialBase?.photo,
                    link: this.basePath + '/view/' + element.id,
                    descriptions: descriptions,
                    buttons: [
                        {title: 'Editar', value: 'edit_note', link: this.basePath + '/edit/' + element.id},
                        // {title: 'Eliminar', value: 'delete', link: this.basePath + '/delete/' + element.id},
                    ]
                };
                this.cards!.push(currentCard);
            });
        }
        this.pager.onDataChange(this.cards?.length ?? 0);
    }

    get sortItems() {
        // El orden se define por proveedor (dentro del tipo actual): sólo los del proveedor seleccionado.
        return (this.allRawMaterials ?? [])
            .filter(rm => rm.provider?.id === this.selectedProvider?.id)
            .map(rm => ({ id: rm.id!, title: rm.rawMaterialBase?.name, subtitle: rm.provider?.name }));
    }

    onSaveOrder(items: { id: string }[]) {
        this.savingOrder = true;
        const payload = items.map((it, index) => ({ id: it.id, sort_order: index }));
        this.dataService.updateRawMaterialByProviderSortOrder(payload)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.savingOrder = false;
                    this.alertService.success('Orden actualizado correctamente');
                    this.retriveRawMaterials();
                },
                error: () => {
                    this.savingOrder = false;
                    this.alertService.error('No se pudo actualizar el orden, intente nuevamente');
                }
            });
    }

    search(value: any): void {
        if (this.rawMaterials){
            this.rawMaterials = this.allRawMaterials?.filter((val) => {
                if(this.searchTerm){
                    const nameMatch = val.rawMaterialBase?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const measureMatch = val.rawMaterialBase?.measure?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const descriptionMatch = val.rawMaterialBase?.description?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const priceMatch = String(val.price ?? '').toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const providerMatch = val.provider?.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return nameMatch || measureMatch || descriptionMatch || priceMatch || providerMatch;
                }
                return true;
            });
            this.getCards();
        }
    }

}