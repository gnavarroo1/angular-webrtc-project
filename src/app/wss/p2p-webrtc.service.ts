import { Injectable } from '@angular/core';
import deviceInfo from '../core/helpers/deviceInfo.helper';
import { MeetingMemberDto } from '../meetings/types/defines';
import { SignalingService } from '../meetings/services/wss/signaling.service';
import {
  BehaviorSubject,
  from,
  interval,
  Observable,
  Subscription,
} from 'rxjs';
import { environment } from '../../environments/environment';
import { fromPromise } from 'rxjs/internal-compatibility';
import { takeWhile } from 'rxjs/operators';
const getStats = require('getstats');

export type SignalingHandshakePayload = {
  meetingMemberId: string;
  sdp: RTCSessionDescriptionInit;
};
export type SignalingIceCandidatePayload = {
  meetingMemberId: string;
  candidate: RTCIceCandidateInit;
};

export class P2PConsumer {
  get remoteVideoTrack(): MediaStreamTrack {
    return this._remoteVideoTrack;
  }

  set remoteVideoTrack(value: MediaStreamTrack) {
    this._remoteVideoTrack = value;
  }

  get remoteAudioTrack(): MediaStreamTrack {
    return this._remoteAudioTrack;
  }

  set remoteAudioTrack(value: MediaStreamTrack) {
    this._remoteAudioTrack = value;
  }

  get id(): string {
    return this._id;
  }

  get rtcPeerConnection(): RTCPeerConnection {
    return this._rtcPeerConnection;
  }
  get closed(): boolean {
    return this._closed;
  }

  set pausedAudio(value: boolean) {
    this._audioPaused = value;
  }
  get pausedAudio(): boolean {
    return this._audioPaused;
  }

  get pausedVideo(): boolean {
    return this._videoPaused;
  }
  set pausedVideo(value: boolean) {
    this._videoPaused = value;
  }

  // Closed flag.
  private _closed = false;
  private _ignoreOffer = false;
  private _makingOffer = false;
  private _id: string;
  private _rtcPeerConnection: RTCPeerConnection;
  private _audioPaused!: boolean;
  private _videoPaused!: boolean;
  private _connected = false;
  private _polite: boolean;

  get polite(): boolean {
    return this._polite;
  }
  set polite(value: boolean) {
    this._polite = value;
  }

  get connected(): boolean {
    return this._connected;
  }
  set connected(value: boolean) {
    this._connected = value;
  }

  private _remoteVideoTrack!: MediaStreamTrack;
  private _remoteAudioTrack!: MediaStreamTrack;
  private _remoteStream: MediaStream = new MediaStream();
  public getStats$: Subscription | undefined;
  constructor({
    id,
    rtcPeerConnection,
    isPolite,
  }: {
    id: string;
    rtcPeerConnection: RTCPeerConnection;
    isPolite: boolean;
  }) {
    this._id = id;
    this._rtcPeerConnection = rtcPeerConnection;
    this._polite = isPolite;
  }

  pauseAudio(): void {
    if (this._closed) {
      return;
    }
    this._audioPaused = true;
  }
  resumeAudio(): void {
    if (this._closed) {
      return;
    }
    this._audioPaused = false;
  }
  pauseVideo(): void {
    if (this._closed) {
      return;
    }
    this._videoPaused = true;
  }
  resumeVideo(): void {
    if (this._closed) {
      return;
    }
    this._videoPaused = false;
  }

