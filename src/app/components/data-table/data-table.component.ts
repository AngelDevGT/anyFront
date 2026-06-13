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

  get pagedRows(): any[][] {
    const start = (this.page - 1) * this.pageSize;
    return this.rows.slice(start, start + this.pageSize);
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
