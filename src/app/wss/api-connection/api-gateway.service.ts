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
        this.socket.emit('join-meeting', payload, (response: any) => {
          resolve(response);
        });
      } catch (e) {
        reject(e);
      }
    });

    // this.socket.emit('join-meeting', { ...payload });
  }

  updateMeetingParticipant(payload: any) {
    this.socket.emit('update-participant', { ...payload });
  }

  endMeetingSession(payload: any) {
    this.socket.emit('end-meeting-session', { ...payload });
  }

  onDisconnect(): Observable<any> {
    return this.socket.fromEvent('on-disconnect');
  }
  startMeetingBroadcast(payload: any) {
    this.socket.emit('start-meeting-broadcast', { ...payload });
  }

  endMeetingBroadcast(payload: any) {
    this.socket.emit('end-meeting-broadcast', { ...payload });
  }
  onStartMeetingBroadcast(): Observable<any> {
    return this.socket.fromEvent('start-broadcasting-session');
  }
  onEndMeetingBroadcast(): Observable<any> {
    return this.socket.fromEvent('end-broadcasting-session');
  }
}
