import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { Observable } from 'rxjs';

import { NGXLogger } from 'ngx-logger';
import { IMemberIdentifier } from '../meetings/types/defines';
import { environment } from '../../environments/environment';
import { MediasoupSocket } from '../meetings/types/custom-sockets';

@Injectable({
  providedIn: 'root',
})
export class WssService {
  get socket(): MediasoupSocket {
    return this._socket;
  }
  private apiMediasoup =
    environment.mediasoupServer.api.url +
    'websocket/message-connection-handler';

  constructor(private logger: NGXLogger, private _socket: MediasoupSocket) {}

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

  async joinRoom(payload: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      try {
        console.warn(`Emit event ${payload.action}:`);
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
        console.warn(`Emit event ${event}:`);
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
        console.warn(`Emit event ${payload.action}:`);
        this._socket.emit('media', payload, (response: any) => {
          console.log(
            `success emitting event: media, ACK from server: ${payload.action}`
          );
          console.warn(`Response from ${payload.action}:`, response);
          resolve(response);
        });
      } catch (e) {
        console.log(`error emitting event: ${event}, error: ${e.message}`);
        reject(e.message);
      }
    });
  }
}
