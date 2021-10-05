import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MediasoupApiService {
  private apiMediasoup =
    environment.mediaSoupApiUrl + 'websocket/message-connection-handler';
  private _userId!: string;
  private _sessionId!: string;

  get userId(): string {
    return this._userId;
  }

  set userId(value: string) {
    this._userId = value;
  }
  get sessionId(): string {
    return this._sessionId;
  }

  set sessionId(value: string) {
    this._sessionId = value;
  }

  constructor(private http: HttpClient) {}

  requestMedia(payload: any) {
    return this.http.post<any>(this.apiMediasoup, {
      userId: this._userId,
      sessionId: this._sessionId,
      ...payload,
    });
  }
}
