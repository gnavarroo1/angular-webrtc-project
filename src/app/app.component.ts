import { Component, OnInit } from '@angular/core';
import { AuthService } from './core/services/auth.service';
import { TokenManagerService } from './core/services/token-manager.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  title = 'test-sfu';
  constructor(
    private authService: AuthService,
    private tokenManagerService: TokenManagerService
  ) {}

  ngOnInit() {
    const result = this.tokenManagerService.hasAuthToken();
    console.log(result);
    if (!result.hasAuthToken || result.isExpired) {
      this.authService.createTemporalUser().subscribe((data) => {
        console.log(data);
        this.tokenManagerService.saveAuthToken(data.accessToken);
      });
    }
  }
}
