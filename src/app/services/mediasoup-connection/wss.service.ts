import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { Observable } from 'rxjs';

import { NGXLogger } from 'ngx-logger';
import { IMemberIdentifier } from '../../types/defines';
import { environment } from '../../../environments/environment';
import { MediasoupSocket } from '../../types/custom-sockets';

@Injectable({
  providedIn: 'root',
})
export class WssService {
  private _socket!: MediasoupSocket;
  get socket(): MediasoupSocket {
    return this._socket;
  }
  public setSocket(sessionId: string, userId: string): void {
    this._socket = new Socket({
      url: environment.mediasoupServer.wssUrl,
      options: {
        query: {
          token: localStorage.getItem(environment.token.authHeaderKey),
          sessionId: sessionId,
          userId: userId,
        },
      },
    });
    // this._socket.connect();
  }
  constructor(private logger: NGXLogger) {}

  async requestMediaConfigure(): Promise<any> {
    return this._socket.emit('mediaconfigure', '');
  }

  async requestHandshake(payload: Record<string, any>): Promise<any> {
    return this._socket.emit('handshake', payload);
  }

  onMediaClientConnected(): Observable<any> {
    return this._socket.fromEvent('mediaClientConnected');
  }
  onMediaClientDisconnect(): Observable<IMemberIdentifier> {
    return this._socket.fromEvent('mediaClientDisconnect');
  }
  onMediaVideoOrientationChange(): Observable<any> {
    return this._socket.fromEvent('mediaVideoOrientationChange');
  }
  onMediaProduce(): Observable<any> {
    return this._socket.fromEvent('mediaProduce');
  }
  onMediaReproduce(): Observable<any> {
    return this._socket.fromEvent('mediaReproduce');
  }
  onMediaProducerPause(): Observable<any> {
    return this._socket.fromEvent('mediaProducerPause');
  }
  onMediaProducerResume(): Observable<any> {
    return this._socket.fromEvent('mediaProducerResume');
  }
  onMediaProducerClose(): Observable<any> {
    return this._socket.fromEvent('mediaProducerClose');
  }
  onMediaActiveSpeaker(): Observable<any> {
    return this._socket.fromEvent('mediaActiveSpeaker');
  }
  onMediaReconfigure(): Observable<any> {
    return this._socket.fromEvent('mediaReconfigure');
  }
  onConnection(): Observable<any> {
    return this._socket.fromEvent('connect');
  }
  onRequestMedia(): Observable<any> {
    return this._socket.fromEvent('media');
  }
  onProducerMediaDeviceToggle(): Observable<any> {
    return this.socket.fromEvent('toggleDevice');
  }
  async joinRoom(payload: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      try {
        //console.warn(`Emit event ${payload.action}:`);
        this._socket.emit('joinRoom', payload, (response: any) => {
          resolve(response);
        });
      } catch (e) {
        console.log(`error emitting event: ${event}, error: ${e.message}`);
        reject(e.message);
      }
    });
  }
  async messageWithCallback(event: string, payload: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      try {
        //console.warn(`Emit event ${event}:`);
        this._socket.emit(event, payload, (response: any) => {
          resolve(response);
        });
      } catch (e) {
        console.log(`error emitting event: ${event}, error: ${e.message}`);
        reject(e.message);
      }
    });
  }

  async requestMedia(payload: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      try {
        this._socket.emit('media', payload, (response: any) => {
          resolve(response);
        });
      } catch (e) {
        console.log(`error emitting event: ${event}, error: ${e.message}`);
        reject(e.message);
      }
    });
  }
}