  get remoteStream(): MediaStream {
    return this._remoteStream;
  }
  set remoteStream(value: MediaStream) {
    this._remoteStream = value;
  }
  private previousResult: any;
  private qosStatsObj: Record<string, any> = {};
  async getStats(): Promise<any> {
    getStats(
      this._rtcPeerConnection,
      (result: any) => {
        this.previousResult = result;
        const network = this.previousResult.connectionType;
        this.previousResult.results.forEach((item: any) => {
          if (item.type === 'ssrc' && item.id.includes('send')) {
            if (parseInt(item.audioInputLevel, 10) === 0) {
              console.log(
                'AudioInputLevel is 0. The local track might be muted or could have potential one-way audio issue. Check Microphone Volume settings.'
              );
              // session.emit('no-input-volume');
            }
          }
          if (item.type === 'ssrc' && item.id.includes('recv')) {
            this.qosStatsObj.jitterBufferDiscardRate =
              item.googSecondaryDiscardedRate || 0;
            this.qosStatsObj.packetLost = item.packetsLost;
            this.qosStatsObj.packetsReceived = item.packetsReceived;
            this.qosStatsObj.totalSumJitter += parseFloat(
              item.googJitterBufferMs
            );
            this.qosStatsObj.totalIntervalCount += 1;
            this.qosStatsObj.JBM = Math.max(
              this.qosStatsObj.JBM ? this.qosStatsObj.JBM : 0,
              parseFloat(item.googJitterBufferMs)
            );
            this.qosStatsObj.netType = {
              ...this.qosStatsObj.netType,
            };
            console.log(network);
            this.qosStatsObj.netType[network] =
              (this.qosStatsObj.netType
                ? network in this.qosStatsObj.netType
                  ? parseInt(this.qosStatsObj.netType[network])
                  : 0
                : 0) + 1;

            if (parseInt(item.audioInputLevel, 10) === 0) {
              console.log(
                'AudioInputLevel is 0. The local track might be muted or could have potential one-way audio issue. Check Microphone Volume settings.'
              );
              // session.emit('no-input-volume');
            }
          }
        });
        console.log(this.qosStatsObj);
        console.log({
          speed: result.speed,
          audio: result.audio,
          video: result.video,
          bandwidth: result.bandwidth,
        });
      },
      15000
    );
    return '';
    // stats.forEach((report) => {
    //   console.log(report);
    // });
    // return stats;
    // switch (deviceInfo().flag){
    //   case 'firefox':
    //
    //     break;
    //   case 'edge':
    //   case 'chrome':
    //     break;
    //   case 'safari':
    //     break;
    //   default:
    //     break;
    // }
  }

  get ignoreOffer(): boolean {
    return this._ignoreOffer;
  }
  set ignoreOffer(value: boolean) {
    this._ignoreOffer = value;
  }
  get makingOffer(): boolean {
    return this._makingOffer;
  }
  set makingOffer(value: boolean) {
    this._makingOffer = value;
  }
}

@Injectable()
export class P2pWebrtcService {
  set localStream(value: MediaStream) {
    this._localStream = value;
  }
  set meetingMemberId(value: string) {
    this._meetingMemberId = value;
  }
  private _meetingMemberId!: string;
  events$: Subscription[] = [];
  private _localStream!: MediaStream;
  isSignallingServerConnected$ = new BehaviorSubject<boolean>(false);
  constructor(private signalingService: SignalingService) {
    const onConnect$ = this.signalingService.onConnect().subscribe(() => {
      this.isSignallingServerConnected$.next(true);
    });
    this.events$.push(onConnect$);
  }
  private _consumers: Map<string, P2PConsumer> = new Map<string, P2PConsumer>();

  get consumers(): Map<string, P2PConsumer> {
    return this._consumers;
  }

  public onConnectionReady(): Observable<boolean> {
    return this.isSignallingServerConnected$.asObservable();
  }

