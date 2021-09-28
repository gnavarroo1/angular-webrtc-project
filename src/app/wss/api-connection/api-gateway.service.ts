import { Injectable } from '@angular/core';
import { ApiMeetingNamespaceSocket } from '../types/custom-sockets';
import { Observable } from 'rxjs';
import { MemberType } from '../types/defines';
import { MeetingMemberDto } from '../../meetings/types/defines';

@Injectable({
  providedIn: 'root',
})
export class ApiGatewayService {
  constructor(private socket: ApiMeetingNamespaceSocket) {
    this.socket.on('connect', () => {
      console.warn(
        'SOCKET CONNECTED TO API WSS SERVER ON ',
        this.socket.ioSocket.id
      );
    });
  }

  onConnectionReady(): Observable<any> {
    return this.socket.fromEvent('connect');
  }

  async joinMeeting(payload: MeetingMemberDto): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      try {
        this.socket.emit('joinMeeting', payload, (response: any) => {
          resolve(response);
        });
      } catch (e) {
        reject(e);
      }
    });

    // this.socket.emit('join-meeting', { ...payload });
  }

  onJoinMeeting(): Observable<any> {
    return this.socket.fromEvent('joinMeeting');
  }

  updateMeetingParticipant(payload: any) {
    this.socket.emit('updateParticipant', { ...payload });
  }

  endMeetingSession(payload: any) {
    this.socket.emit('endMeetingSession', { ...payload });
  }

  onDisconnect(): Observable<any> {
    return this.socket.fromEvent('onDisconnect');
  }
  startMeetingBroadcast(payload: any) {
    this.socket.emit('startMeetingBroadcast', { ...payload });
  }

  endMeetingBroadcast(payload: any) {
    this.socket.emit('endMeetingBroadcast', { ...payload });
  }
  onStartMeetingBroadcast(): Observable<any> {
    return this.socket.fromEvent('startBroadcastingSession');
  }
  onEndMeetingBroadcast(): Observable<any> {
    return this.socket.fromEvent('endBroadcastingSession');
  }
}
