import { Component, OnInit } from '@angular/core';
import { AuthService } from './core/services/auth.service';
import { TokenManagerService } from './core/services/token-manager.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'test-sfu';
  constructor(
    private authService: AuthService,
    private tokenManagerService: TokenManagerService
  ) {}
}
