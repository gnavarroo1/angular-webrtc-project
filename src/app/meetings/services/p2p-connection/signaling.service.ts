import { Injectable } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { SignalingSocket } from '../../types/custom-sockets';

@Injectable({
  providedIn: 'root',
})
export class SignalingService {
  constructor(private socket: SignalingSocket) {
    // this.socket.connect();
    this.socket.on('connect', () => {
      console.warn('SOCKET CONNECTED TO API SIGNALING SERVER');
    });
  }

  get socketId() {
    return this.socket.ioSocket.id;
  }
  public onConnect(): Observable<any> {
    return this.socket.fromEvent('connect');
  }

  public joinMeeting(payload: { meetingMemberId: string; meetingId: string }) {
    this.socket.emit('joinMeeting', payload);
  }

  public initReceive(payload: {
    meetingMemberId: string;
    meetingId: string;
    targetMemberId: string;
  }): void {
    this.socket.emit('initReceive', payload);
  }
  public onInitReceive(): Observable<any> {
    return this.socket.fromEvent('initReceive');
  }
  initSend(payload: { socketId: string; meetingMemberId: string }): any {
    this.socket.emit('initSend', payload);
  }
  public onInitSend(): Observable<any> {
    return this.socket.fromEvent('initSend');
  }
  public onMemberDisconnect(): Observable<any> {
    return this.socket.fromEvent('memberDisconnect');
  }

  public getSocketId(): Observable<string> {
    return this.socketId.asObservable();
  }

  public onOffer(): Observable<any> {
    return this.socket.fromEvent('offer');
  }
  public onAnswer(): Observable<any> {
    return this.socket.fromEvent('answer');
  }
  public onIceCandidate(): Observable<any> {
    return this.socket.fromEvent('iceCandidate');
  }

  offer(payload: {
    id: string;
    target: string;
    targetSocketId: string;
    sdp: any;
  }): void {
    this.socket.emit('offer', payload);
  }

  answer(payload: {
    id: string;
    target: string;
    targetSocketId: string;
    sdp: any;
  }): void {
    this.socket.emit('answer', payload);
  }

  iceCandidate(payload: {
    id: string;
    target: string;
    targetSocketId: string;
    candidate: RTCIceCandidate;
  }): void {
    this.socket.emit('iceCandidate', payload);
  }

  getBroadcast(type: string): Observable<any> {
    return this.socket.fromEvent(type);
  }

  broadcast(event: string, payload: any) {
    this.socket.emit(event, payload);
  }
}
