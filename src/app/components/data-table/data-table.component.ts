import { Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { PagerState, PaginationStateService, ScrollAnchor, ScrollMemoryService } from '@app/services';

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
    private readonly paginationState: PaginationStateService,
    private readonly scrollMemory: ScrollMemoryService,
    private readonly host: ElementRef<HTMLElement>
  ) {}

  private scrollRestored = false;

  /**
   * Llave del listado en sessionStorage: la misma que usa el paginador. Es un getter y no un
   * campo que se llena en ngOnInit porque ngOnChanges corre ANTES de ngOnInit, y es ahí donde
   * llegan las primeras filas y se intenta restaurar el scroll: con un campo, la llave estaba
   * vacía en ese momento y nunca encontraba lo guardado.
   */
  private get scrollKey(): string {
    return this.pageKey || this.router.url.split('?')[0];
  }

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
      if (this.rows.length) this.restoreScroll();
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

  /**
   * Identificador de una fila, para reencontrarla al volver de un detalle aunque haya cambiado de
   * lugar. Se usa lo primero que la fila trae que la distingue de las demás: rowKey (columna de
   * selección), rowLink (fila clickeable) o el primer enlace o botón que navega, que lleva el id
   * del registro ('view/<id>'). Sin ninguno, la fila no se puede reencontrar y se vuelve por
   * píxeles.
   */
  rowId(row: any): string | undefined {
    if (!row) return undefined;
    if (row.rowKey) return 'key:' + row.rowKey;
    if (row.rowLink) return 'link:' + row.rowLink;
    for (const cell of row) {
      if (cell?.type === 'link' && cell.routerLink) return 'link:' + cell.routerLink;
      if (cell?.type === 'button') {
        const button = cell.button?.find((b: any) => b.routerLink && !b.action);
        if (button) return 'link:' + button.routerLink;
      }
    }
    return undefined;
  }

  /**
   * Devuelve al usuario a donde estaba al abrir un detalle. Solo la primera vez que llegan filas
   * (los cambios posteriores por filtro o búsqueda no deben mover la pantalla) y solo si se
   * regresa de ese detalle (lo decide ScrollMemoryService).
   *
   * Primero busca la FILA desde la que se salió y la deja a la misma altura de la pantalla que
   * tenía: si entró un registro nuevo arriba y la fila bajó un lugar, se sigue viendo la misma
   * fila en el mismo sitio. Si la fila pasó a otra página, cambia a esa página. Si ya no está, usa
   * la posición en píxeles.
   *
   * Las filas se pintan en el ciclo de detección que sigue, y la página puede seguir creciendo un
   * momento (otros bloques que cargan, una segunda carga del listado), así que se reintenta unos
   * cuadros antes de darse por vencido.
   */
  private restoreScroll() {
    if (this.scrollRestored) return;
    this.scrollRestored = true;

    const saved = this.scrollMemory.consume(this.scrollKey);
    if (!saved) return;

    const maxAttempts = 30;
    let attempts = 0;
    const step = () => {
      attempts++;
      const lastAttempt = attempts >= maxAttempts;

      if (saved.rowId && this.scrollToRow(saved.rowId, saved.offset ?? 0, lastAttempt)) return;

      // Sin fila (o ya no aparece): la posición en píxeles, cuando la página alcance esa altura
      if (!saved.rowId || lastAttempt) {
        const reachable = document.documentElement.scrollHeight - window.innerHeight >= saved.y;
        if (reachable || lastAttempt) {
          window.scrollTo({ top: saved.y, behavior: 'auto' });
          return;
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /**
   * Lleva la fila `rowId` a `offset` píxeles del borde superior de la ventana. Devuelve true si lo
   * hizo; false si todavía no se puede (está en otra página y se acaba de cambiar, aún no está
   * pintada, la página no tiene altura suficiente) o si la fila ya no existe.
   */
  private scrollToRow(rowId: string, offset: number, force: boolean): boolean {
    const index = this.sortedRows.findIndex(row => this.rowId(row) === rowId);
    if (index < 0) return false;

    // La fila pudo pasar a otra página (entraron registros arriba): se cambia de página y se
    // espera a que se pinte
    const page = Math.floor(index / this.pager.pageSize) + 1;
    if (this.pager.page !== page) {
      this.pager.page = page;
      return false;
    }

    // Comparación de texto y no un selector CSS: el id puede traer caracteres que habría que escapar
    const element = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('tr[data-row-id]'))
      .find(tr => tr.getAttribute('data-row-id') === rowId);
    if (!element) return false;

    const top = Math.max(0, window.scrollY + element.getBoundingClientRect().top - offset);
    const reachable = document.documentElement.scrollHeight - window.innerHeight >= top;
    if (!reachable && !force) return false;

    window.scrollTo({ top, behavior: 'auto' });
    return true;
  }

  hasRowLink(row: any): boolean {
    return !!row?.rowLink;
  }

  onRowClick(row: any, event?: Event) {
    if (row?.rowLink) {
      this.navigateFromRow(row, event, row.rowLink, row.rowLinkQueryParams, row.rowLinkAbsolute);
    }
  }

  /** Navega desde una fila recordando cuál era y a qué altura de la pantalla estaba. */
  navigateFromRow(row: any, event: Event | undefined, routerLink: string, queryParams?: any, isAbsolute?: boolean) {
    const tr = (event?.target as HTMLElement | null)?.closest?.('tr');
    this.navigate(routerLink, queryParams, isAbsolute, {
      rowId: this.rowId(row),
      offset: tr ? tr.getBoundingClientRect().top : undefined
    });
  }

  navigate(routerLink: string, queryParams?: any, isAbsolute?: boolean, anchor?: ScrollAnchor) {
    if (!routerLink) return;
    const pathActual = this.router.url.split('?')[0];
    const newPath = isAbsolute ? routerLink : `${pathActual}/${routerLink}`;
    // Se guarda dónde estaba el usuario para volver al mismo lugar al regresar del detalle
    this.scrollMemory.save(this.scrollKey, newPath, anchor);
    if (queryParams) {
      this.router.navigate([newPath], { queryParams, queryParamsHandling: 'merge' });
    } else {
      this.router.navigate([newPath]);
    }
  }
}
