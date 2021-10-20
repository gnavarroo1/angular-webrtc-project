import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Observable } from 'rxjs';
import { TokenManagerService } from '../services/token-manager.service';

@Injectable({
  providedIn: 'root',
})
export class LoggedInAuthGuard implements CanActivate {
  constructor(
    private tokenService: TokenManagerService,
    private router: Router
  ) {}
  canActivate(): boolean {
    const res = this.tokenService.hasAuthToken();
    if (res.hasAuthToken) {
      if (res.isExpired) {
        return true;
      }
      this.router.navigate(['/home']);
      return false;
    }
    return true;
  }
}
