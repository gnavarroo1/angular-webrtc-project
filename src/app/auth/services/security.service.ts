import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root',
})
export class SecurityService {
  constructor(private http: HttpClient) {}

  login(data: any): Observable<any> {
    return this.http.post(
      environment.apiServer.api.url + environment.apiServer.api.methods.login,
      data
    );
  }
  register(data: any): Observable<any> {
    return this.http.post(
      environment.apiServer.api.url +
        environment.apiServer.api.methods.register,
      data
    );
  }
  forgotPassword(data: any): Observable<any> {
    return this.http.post(
      environment.apiServer.api.url +
        environment.apiServer.api.methods.forgotPassword,
      data
    );
  }
  verifyEmail(data: any): Observable<any> {
    return this.http.post(
      environment.apiServer.api.url +
        environment.apiServer.api.methods.verifyEmail,
      data
    );
  }
  resetPassword(data: any): Observable<any> {
    return this.http.post(
      environment.apiServer.api.url +
        environment.apiServer.api.methods.resetPassword,
      data
    );
  }
  resendConfirmationEmail(data: any): Observable<any> {
    return this.http.post(
      environment.apiServer.api.url +
        environment.apiServer.api.methods.resendConfirmationEmail,
      data
    );
  }
}
