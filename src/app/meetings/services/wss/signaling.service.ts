import { Injectable } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { SignalingSocket } from '../../types/custom-sockets';

@Injectable({
  providedIn: 'root',
})
export class SignalingService {
  private socketId: ReplaySubject<string> = new ReplaySubject<string>();
  constructor(private socket: SignalingSocket) {
    // this.socket.connect();
    this.socket.on('connect', () => {
      console.warn(
        'SOCKET CONNECTED TO API SIGNALING SERVER ON ',
        this.socket.ioSocket.id
      );
    });
  }

  public getSocketId(): Observable<string> {
    return this.socketId.asObservable();
  }

  handleConnection(meetingId: string) {
    this.socket.emit('create or join', { room: meetingId });
  }

  onCreated(): Observable<any> {
    return this.socket.fromEvent('created');
  }

  onClientJoin(): Observable<any> {
    return this.socket.fromEvent('join');
  }

  onClientJoined(): Observable<any> {
    return this.socket.fromEvent('joined');
  }

  handleHandshakeEventEmit(payload: {
    type: string;
    message: RTCIceCandidate | RTCSessionDescriptionInit | string;
  }): void {
    this.socket.emit('handshake-message', payload);
  }

  //payload:{type:string,message:RTCIceCandidate | RTCSessionDescriptionInit | string}
  handleOnHandshakeEvent(): Observable<any> {
    return this.socket.fromEvent('handshake-message');
  }

  offer(payload: { id: string; target: string; sdp: unknown }): void {
    this.socket.emit('offer', payload);
  }

  answer(payload: { id: string; target: string; sdp: unknown }): void {
    this.socket.emit('answer', payload);
  }

  iceCandidate(payload: {
    id: string;
    target: string;
    candidate: RTCIceCandidate;
  }): void {
    console.log('ICE CANDIDATE EMIT => ', payload);
    this.socket.emit('ice-candidate', payload);
  }

  getBroadcast(type: string): Observable<any> {
    return this.socket.fromEvent(type);
  }

  broadcast(event: string, payload: any) {
    this.socket.emit(event, payload);
  }

  // disconnect(){
  //   console.log(this.socket.ioSocket)
  //   this.socket.disconnect();
  //   this.socketId.complete()
  // }
  // joinMeeting(payload: {
  //   id:string,
  //   roomId: string,
  //   alias:string | undefined | null,
  // }){
  //   console.log('USER JOINING MEETING => '+ payload.roomId)
  //   this.socket.emit('join-meeting',{ ...payload } );
  // }
}
