import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SidebarStateService {
  private readonly STORAGE_KEY = 'sidebar_collapsed';
  private _collapsed = new BehaviorSubject<boolean>(this.loadState());
  private _mobileOpen = new BehaviorSubject<boolean>(false);

  collapsed$ = this._collapsed.asObservable();
  mobileOpen$ = this._mobileOpen.asObservable();

  private loadState(): boolean {
    try {
      return localStorage.getItem(this.STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  toggle() {
    const next = !this._collapsed.value;
    this._collapsed.next(next);
    try {
      localStorage.setItem(this.STORAGE_KEY, String(next));
    } catch {}
  }

  toggleMobile() {
    this._mobileOpen.next(!this._mobileOpen.value);
  }

  closeMobile() {
    this._mobileOpen.next(false);
  }

  get isCollapsed(): boolean {
    return this._collapsed.value;
  }
}
