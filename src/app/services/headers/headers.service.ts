import { HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class HeadersService {

  constructor() { }

  obtenerHeaderConToken(token: string): any{
    let headers = new HttpHeaders({    
      'Authorization': 'Bearer '+token,
    });
    let options = { headers: headers };
    return options
  }
}