  joinMeeting(meetingMember: MeetingMemberDto): void {
    // console.warn('JOIN MEETING ', meetingMember);
    if (meetingMember._id && meetingMember.meetingId) {
      this._meetingMemberId = meetingMember._id;
      this.signalingService.joinMeeting({
        meetingMemberId: meetingMember._id,
        meetingId: meetingMember.meetingId,
      });
    }

    const onJoinMember$ = this.signalingService
      .onMemberJoin()
      .subscribe((payload) => {
        console.warn('member join => ', payload.meetingMemberId);
        this.addConsumerConnection(payload.meetingMemberId);
      });
    const onOffer$ = this.signalingService
      .onOffer()
      .subscribe(async (payload: any) => {
        console.warn('ON OFFER', payload);
        this.addConsumerConnection(payload.meetingMemberId, false);
        const consumer = this._consumers.get(payload.meetingMemberId);
        if (consumer) {
          try {
            if (payload.sdp) {
              console.warn('OFERTA RECIBIDA!!!');
              console.log(payload.sdp);
              const offerCollision =
                consumer.makingOffer ||
                consumer.rtcPeerConnection.signalingState != 'stable';
              console.log(`YO SOY ${consumer.polite ? 'polite' : 'impolite'}`);
              console.log(`OFFER COLLISION? ${offerCollision ? 'YES' : 'NO'}`);
              consumer.ignoreOffer = !consumer.polite && offerCollision;
              if (consumer.ignoreOffer) {
                console.warn('IGNORANDO OFERTA!!!');
                return;
              }
              await consumer.rtcPeerConnection.setRemoteDescription(
                payload.sdp
              );

              await consumer.rtcPeerConnection.setLocalDescription();
              this.signalingService.answer({
                id: this._meetingMemberId,
                target: payload.meetingMemberId,
                sdp: consumer.rtcPeerConnection.localDescription,
              });
            }
            // await consumer.rtcPeerConnection.setRemoteDescription(payload.sdp);
          } catch (e) {
            console.error(e.message, e.name);
          }
          //
          // consumer.rtcPeerConnection
          //   .setRemoteDescription(new RTCSessionDescription(payload.sdp))
          //   .then(() => {
          //     consumer.rtcPeerConnection
          //       .createAnswer()
          //       .then((answer) => {
          //         consumer.rtcPeerConnection
          //           .setLocalDescription(answer)
          //           .then(() => {
          //
          //           })
          //           .catch((err) => {
          //             console.error(err.message, err.stack);
          //           });
          //       })
          //       .catch((err) => {
          //         console.error(err.message, err.stack);
          //       });
          //   })
          //   .catch((err) => {
          //     console.error(err.message, err.stack);
          //   });
        }
      });
    const onAnswer$ = this.signalingService
      .onAnswer()
      .subscribe(async (payload: any) => {
        try {
          console.warn('ON ANSWER', payload);
          const consumer = this._consumers.get(payload.meetingMemberId);
          if (consumer) {
            await consumer.rtcPeerConnection.setRemoteDescription(
              new RTCSessionDescription(payload.sdp)
            );
          }
        } catch (e) {
          console.error(e.message, e.stack);
        }
      });
    const onIceCandidate$ = this.signalingService
      .onIceCandidate()
      .subscribe(async (payload: any) => {
        try {
          console.warn('ON ICECANDIDATE', payload);
          const consumer = this._consumers.get(payload.meetingMemberId);
          if (consumer) {
            if (payload.candidate) {
              try {
                await consumer.rtcPeerConnection.addIceCandidate(
                  payload.candidate
                );
              } catch (e) {
                if (!consumer.ignoreOffer) {
                  throw e;
                }
              }
            } else {
              console.error('ERROR ICE CANDIDATE', payload);
            }
          }
        } catch (e) {
          console.error(e.message, e.name);
        }
      });

    this.events$.push(onOffer$);
    this.events$.push(onAnswer$);
    this.events$.push(onIceCandidate$);
    this.events$.push(onJoinMember$);
  }

