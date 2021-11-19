import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-p500',
  templateUrl: './error-page.component.html',
  styleUrls: ['./error-page.component.css'],
})
export class ErrorPageComponent {
  txtError = '';
  constructor(private router: Router) {
    const currentNavigation = this.router.getCurrentNavigation();
    // console.log(currentNavigation);
    if (currentNavigation) {
      const state = currentNavigation.extras.state;
      if (state) {
        this.txtError = state.errorMessage;
      }
    }
  }
}
