import { Injectable } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { MediasoupSocket } from '../../types/custom-sockets';
import { NGXLogger } from 'ngx-logger';
import { IMemberIdentifier } from '../../types/defines';

@Injectable({
  providedIn: 'root',
})
export class MediasoupWssService {
  constructor(private socket: MediasoupSocket, private logger: NGXLogger) {}

  async joinRoom(payload: any): Promise<void> {
    await this.socket.emit('joinRoom', payload);
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
