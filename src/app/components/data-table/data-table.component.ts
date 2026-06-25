import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'data-table',
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss']
})
export class DataTableComponent implements OnChanges {
  @Input() tableElements: any[][] = [];
  @Input() initialPageSize = 10;
  @Output() modalAction = new EventEmitter<{ target: string; data: any }>();

  headers: { header_name: string }[] = [];
  rows: any[][] = [];
  page = 1;
  pageSize = 10;
  readonly pageSizes = [5, 10, 25, 50, 100];
  sortColumn: number | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

  private readonly avatarPalette = [
    '#4361ee', '#3a86ff', '#7b2d8b', '#2ec4b6',
    '#e76f51', '#06d6a0', '#f72585', '#4cc9f0'
  ];

  constructor(private readonly router: Router) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tableElements']) {
      const data = this.tableElements;
      if (data?.length) {
        this.headers = data[0].map((cell: any) => ({ header_name: cell.header_name }));
        this.rows = data;
      } else {
        this.headers = [];
        this.rows = [];
      }
      this.page = 1;
    }
    if (changes['initialPageSize'] && changes['initialPageSize'].firstChange) {
      this.pageSize = this.initialPageSize;
    }
  }

  sort(colIndex: number) {
    if (this.sortColumn === colIndex) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = colIndex;
      this.sortDirection = 'asc';
    }
    this.page = 1;
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
    const start = (this.page - 1) * this.pageSize;
    return this.sortedRows.slice(start, start + this.pageSize);
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