  async addConsumerConnection(
    meetingMemberId: string,
    isPolite = true
  ): Promise<void> {
    if (meetingMemberId) {
      const configuration = environment.rtcConfiguration;
      const peer = new P2PConsumer({
        id: meetingMemberId,
        rtcPeerConnection: new RTCPeerConnection(configuration),
        isPolite: isPolite,
      });

      this._localStream.getTracks().forEach((track) => {
        peer.rtcPeerConnection.addTrack(track, this._localStream);
      });

      peer.rtcPeerConnection.onnegotiationneeded = async () => {
        try {
          this.assert_equals(
            peer.rtcPeerConnection.signalingState,
            'stable',
            'negotiationneeded always fires in stable state'
          );
          this.assert_equals(
            peer.makingOffer,
            false,
            'negotiationneeded not already in progress'
          );
          peer.makingOffer = true;
          // const offer = await peer.rtcPeerConnection.createOffer();
          await peer.rtcPeerConnection.setLocalDescription();
          this.assert_equals(
            peer.rtcPeerConnection.signalingState,
            'have-local-offer',
            'negotiationneeded not racing with onmessage'
          );
          this.assert_equals(
            peer.rtcPeerConnection.localDescription?.type,
            'offer',
            'negotiationneeded SLD worked'
          );
          console.warn('ENVIANDO OFERTA!!!');
          this.signalingService.offer({
            id: this._meetingMemberId,
            target: meetingMemberId,
            sdp: peer.rtcPeerConnection.localDescription,
          });
        } catch (e) {
          console.error(e.message, e.name);
        } finally {
          peer.makingOffer = false;
        }
      };
      peer.rtcPeerConnection.onicegatheringstatechange = (ev) => {
        console.log(
          `ICE gathering state change: ${peer.rtcPeerConnection.iceGatheringState} `
        );
      };
      peer.rtcPeerConnection.onconnectionstatechange = async (ev) => {
        if (peer.rtcPeerConnection.connectionState === 'connected') {
          peer.connected = true;
          const stats = await peer.getStats();
          console.warn('stats ', stats);
        } else {
          peer.connected = false;
        }
        console.log(
          ` Connection state change: ${peer.rtcPeerConnection.connectionState}`
        );
      };
      peer.rtcPeerConnection.onsignalingstatechange = (ev) => {
        console.log(
          ` Signal state change: ${peer.rtcPeerConnection.connectionState}`
        );
      };
      peer.rtcPeerConnection.oniceconnectionstatechange = (ev) => {
        console.log(
          `ICE connection state change: ${peer.rtcPeerConnection.iceConnectionState} `
        );
        if (peer.rtcPeerConnection.iceConnectionState === 'failed') {
          peer.rtcPeerConnection.restartIce();
        }
      };
      peer.rtcPeerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
          this.signalingService.iceCandidate({
            id: this._meetingMemberId,
            target: meetingMemberId,
            candidate: candidate,
          });
        }
      };
      peer.rtcPeerConnection.ontrack = ({ track, streams }) => {
        peer.remoteStream = streams[0];
        switch (track.kind) {
          case 'audio':
            if (peer.remoteAudioTrack) {
              return;
            }
            peer.remoteAudioTrack = track;
            return;

          case 'video':
            peer.remoteVideoTrack = track;
            return;
        }
      };
      // console.warn('ADD CONSUMER', this._consumers);
      // const onGetStats$ = peer.getStats$.subscribe((data) => {
      //   console.warn('STATS', data);
      // });
      // this.events$.push(onGetStats$);
      this._consumers.set(meetingMemberId, peer);
    }
  }

  pauseAudioTrack(): void {
    const audioTracks = this._localStream.getAudioTracks();
    console.log(audioTracks);
    audioTracks[0].enabled = false;
  }
  resumeAudioTrack(): void {
    const audioTracks = this._localStream.getAudioTracks();
    audioTracks[0].enabled = true;
  }

  pauseVideoTrack(): void {
    const audioTracks = this._localStream.getAudioTracks();
    audioTracks[0].enabled = false;
  }
  resumeVideoTrack(): void {
    const audioTracks = this._localStream.getAudioTracks();
    audioTracks[0].enabled = true;
  }

  onDestroy(): void {
    for (const event$ of this.events$) {
      event$.unsubscribe();
    }
  }

  fail = (e: any): void => console.error({ error: `${e.name}: ${e.message}` });
  assert_equals = (a: any, b: any, msg: string) =>
    a === b || void this.fail(new Error(`${msg} expected ${b} but got ${a}`));
}
