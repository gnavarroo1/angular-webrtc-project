import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MediasoupApiService {
  private apiMediasoup =
    environment.mediaSoupApiUrl + 'websocket/message-connection-handler';
  private _user_id!: string;
  private _session_id!: string;

  get user_id(): string {
    return this._user_id;
  }

  set user_id(value: string) {
    this._user_id = value;
  }
  get session_id(): string {
    return this._session_id;
  }

  set session_id(value: string) {
    this._session_id = value;
  }

  constructor(private http: HttpClient) {}

  requestMedia(payload: any) {
    return this.http.post<any>(this.apiMediasoup, {
      user_id: this._user_id,
      session_id: this._session_id,
      ...payload,
    });
  }
}
