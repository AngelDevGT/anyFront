import { NgModule, ModuleWithProviders } from '@angular/core';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

@NgModule({
  imports: [
    NgbModule,
    // module that are a core part of your app such as appollo-angular, angularfire modules, etc
  ],
  providers: [],
  exports: [NgbModule],
})
export class CoreModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: CoreModule,
    };
  }
  static forChild(): ModuleWithProviders {
    return {
      ngModule: CoreModule,
      providers: [],
    };
  }
}
