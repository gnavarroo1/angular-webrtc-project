import { Component } from '@angular/core';
import { AuthService } from './shared/services/auth.service';
import { TokenManagerService } from './shared/services/token-manager.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'test-sfu';

  constructor(
    private authService: AuthService,
    private activatedRoute: ActivatedRoute,
    private tokenManagerService: TokenManagerService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  get isLoggedIn(): boolean {
    return !!this.tokenManagerService.getAuthToken();
  }

  goToLogin() {
    const queryParams = this.route.snapshot.queryParams;
    const returnUrl = queryParams.returnUrl ? queryParams.returnUrl : '/';
    this.router.navigate(['/login'], {
      queryParams: {
        returnUrl: returnUrl,
      },
    });
  }
  goToRegister() {
    const queryParams = this.route.snapshot.queryParams;
    const returnUrl = queryParams.returnUrl ? queryParams.returnUrl : '/';
    this.router.navigate(['/register'], {
      queryParams: {
        returnUrl: returnUrl,
      },
    });
  }

  get isLoginUrl(): boolean {
    return this.router.url.includes('/login');
  }
  get isRegisterUrl(): boolean {
    return this.router.url.includes('/register');
  }
  get isMeetingUrl(): boolean {
    return this.router.url.includes('/meetings');
  }

  logout(): void {
    this.tokenManagerService.signOut();
    this.router.navigate(['/login']);
  }
}
