import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { AccountService } from '@app/services';
import { FormControl, FormGroup } from '@angular/forms';
import { startWith, map } from 'rxjs/operators';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { User } from '@app/models/system/user.model';
import { OrdinaryObject } from '@app/models';
import { Router } from '@angular/router';

interface option {
  value?: string,
  viewValue?: string
}

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  @Input() isMenuCollapsed = true;
  @Output() isMenuCollapsedResponse: EventEmitter<boolean> = new EventEmitter();

  token: any;
  userId?: string;
  formControl?: FormControl;

  sesion$?: Observable<boolean>;
  userSub?: Observable<User | null>;
  existSession: boolean;
  control = new FormControl();
  searchInput = '';

  // resultList?: User[];
  // resultListSearch?: option[];
//   filteredResultList?: Observable<User[]>;

  // category = new FormControl();
  // categoryList: string[] = ['Usuario', 'Comunidad'];
  // selectedCategory = this.categoryList[0];


  constructor( private accountService: AccountService, private router: Router) {
    // this.existSession = sessionService.existSession();
    this.existSession = accountService.isActiveUser();
  }

  setIsMenuCollapsed(isCollapsed: boolean){
    this.isMenuCollapsedResponse.emit(!isCollapsed);
  }


  ngOnInit(): void {
    //Estas acciones solo las realiza cuando ocurre un cambio en la variable
    // this.sesion$ = this.sessionService.loggedIn$();//Lo convertimos en observador
    this.userSub = this.accountService.user;
    this.userSub.subscribe(usr => {
        this.existSession = false;
        if (usr){
            if (this.accountService.isActiveUser()) {
                this.existSession = true;
            }    
        }
    });
    // this.sesion$.subscribe(isSuscribe => {
    //   if (isSuscribe) {//isSuscribe nos devolvera el valor de la vaeable booleana, es decir la bariable observable
    //     this.dataService.getUserByToken(this.sessionService.getUserWithToken()).subscribe(response => {
    //       var user = response;
    //       this.sessionService.assignUserRolesWithSession(user);
    //       this.existSession = true;
    //       ////////////

    //       this.token = localStorage.getItem('token');
    //       this.token = JSON.parse(this.token).token;
          
    //       ///////////
    //     })
    //     //POST->Usuario
    //   } else {
    //     this.sessionService.assignUserRolesWithoutSession();
    //     this.existSession = false;
    //   }
    // });

    // this.filteredResultList = this.control.valueChanges.pipe(
    //   startWith(''),
    // );
  }

  logOut() {
    this.accountService.logout();
  }

  viewUser(){
    this.router.navigate(['/users/view/', this.accountService.userValue.userID]);
  }

//   updateResultList() {
//     if (this.selectedCategory == this.categoryList[0]) {
//       var aux = new User();
//       aux.token = this.token;
//       let search: OrdinaryObject = {
//         stringParam: this.searchInput
//       }
//       this.dataService.getUsersBySearch(search, aux)
//         .subscribe(data => {
//           this.resultListSearch = [];
//           data.forEach(dt => {
//             var opt: option = {
//               value: dt.registroAcademico,
//               viewValue: dt.nombreCompleto
//             }
//             this.resultListSearch.push(opt)
//           })
//         });
//     } else if (this.selectedCategory == this.categoryList[1]) {
//       var aux = new User();
//       aux.token = this.token;
//       let search: OrdinaryObject = {
//         stringParam: this.searchInput
//       }
//       this.dataService.getCommunitiesBySearch(search, aux)
//         .subscribe(data => {
//           this.resultListSearch = [];
//           data.forEach(dt => {
//             var opt: option = {
//               value: dt.id?.toString(),
//               viewValue: dt.nombre
//             }
//             this.resultListSearch.push(opt);
//           })
//         })
//     }

//   }

  // selectUser(rst: option) {
  //   if (this.selectedCategory == this.categoryList[0]) {
  //     this.searchInput = rst.viewValue!;
  //     this.router.navigate(['userProfile', rst.value]);
  //   } else if (this.selectedCategory == this.categoryList[1]) {
  //     this.searchInput = rst.viewValue!;
  //     this.router.navigate(['viewComunity', rst.value]);
  //   }
  // }

  onKey(event: any) {
    // console.log(this.searchInput);
    if (!this.token) {
      this.token = localStorage.getItem('token');
      this.token = JSON.parse(this.token).token;
    }
    // this.updateResultList();
    // console.log("Result:::: ",this.resultListSearch);
  }

//   goToPageUserProfile(){
//     this.dataService
//       .getUserByToken(this.sesionService.getUserWithToken())
//       .subscribe((response) => {
//         this.router.navigate(['userProfile', response.registroAcademico]);
//       });
//   }

}
