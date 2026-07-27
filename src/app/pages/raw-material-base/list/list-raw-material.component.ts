import { Component, OnInit } from '@angular/core';
import {first, map, startWith} from 'rxjs/operators';
import { AlertService, DataService, PagerState, PaginationStateService } from '@app/services';
import {
AbstractControl,
FormBuilder,
FormGroup,
Validators,
FormControl,
} from '@angular/forms';
import { Observable } from 'rxjs';
import { RawMaterialBase } from '@app/models/raw-material/raw-material-base.model';

@Component({ 
    selector: 'page-list-raw-material',
    templateUrl: 'list-raw-material.component.html',
    styleUrls: ['list-raw-material.component.scss']
})
export class ListRawMaterialComponent implements OnInit {

    rawMaterials?: RawMaterialBase[];
    allRawMaterials?: RawMaterialBase[];
    rawMaterialForm!: FormGroup;
    pager!: PagerState;
    readonly pageSizes = [8, 12, 24, 48, 96];
    pageTitle = 'Materia Prima';
    pageSubtitle = 'Administra las materias primas registradas';
    searchTerm?: string;
    minDate: Date = new Date();
    nameOptions: string[] = ['Longaniza', 'Chorizo', 'Posta'];
    filteredNameOptions?: Observable<string[]>;
    establishmentOptions: string[] = ['La Democracia', 'La Esperanza', 'Los Altos'];
    filteredEstablishmentOptions?: Observable<string[]>;
    creatorUserOptions: string[] = ['User10', 'User21', 'User43'];
    filteredCreatorUserOptions?: Observable<string[]>;

    cards?: any[];
    savingOrder = false;

    constructor(private dataService: DataService, public _builder: FormBuilder, private alertService: AlertService, private paginationState: PaginationStateService) {}

    ngOnInit() {
        this.pager = this.paginationState.createPager(8);
        this.retriveRawMaterials();
    }

    retriveRawMaterials(){
        this.rawMaterials = undefined;
        this.dataService.getAllRawMaterialsByFilterV3({"status_id": 32})
            .pipe(first())
            .subscribe({
                next: (rawMaterials: any) => {
                    this.rawMaterials = this.dataService.findJsonValue(rawMaterials, 'json_result') || [];
                    this.allRawMaterials = this.rawMaterials;
                    this.getCards();
                }
            });
    }

    getCards(){
        this.cards = [];
        if (this.rawMaterials){
            this.rawMaterials.forEach(element => {
                let descriptions = [
                    {name:'Descripción', value: element.description},
                    {name:'Creado', value: element.creationDate ? this.dataService.getLocalDateTimeFromUTCTime(element.creationDate) : null},
                    {name:'Última actualización', value: element.updatedDate ? this.dataService.getLocalDateTimeFromUTCTime(element.updatedDate) : null},
                ].filter(d => d.value != null && ('' + d.value).trim() !== '');
                let currentCard = {
                    title: element.name,
                    subtitle: element.measure?.identifier,
                    photo: element.photo,
                    thumb: element.thumb,
                    link: '/rawMaterials/view/' + element.id,
                    descriptions: descriptions,
                    buttons: [
                        {title: 'Editar', value: 'edit_note', link: '/rawMaterials/edit/' + element.id},
                        // {title: 'Eliminar', value: 'delete', link: '/rawMaterials/delete/' + element.id},
                    ]
                };
                this.cards!.push(currentCard);
            });
        }
        this.pager.onDataChange(this.cards?.length ?? 0);
    }

    get sortItems() {
        return (this.allRawMaterials ?? []).map(rm => ({ id: rm.id!, title: rm.name, subtitle: rm.measure?.identifier }));
    }

    onSaveOrder(items: { id: string }[]) {
        this.savingOrder = true;
        const payload = items.map((it, index) => ({ id: it.id, sort_order: index }));
        this.dataService.updateRawMaterialSortOrder(payload)
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
                    const nameMatch = val.name?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const measureMatch = val.measure?.identifier?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    const descriptionMatch = val.description?.toLowerCase().includes(this.searchTerm?.toLocaleLowerCase());
                    return nameMatch || measureMatch || descriptionMatch;
                }
                return true;
            });
            this.getCards();
        }
    }

}