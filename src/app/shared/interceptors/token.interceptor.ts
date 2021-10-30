import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HTTP_INTERCEPTORS,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { TokenManagerService } from '../services/token-manager.service';
import { environment } from '../../../environments/environment';

const TOKEN_HEADER_KEY = 'Authorization';

@Injectable({
  providedIn: 'root',
})
export class TokenInterceptor implements HttpInterceptor {
  constructor(private tokenManagerService: TokenManagerService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    const authToken = this.tokenManagerService.getAuthToken();
    let requestCopy = req;
    if (authToken) {
      requestCopy = req.clone({
        headers: req.headers.set(
          environment.token.authHeaderKey,
          `Bearer ${authToken}`
        ),
      });
    }
    if (!requestCopy.headers.has('Content-Type')) {
      requestCopy = requestCopy.clone({
        setHeaders: {
          'content-type': 'application/json',
        },
      });
    }
    requestCopy = requestCopy.clone({
      headers: requestCopy.headers.set('Accept', 'application/json'),
    });
    return next.handle(requestCopy);
  }
}
export const interceptorProviders = [
  { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
];
