import { Injectable } from '@angular/core';
import { JwtHelperService } from '@auth0/angular-jwt';
import {
  IAuthTokenDecoded,
  IDecodeTokenResponse,
  IHasAuthTokenResponse,
} from '../types/helper.types';

const TOKEN_KEY = 'Authorization';

@Injectable({
  providedIn: 'root',
})
export class TokenManagerService {
  constructor(private jwtHelper: JwtHelperService) {}

  public getAuthToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  public saveAuthToken(token: string): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.setItem(TOKEN_KEY, token);
  }

  public hasAuthToken(): any {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      const decoded = this.jwtHelper.decodeToken<IAuthTokenDecoded>(token);
      const isExpired = this.jwtHelper.isTokenExpired(token);
      return {
        hasAuthToken: true,
        isExpired: isExpired,
        user: decoded,
      };
    }
    return {
      hasAuthToken: false,
    };
  }

  public saveMeetingRelatedTokens(key: string, value: string): void {
    localStorage.setItem(key, value);
  }
  public getMeetingRelatedTokens(key: string): string | null {
    return localStorage.getItem(key);
  }
  private static validateStringToken(text: string) {
    const pattern = /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/;
    return pattern.test(text);
  }

  public decodeToken(token: string): IDecodeTokenResponse {
    if (!TokenManagerService.validateStringToken(token)) {
      return {
        success: false,
        msg: 'URL INVÁLIDO!',
      };
    }
    if (this.jwtHelper.isTokenExpired(token)) {
      return {
        success: false,
        msg: 'EL ENLACE ENVIADO HA EXPIRADO!',
      };
    }

    return {
      success: true,
      msg: this.jwtHelper.decodeToken(token),
    };
  }
  public signOut() {
    localStorage.removeItem(TOKEN_KEY);
  }
}
