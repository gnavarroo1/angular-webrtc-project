import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { Observable } from 'rxjs';

import { NGXLogger } from 'ngx-logger';
import { IMemberIdentifier } from '../../types/helper';

@Injectable({
  providedIn: 'root',
})
export class WssService {
  constructor(private logger: NGXLogger, private socket: Socket) {
    socket.disconnect();
  }

  async requestMediaConfigure(): Promise<any> {
    return this.socket.emit('mediaconfigure', '');
  }
  async joinRoom(payload: any): Promise<any> {
    return this.socket.emit('joinRoom', payload);
  }

  async requestMedia(payload: Record<string, any>): Promise<any> {
    return await this.socket.emit('media', payload);
  }

  async requestHandshake(payload: Record<string, any>): Promise<any> {
    return this.socket.emit('handshake', payload);
  }

  onMediaClientConnected(): Observable<any> {
    return this.socket.fromEvent('mediaClientConnected');
  }
  onMediaClientDisconnect(): Observable<IMemberIdentifier> {
    return this.socket.fromEvent('mediaClientDisconnect');
  }
  onMediaVideoOrientationChange(): Observable<any> {
    return this.socket.fromEvent('mediaVideoOrientationChange');
  }
  onMediaProduce(): Observable<any> {
    return this.socket.fromEvent('mediaProduce');
  }
  onMediaReproduce(): Observable<any> {
    return this.socket.fromEvent('mediaReproduce');
  }
  onMediaProducerPause(): Observable<any> {
    return this.socket.fromEvent('mediaProducerPause');
  }
  onMediaProducerResume(): Observable<any> {
    return this.socket.fromEvent('mediaProducerResume');
  }
  onMediaActiveSpeaker(): Observable<any> {
    return this.socket.fromEvent('mediaActiveSpeaker');
  }
  onMediaReconfigure(): Observable<any> {
    return this.socket.fromEvent('mediaReconfigure');
  }
  onConnection(): Observable<any> {
    return this.socket.fromEvent('connect');
  }
  onRequestMedia(): Observable<any> {
    return this.socket.fromEvent('media');
  }
}
