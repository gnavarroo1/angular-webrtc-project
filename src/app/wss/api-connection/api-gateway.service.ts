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

  startScreenSharing(payload: { meetingId: string; meetingMemberId: string }) {
    this.socket.emit('startScreenSharing', {
      ...payload,
      isScreenSharing: true,
    });
  }

  stopScreenSharing(payload: { meetingId: string; meetingMemberId: string }) {
    this.socket.emit('endScreenSharing', {
      ...payload,
      isScreenSharing: false,
    });
  }

  onStartScreenSharing(): Observable<any> {
    return this.socket.fromEvent('startScreenSharing');
  }
  onStopScreenSharing(): Observable<any> {
    return this.socket.fromEvent('endScreenSharing');
  }

  toggleGlobalAudio(payload: {
    meetingId: string;
    meetingMemberId: string;
    produceAudioAllowed: boolean;
  }): void {
    this.socket.emit('toggleGlobalAudio', payload);
  }
  toggleGlobalVideo(payload: {
    meetingId: string;
    meetingMemberId: string;
    produceVideoAllowed: boolean;
  }): void {
    this.socket.emit('toggleGlobalVideo', payload);
  }

  onToggleGlobalAudio(): Observable<any> {
    return this.socket.fromEvent('toggleGlobalAudio');
  }
  onToggleGlobalVideo(): Observable<any> {
    return this.socket.fromEvent('toggleGlobalAudio');
  }
}
