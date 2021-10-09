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
  }
  onJoinMeeting(): Observable<any> {
    return this.socket.fromEvent('joinMeeting');
  }
  updateMeetingParticipant(payload: any) {
    this.socket.emit('updateParticipant', { ...payload });
  }
  onMeetingMemberDisconnected(): Observable<any> {
    return this.socket.fromEvent('meetingMemberDisconnected');
  }

  endMeetingSession(payload: any) {
    this.socket.emit('endMeetingSession', { ...payload });
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

  async toggleAudio(payload: {
    meetingId: string;
    meetingMemberId: string;
    produceAudioEnabled: boolean;
  }): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      try {
        this.socket.emit('toggleAudio', payload, (response: any) => {
          resolve(response);
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  async toggleVideo(payload: {
    meetingId: string;
    meetingMemberId: string;
    produceVideoEnabled: boolean;
  }): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      try {
        this.socket.emit('toggleVideo', payload, (response: any) => {
          resolve(response);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  onToggleAudio(): Observable<any> {
    return this.socket.fromEvent('toggleAudio');
  }

  onToggleVideo(): Observable<any> {
    return this.socket.fromEvent('toggleVideo');
  }

  async toggleGlobalAudio(payload: {
    meetingId: string;
    meetingMemberId: string;
    produceAudioAllowed: boolean;
  }): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      try {
        this.socket.emit('toggleGlobalAudio', payload, (response: any) => {
          resolve(response);
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  async toggleGlobalVideo(payload: {
    meetingId: string;
    meetingMemberId: string;
    produceVideoAllowed: boolean;
  }): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      try {
        this.socket.emit('toggleGlobalVideo', payload, (response: any) => {
          resolve(response);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  onToggleGlobalAudio(): Observable<any> {
    return this.socket.fromEvent('toggleGlobalAudio');
  }
  onToggleGlobalVideo(): Observable<any> {
    return this.socket.fromEvent('toggleGlobalVideo');
  }
}
