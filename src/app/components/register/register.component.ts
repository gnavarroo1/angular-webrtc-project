import { Component } from '@angular/core';
import {FormBuilder} from "@angular/forms";

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})

export class RegisterComponent  {

  Roles: any = ['Admin', 'Author', 'Reader'];

  constructor(private fb: FormBuilder) { }

  isLogin = true;



}
