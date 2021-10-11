import { Component } from '@angular/core';
import {FormBuilder} from "@angular/forms";
import { Router } from '@angular/router';
@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})

export class RegisterComponent  {

  Roles: any = ['Admin', 'Author', 'Reader'];

  constructor(private fb: FormBuilder, private router: Router) { }

  goToLogin() {
    this.router.navigateByUrl('/login');
  }



}
