import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { PagerState, PaginationStateService } from '@app/services';

@Component({
  selector: 'data-table',
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss']
})
export class DataTableComponent implements OnInit, OnChanges {
  @Input() tableElements: any[][] = [];
  @Input() initialPageSize = 10;
  // Habilita la columna de checkboxes. Cada fila debe traer la propiedad 'rowKey' con su identificador.
  @Input() selectable = false;
  // Identificador para recordar la pagina del listado; por defecto se usa la ruta actual.
  @Input() pageKey?: string;
  @Output() modalAction = new EventEmitter<{ target: string; data: any }>();
  @Output() selectionChange = new EventEmitter<string[]>();

  headers: { header_name: string }[] = [];
  rows: any[][] = [];
  selectedKeys = new Set<string>();
  pager!: PagerState;
  readonly pageSizes = [5, 10, 25, 50, 100];
  sortColumn: number | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

  private readonly avatarPalette = [
    '#4361ee', '#3a86ff', '#7b2d8b', '#2ec4b6',
    '#e76f51', '#06d6a0', '#f72585', '#4cc9f0'
  ];

  constructor(
    private readonly router: Router,
    private readonly paginationState: PaginationStateService
  ) {}

  ngOnInit() {
    this.buildPager();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Corre antes de ngOnInit, asi el pager ya existe cuando se restaura la pagina guardada.
    this.buildPager();
    if (changes['tableElements']) {
      const data = this.tableElements;
      if (data?.length) {
        this.headers = data[0].map((cell: any) => ({ header_name: cell.header_name }));
        this.rows = data;
      } else {
        this.headers = [];
        this.rows = [];
      }
      this.pager.onDataChange(this.rows.length);
      if (this.selectable) this.syncSelection();
    }
  }

  /** El tamano de pagina guardado tiene prioridad sobre el que define la pagina contenedora. */
  private buildPager() {
    if (!this.pager) {
      this.pager = this.paginationState.createPager(this.initialPageSize, this.pageKey);
    }
  }

  /**
   * Las filas se reconstruyen en cada busqueda/orden/filtro, asi que se conserva la seleccion
   * de los elementos que siguen presentes en lugar de limpiarla.
   */
  private syncSelection() {
    const availableKeys = new Set(this.rowKeys());
    const previousSize = this.selectedKeys.size;
    this.selectedKeys.forEach(key => {
      if (!availableKeys.has(key)) this.selectedKeys.delete(key);
    });
    // Se difiere el emit porque ngOnChanges corre dentro de la deteccion de cambios del padre
    if (this.selectedKeys.size !== previousSize) Promise.resolve().then(() => this.emitSelection());
  }

  private rowKeys(): string[] {
    return this.rows.map(row => (row as any).rowKey).filter((key: string) => !!key);
  }

  private emitSelection() {
    // Se emite en el orden en el que se muestran las filas
    this.selectionChange.emit(this.rowKeys().filter(key => this.selectedKeys.has(key)));
  }

  getRowKey(row: any): string {
    return row?.rowKey;
  }

  isRowSelected(row: any): boolean {
    return this.selectedKeys.has(this.getRowKey(row));
  }

  toggleRow(row: any, event: Event) {
    event.stopPropagation();
    const key = this.getRowKey(row);
    if (!key) return;
    if (this.selectedKeys.has(key)) {
      this.selectedKeys.delete(key);
    } else {
      this.selectedKeys.add(key);
    }
    this.emitSelection();
  }

  get allSelected(): boolean {
    const keys = this.rowKeys();
    return keys.length > 0 && keys.every(key => this.selectedKeys.has(key));
  }

  get someSelected(): boolean {
    return this.selectedKeys.size > 0 && !this.allSelected;
  }

  /** Aplica sobre todas las filas filtradas, no solo sobre la pagina visible */
  toggleAll(event: Event) {
    event.stopPropagation();
    if (this.allSelected) {
      this.selectedKeys.clear();
    } else {
      this.rowKeys().forEach(key => this.selectedKeys.add(key));
    }
    this.emitSelection();
  }

  clearSelection() {
    this.selectedKeys.clear();
    this.emitSelection();
  }

  sort(colIndex: number) {
    if (this.sortColumn === colIndex) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = colIndex;
      this.sortDirection = 'asc';
    }
    this.pager.page = 1;
  }

  get sortedRows(): any[][] {
    if (this.sortColumn === null) return this.rows;
    return [...this.rows].sort((a, b) => {
      const valA = a[this.sortColumn!]?.value ?? '';
      const valB = b[this.sortColumn!]?.value ?? '';
      const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
      return this.sortDirection === 'asc' ? cmp : -cmp;
    });
  }

  get pagedRows(): any[][] {
    const start = (this.pager.page - 1) * this.pager.pageSize;
    return this.sortedRows.slice(start, start + this.pager.pageSize);
  }

getInitials(name: string): string {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  getAvatarColor(name: string): string {
    if (!name) return this.avatarPalette[0];
    return this.avatarPalette[name.charCodeAt(0) % this.avatarPalette.length];
  }

  badgeClass(identifier: string): string {
    return 'dt-badge-' + (identifier?.toLowerCase().replace(/\s+/g, '-') || '');
  }

  emitModalAction(target: string, data: any) {
    this.modalAction.emit({ target, data });
  }

  hasRowLink(row: any): boolean {
    return !!row?.rowLink;
  }

  onRowClick(row: any) {
    if (row?.rowLink) {
      this.navigate(row.rowLink, row.rowLinkQueryParams, row.rowLinkAbsolute);
    }
  }

  navigate(routerLink: string, queryParams?: any, isAbsolute?: boolean) {
    if (!routerLink) return;
    const pathActual = this.router.url.split('?')[0];
    const newPath = isAbsolute ? routerLink : `${pathActual}/${routerLink}`;
    if (queryParams) {
      this.router.navigate([newPath], { queryParams, queryParamsHandling: 'merge' });
    } else {
      this.router.navigate([newPath]);
    }
  }
}
