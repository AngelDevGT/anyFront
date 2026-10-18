import { Component } from '@angular/core';

import { AccountService, ScrollMemoryService } from '@app/services';
import { User } from './models/system/user.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'embutidos-any';

  user?: User | null;

    // ScrollMemoryService se inyecta acá solo para que exista desde la primera navegación
    constructor(private accountService: AccountService, private scrollMemory: ScrollMemoryService) {
        this.accountService.user.subscribe(x => this.user = x);
    }

    logout() {
        this.accountService.logout();
    }

}
