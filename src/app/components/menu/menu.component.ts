import {Component,OnInit,ViewChildren,Input,Output, AfterViewInit,QueryList,EventEmitter} from '@angular/core';
import {MatMenu, MatMenuPanel} from '@angular/material/menu'

@Component({
  selector: 'menu-component',
  templateUrl: 'menu.component.html',
})
export class MenuComponent implements OnInit,AfterViewInit {
  @Input() title:string = ""
  @Input() menu:any[] = []
  @Output() action:EventEmitter<any>=new EventEmitter<string>()

  //we are going to get all "mat-menu" using viewChildren
  @ViewChildren(MatMenu)matmenus!: QueryList<MatMenu>;
  menuItems:string[]=[]
  yet:boolean=false;
  submenus:any[]=[]
  ngOnInit(){
      this.createSubmenus(this.menu,"s0",1)
      this.reindex()
  }
  ngAfterViewInit(){
    //this avoid Angular give us errors, only when repaint the menu
    //we asign the [matMenutiggerFor]
    setTimeout(()=>{
        this.yet=true
        })
    }
    //simply call to the output
    onClick(value:any)
    {
      this.action.emit(value);
    }
    //return the "mat-menu" in the index selected
    getMenu(index: number): MatMenuPanel<any> | null
    {
      return index >= 0 && this.matmenus ? this.matmenus.find((x, i) => i == index) || null : null
    }
    reindex(){
      //asign the "index" of the menu item
      this.submenus.forEach(menu=>{
        menu.forEach((x:any)=>{
          if (x.subMenu!=-1)
            x.subMenu=this.menuItems.indexOf(x.action)
        })
      })
    }
    createSubmenus(menu:any[],prefix:string,count:number){
       //add to the array menuItems the "prefix"
       this.menuItems.push(prefix)
       //add to submenu an object to create the submenu
       this.submenus.push(menu.map((x:any,index:number)=>(
         { 
           label:x.button_name ? x.button_name : x.link_name,
           icon:x.button_icon,
           action:x.childs===null || x.childs===undefined?[x.router_link, x.query_params]:prefix+index,
           subMenu:x.childs===null || x.childs===undefined?-1:0
         }
       )))
       //if has children call the function for each child
       menu.forEach((x:any,index:number)=>{
          if (x.childs){
               this.createSubmenus(x.childs,prefix+index,count+1)
          }
       })
    }
}