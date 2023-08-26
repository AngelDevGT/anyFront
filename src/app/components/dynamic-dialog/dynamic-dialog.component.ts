import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-dynamic-dialog',
  templateUrl: './dynamic-dialog.component.html',
  styleUrls: ['./dynamic-dialog.component.scss']
})
export class DynamicDialogComponent implements OnInit, OnChanges{
  @Input() data: any;
  // @Output() dialogForm = new EventEmitter<FormGroup>();
  @Output() valorRetornado = new EventEmitter<string>();
  dynamicForm!: FormGroup;

  notificarCambio() {
    const nuevoValor = "Nuevo valor desde el hijo";
    this.valorRetornado.emit(nuevoValor); // Emitir el evento con el nuevo valor
  }

  constructor(
    private formBuilder: FormBuilder) {}

  ngOnInit() {
    this.dynamicForm = this.formBuilder.group({});
    if(this.data){
      for (const fieldName in this.data.fields) {
        if (this.data.fields.hasOwnProperty(fieldName)) {
          this.dynamicForm.addControl(
            fieldName, new FormControl('', this.data.fields[fieldName].validators)
          );
        }
      }
    }
    console.log(this.data)
    // this.updateTableElements();
    // this.cardElements['photo'] = undefined;
    // if (this.cardElements['photo']){
    //     this.getImage(this.cardElements['photo'])
    // } else {
    //     this.loading = false;
    // }
}
  

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data']) {
        console.log(changes);
    }
  }

  get f() {
    return this.dynamicForm.controls;
  }

}
