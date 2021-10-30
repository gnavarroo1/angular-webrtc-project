import { Injectable } from '@angular/core';
import {
  ActivatedRoute,
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
  canActivate(route: ActivatedRouteSnapshot): boolean {
    const res = this.tokenService.hasAuthToken();
    const queryParams = route.queryParams;
    const returnUrl = queryParams.returnUrl ? queryParams.returnUrl : '/';
    if (res.hasAuthToken) {
      if (res.isExpired) {
        return true;
      }
      this.router.navigateByUrl(returnUrl);
      return false;
    }
    return true;
  }
}
