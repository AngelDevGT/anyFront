import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent implements OnInit {

  isMenuCollapsed = true;

  constructor() { }

  ngOnInit() {
  }

  isCollapsedResponse(isCollapsed: boolean){
    this.isMenuCollapsed = isCollapsed;
  }

}