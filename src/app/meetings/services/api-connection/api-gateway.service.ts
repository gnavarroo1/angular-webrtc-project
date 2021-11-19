import { Injectable } from '@angular/core';
import { ApiMeetingNamespaceSocket } from '../../types/custom-sockets';
import { Observable } from 'rxjs';
import { MemberType } from '../../types/defines';
import {
  MeetingMemberDto,
  MeetingServiceType,
  TChatDto,
} from '../../types/defines';

@Injectable({
  providedIn: 'root',
})
export class ApiGatewayService {
  constructor(private socket: ApiMeetingNamespaceSocket) {
    this.socket.on('connect', () => {
      // console.warn('SOCKET CONNECTED TO API WSS SERVER');
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

  async toggleScreenSharePermission(payload: {
    meetingId: string;
    meetingMemberId: string;
    canScreenShare: boolean;
  }): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      try {
        this.socket.emit(
          'toggleScreenSharePermission',
          payload,
          (response: any) => {
            resolve(response);
          }
        );
      } catch (e) {
        reject(e);
      }
    });
  }
  onToggleScreenSharePermission(): Observable<any> {
    return this.socket.fromEvent('toggleScreenSharePermission');
  }

  async toggleConnectionType(payload: {
    meetingId: string;
    meetingMemberId: string;
    connectionType: MeetingServiceType;
  }): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      try {
        this.socket.emit('toggleConnectionType', payload, (response: any) => {
          // console.warn('toggle service');
          resolve(response);
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  onToggleConnectionType(): Observable<any> {
    return this.socket.fromEvent('toggleConnectionType');
  }

  sendMessage(message: TChatDto, meetingId: string) {
    this.socket.emit('chatMessage', {
      meetingId: meetingId,
      message: message,
    });
  }
  onMessage(): Observable<any> {
    return this.socket.fromEvent('chatMessage');
  }
}
