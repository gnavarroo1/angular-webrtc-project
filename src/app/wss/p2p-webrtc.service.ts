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
import { takeWhile, timestamp } from 'rxjs/operators';
import { MeetingDataService } from '../meetings/services/meeting-data.service';
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
  get stopGetStats(): boolean {
    return this._stopGetStats;
  }

  set stopGetStats(value: boolean) {
    this._stopGetStats = value;
  }

  get getStatsResult(): TGetStatsResult {
    return this._getStatsResult;
  }

  set getStatsResult(value: TGetStatsResult) {
    this._getStatsResult = value;
  }
  get screenStream(): MediaStream {
    return this._screenStream;
  }
  set screenStream(value: MediaStream) {
    this._screenStream = value;
  }
  get socketId(): string {
    return this._socketId;
  }
  set socketId(value: string) {
    this._socketId = value;
  }
  get screenSendTransceiver(): RTCRtpTransceiver {
    return this._screenSendTransceiver;
  }
  set screenSendTransceiver(value: RTCRtpTransceiver) {
    this._screenSendTransceiver = value;
  }
  get noiseRecvTransceiver(): RTCRtpTransceiver {
    return this._noiseRecvTransceiver;
  }
  set noiseRecvTransceiver(value: RTCRtpTransceiver) {
    this._noiseRecvTransceiver = value;
  }
  get videoRecvTransceiver(): RTCRtpTransceiver {
    return this._videoRecvTransceiver;
  }
  set videoRecvTransceiver(value: RTCRtpTransceiver) {
    this._videoRecvTransceiver = value;
  }
  get screenRecvTransceiver(): RTCRtpTransceiver {
    return this._screenRecvTransceiver;
  }
  set screenRecvTransceiver(value: RTCRtpTransceiver) {
    this._screenRecvTransceiver = value;
  }
  get noiseSendTransceiver(): RTCRtpTransceiver {
    return this._noiseSendTransceiver;
  }
  set noiseSendTransceiver(value: RTCRtpTransceiver) {
    this._noiseSendTransceiver = value;
  }
  get videoSendTransceiver(): RTCRtpTransceiver {
    return this._videoSendTransceiver;
  }
  set videoSendTransceiver(value: RTCRtpTransceiver) {
    this._videoSendTransceiver = value;
  }
  get remoteVideoTrack(): MediaStream {
    return this._remoteVideoTrack;
  }
  set remoteVideoTrack(value: MediaStream) {
    // const audioTracks = this.remoteStream.getAudioTracks();
    this._remoteVideoTrack = value;
  }
  get remoteAudioTrack(): MediaStream {
    return this._remoteAudioTrack;
  }
  set remoteAudioTrack(value: MediaStream) {
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
  // get remoteStream(): MediaStream {
  //   return this._remoteStream;
  // }
  // set remoteStream(value: MediaStream) {
  //   this._remoteStream = value;
  // }
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
  // Closed flag.
  private _closed = false;
  private _ignoreOffer = false;
  private _makingOffer = false;
  private _id: string;
  private _rtcPeerConnection: RTCPeerConnection;
  private _connected = false;
  private _polite: boolean;
  private _noiseSendTransceiver!: RTCRtpTransceiver;
  private _videoSendTransceiver!: RTCRtpTransceiver;
  private _screenSendTransceiver!: RTCRtpTransceiver;
  private _noiseRecvTransceiver!: RTCRtpTransceiver;
  private _videoRecvTransceiver!: RTCRtpTransceiver;
  private _screenRecvTransceiver!: RTCRtpTransceiver;
  private _socketId: string;
  private _remoteVideoTrack!: MediaStream;
  private _remoteAudioTrack!: MediaStream;
  private _screenStream!: MediaStream;
  private _stopGetStats = false;
  private _getStatsResult: TGetStatsResult = {
    audio: {
      send: {
        availableBandwidth: 0,
        streams: 0,
        framerateMean: 0,
        bitrateMean: 0,
      },
      recv: {
        availableBandwidth: 0,
        streams: 0,
        framerateMean: 0,
        bitrateMean: 0,
      },
      bytesSent: 0,
      bytesReceived: 0,
      latency: 0,
      packetsLost: 0,
    },
    video: {
      send: {
        availableBandwidth: 0,
        streams: 0,
        framerateMean: 0,
        bitrateMean: 0,
      },
      recv: {
        availableBandwidth: 0,
        streams: 0,
        framerateMean: 0,
        bitrateMean: 0,
      },
      bytesSent: 0,
      bytesReceived: 0,
      latency: 0,
      packetsLost: 0,
    },
    bandwidth: {
      systemBandwidth: 0,
      sentPerSecond: 0,
      encodedPerSecond: 0,
      helper: {
        audioBytesSent: 0,
        videoBytestSent: 0,
        videoBytesSent: 0,
      },
      speed: 0,
    },
    connectionType: {
      local: {
        transport: [],
        networkType: [],
      },
      remote: {
        transport: [],
        networkType: [],
      },
    },
    nomore: () => {
      this._stopGetStats = true;
    },
  };

  constructor({
    id,
    socketId,
    rtcPeerConnection,
    isPolite,
  }: {
    id: string;
    socketId: string;
    rtcPeerConnection: RTCPeerConnection;
    isPolite: boolean;
  }) {
    this._id = id;
    this._socketId = socketId;
    this._rtcPeerConnection = rtcPeerConnection;
    this._polite = isPolite;
  }

  async getStats(): Promise<void> {
    if (this.rtcPeerConnection.signalingState === 'closed') {
      return;
    }
    await getStats(this.rtcPeerConnection, (result: TGetStatsResult) => {
      console.log(Date.now());
      if (this._closed) {
        result.nomore();
      } else {
        this._getStatsResult = result;
      }
      console.warn('REPORT', this._closed, result, this._getStatsResult);
      return;
    });
    return;
    // const summary: Record<string, any> = {};
    // this.rtcPeerConnection.getStats(null).then((res) => {
    //   res.forEach((report) => {
    //     summary.timestamp = report.timestamp;
    //     if (report.type == 'outbound-rtp') {
    //       console.error('report', report);
    //       if (report.packetsLost) {
    //         summary.packetsLost = report.packetsLost;
    //       }
    //       if (report.packetsSent) {
    //         summary.packetsSent = report.packetsSent;
    //       }
    //       if (report.bytesSent) {
    //         summary.bytesSent = (report.bytesSent / 1024000).toFixed(2);
    //         if (this.bytesOutVideoPrev && this.timestampPrev) {
    //           summary.videoOutBitrate =
    //             (8 * (report.bytesSent - this.bytesOutVideoPrev)) /
    //             (report.timestamp - this.timestampPrev);
    //           summary.videoOutBitrate = Math.floor(summary.videoOutBitrate);
    //         }
    //         this.bytesOutVideoPrev = report.bytesSent;
    //       }
    //       this.timestampPrev = report.timestamp;
    //       console.warn('SUMMARY', summary);
    //     } else if (report.type == 'inbound-rtp' && report.kind == 'video') {
    //       if (report.bytesReceived) {
    //         summary.bytesReceived = (report.bytesReceived / 1024000).toFixed(2);
    //         if (this.bytesInVideoPrev && this.timestampPrev) {
    //           summary.videoInBitrate =
    //             (8 * (report.bytesReceived - this.bytesInVideoPrev)) /
    //             (report.timestamp - this.timestampPrev);
    //           summary.videoInBitrate = Math.floor(summary.videoInBitrate);
    //         }
    //         this.bytesInVideoPrev = report.bytesReceived;
    //       }
    //       this.timestampPrev = report.timestamp;
    //       console.warn('SUMMARY', summary);
    //     }
    //   });
    // });
  }

  // private remoteStats(results: RTCStatsReport) {
  //   results.forEach((report) => {
  //     let bitrate: number | undefined;
  //     const now = report.timestamp;
  //     switch (report.type) {
  //       case 'inbound-rtp': {
  //         switch (report.mediaType) {
  //           case 'video': {
  //             const bytes = report.bytesReceived;
  //             if (this.timestampPrev) {
  //               if (this.bytesInVideoPrev) {
  //                 bitrate =
  //                   (8 * (bytes - this.bytesInVideoPrev)) /
  //                   (now - this.timestampPrev);
  //                 bitrate = Math.floor(bitrate);
  //               }
  //             }
  //             this.bytesInVideoPrev = bytes;
  //             if (bitrate) {
  //               this.inboundVideoBitrate = bitrate;
  //             }
  //             break;
  //           }
  //           case 'audio': {
  //             const bytes = report.bytesReceived;
  //             if (this.timestampPrev) {
  //               if (this.bytesInAudioPrev) {
  //                 bitrate =
  //                   (8 * (bytes - this.bytesInAudioPrev)) /
  //                   (now - this.timestampPrev);
  //                 bitrate = Math.floor(bitrate);
  //               }
  //             }
  //             this.bytesInAudioPrev = bytes;
  //             if (bitrate) {
  //               this.inboundVideoBitrate = bitrate;
  //             }
  //             break;
  //           }
  //           default:
  //             console.warn('report', report);
  //         }
  //         this.timestampPrev = now;
  //         break;
  //       }
  //       case 'outbound-rtp': {
  //         console.warn('outbound-rtp', report);
  //         break;
  //       }
  //       default:
  //         console.warn('default type report', report);
  //         break;
  //     }
  //   });
  // }
}

export type TGetStatsResult = {
  audio: TGetStatsConnectionStream;
  video: TGetStatsConnectionStream;
  bandwidth: TGetStatsBandwidth;
  connectionType: TGetStatsConnectionType;
  nomore: () => void;
};

export type TGetStatsBandwidth = {
  speed: number;
  systemBandwidth: number;
  sentPerSecond: number;
  encodedPerSecond: number;
  helper: {
    audioBytesSent: number;
    videoBytestSent: number;
    videoBytesSent: number;
  };
  availableSendBandwidth?: number;
  googActualEncBitrate?: number;
  googAvailableSendBandwidth?: number;
  googAvailableReceiveBandwidth?: number;
  googRetransmitBitrate?: number;
  googTargetEncBitrate?: number;
  googBucketDelay?: number;
  googTransmitBitrate?: number;
};
export type TGetStatsConnectionStream = {
  send: TGetStatsConnectionInfo;
  recv: TGetStatsConnectionInfo;
  bytesSent: number;
  bytesReceived: number;
  latency: number;
  packetsLost: number;
};

export type TGetStatsConnectionType = {
  transport?: string;
  local?: TGetStatsNetworkInfo;
  remote?: TGetStatsNetworkInfo;
};
export type TGetStatsNetworkInfo = {
  networkType: string[];
  transport: string[];
};

export type TGetStatsConnectionInfo = {
  availableBandwidth: number;
  streams: number;
  framerateMean: number;
  bitrateMean: number;
};

@Injectable()
export class P2pWebrtcService {
  get localMeetingMember(): MeetingMemberDto {
    return this._localMeetingMember;
  }
  set localMeetingMember(value: MeetingMemberDto) {
    this._localMeetingMember = value;
  }
  set localStream(value: MediaStream) {
    this._localStream = value;
  }
  set meetingMemberId(value: string) {
    this._meetingMemberId = value;
  }
  private _meetingMemberId!: string;
  private _localMeetingMember!: MeetingMemberDto;
  negotiationsCount = 0;
  events$: Subscription[] = [];
  private _localStream!: MediaStream;
  isSignallingServerConnected$ = new BehaviorSubject<boolean>(false);
  constructor(
    private signalingService: SignalingService,
    private meetingDataService: MeetingDataService
  ) {
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
    if (meetingMember._id && meetingMember.meetingId) {
      this._meetingMemberId = meetingMember._id;
      this.signalingService.initReceive({
        meetingMemberId: meetingMember._id,
        meetingId: meetingMember.meetingId,
      });
    }
    const onJoinMember$ = this.signalingService
      .onInitReceive()
      .subscribe((payload) => {
        this.addConsumerConnection(payload.meetingMemberId, payload.socketId);
        this.signalingService.initSend({
          socketId: payload.socketId,
          meetingMemberId: payload.meetingMemberId,
        });
      });

    const onInitSend$ = this.signalingService
      .onInitSend()
      .subscribe((payload) => {
        this.addConsumerConnection(
          payload.srcMeetingMember,
          payload.srcSocketId,
          false
        );
      });

    const onOffer$ = this.signalingService
      .onOffer()
      .subscribe(async (payload: any) => {
        const consumer = this._consumers.get(payload.meetingMemberId);
        if (consumer) {
          try {
            if (payload.sdp) {
              const offerCollision =
                consumer.makingOffer ||
                consumer.rtcPeerConnection.signalingState != 'stable';
              consumer.ignoreOffer = !consumer.polite && offerCollision;
              if (consumer.ignoreOffer) {
                return;
              }
              if (offerCollision) {
                await Promise.all([
                  consumer.rtcPeerConnection.setLocalDescription({
                    type: 'rollback',
                  }),
                  consumer.rtcPeerConnection.setRemoteDescription(payload.sdp),
                ]);
              } else {
                await consumer.rtcPeerConnection.setRemoteDescription(
                  payload.sdp
                );
              }

              const answer = await consumer.rtcPeerConnection.createAnswer();
              await consumer.rtcPeerConnection.setLocalDescription(answer);
              this.signalingService.answer({
                id: this._meetingMemberId,
                target: payload.meetingMemberId,
                targetSocketId: consumer.socketId,
                sdp: consumer.rtcPeerConnection.localDescription,
              });
            }
          } catch (e) {
            console.error(e.message, e.name);
          }
        }
      });

    const onAnswer$ = this.signalingService
      .onAnswer()
      .subscribe(async (payload: any) => {
        try {
          // console.warn('ON ANSWER', payload);
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
          // console.warn('ON ICECANDIDATE', payload);
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
          console.error(e.message, e.name, payload.candidate);
        }
      });

    const onMemberDisconnection$ = this.signalingService
      .onMemberDisconnect()
      .subscribe((payload) => {
        // console.warn('MEMBER DISCONNECTED', payload);
        const member = this.consumers.get(payload.meetingMemberId);
        if (member) {
          member.rtcPeerConnection.close();
          this.consumers.delete(payload.meetingMemberId);
        }
      });

    this.events$.push(onInitSend$);
    this.events$.push(onOffer$);
    this.events$.push(onAnswer$);
    this.events$.push(onIceCandidate$);
    this.events$.push(onJoinMember$);
    this.events$.push(onMemberDisconnection$);
  }

  async addConsumerConnection(
    meetingMemberId: string,
    socketId: string,
    isPolite = true
  ): Promise<void> {
    if (meetingMemberId) {
      const configuration = environment.rtcConfiguration;
      const peer = new P2PConsumer({
        id: meetingMemberId,
        socketId: socketId,
        rtcPeerConnection: new RTCPeerConnection(configuration),
        isPolite: isPolite,
      });
      this._consumers.set(meetingMemberId, peer);
      this._localStream.getTracks().forEach((track) => {
        switch (track.kind) {
          case 'video':
            peer.videoSendTransceiver = peer.rtcPeerConnection.addTransceiver(
              track,
              {
                direction: this.localMeetingMember.produceVideoEnabled
                  ? 'sendonly'
                  : 'inactive',
              }
            );
            break;
          case 'audio':
            peer.noiseSendTransceiver = peer.rtcPeerConnection.addTransceiver(
              track,
              {
                direction: this.localMeetingMember.produceAudioEnabled
                  ? 'sendonly'
                  : 'inactive',
              }
            );
            break;
        }
      });

      peer.rtcPeerConnection.ontrack = ({ transceiver, track, streams }) => {
        const consumer =
          this.meetingDataService.meetingMembers.get(meetingMemberId);
        transceiver.receiver.track.onunmute = () => {
          console.log(`${track.kind} unmuted`);
        };
        transceiver.receiver.track.onmute = () => {
          console.log(`${track.kind} muted`);
        };
        transceiver.receiver.track.onended = () => {
          console.log(`${track.kind} ended`);
        };
        switch (track.kind) {
          case 'audio':
            if (!peer.noiseRecvTransceiver) {
              peer.noiseRecvTransceiver = transceiver;
            }
            if (!peer.remoteAudioTrack) {
              if (consumer) {
                consumer.videoStream = new MediaStream([track]);
              }
              peer.remoteAudioTrack = new MediaStream([track]);
            }
            break;
          case 'video': {
            if (streams && streams.length > 0) {
              if (!peer.screenRecvTransceiver) {
                peer.screenRecvTransceiver = transceiver;
              }
              if (!peer.screenStream) {
                if (consumer) {
                  consumer.screenStream = streams[0];
                }
                peer.screenStream = streams[0];
              }
            } else {
              if (!peer.videoRecvTransceiver) {
                peer.videoRecvTransceiver = transceiver;
              }
              if (!peer.remoteVideoTrack) {
                if (consumer) {
                  consumer.videoStream = new MediaStream([track]);
                }
                peer.remoteVideoTrack = new MediaStream([track]);
              }
            }
            break;
          }
        }
        console.warn(peer.videoRecvTransceiver, peer.screenRecvTransceiver);
      };
      peer.rtcPeerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
          this.signalingService.iceCandidate({
            id: this._meetingMemberId,
            target: meetingMemberId,
            targetSocketId: peer.socketId,
            candidate: candidate,
          });
        }
      };

      peer.makingOffer = false;
      peer.ignoreOffer = false;
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
          const offer = await peer.rtcPeerConnection.createOffer();
          if (peer.rtcPeerConnection.signalingState != 'stable') {
            return;
          }
          await peer.rtcPeerConnection.setLocalDescription(offer);
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
          this.signalingService.offer({
            id: this._meetingMemberId,
            target: meetingMemberId,
            targetSocketId: peer.socketId,
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
          peer.getStats();
          // peer.connected = true;
          // interval(1000)
          //   .pipe(takeWhile(() => peer.connected))
          //   .subscribe((val) => {
          //     peer.getStats();
          //   });
          // const stats = await peer.getStats();
          // console.warn('stats ', stats);
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
  startScreenSharing(stream: MediaStream): void {
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 0) {
      const videoTrack = videoTracks[0];
      this.consumers.forEach((consumer) => {
        consumer.screenSendTransceiver =
          consumer.rtcPeerConnection.addTransceiver('video', {
            direction: 'sendonly',
            streams: [stream],
          });
        consumer.screenSendTransceiver.sender.replaceTrack(videoTrack);
      });
    }
  }
  stopScreenSharing(): void {
    this.consumers.forEach((consumer) => {
      consumer.screenSendTransceiver.sender.replaceTrack(null);
      consumer.screenSendTransceiver.stop();
    });
  }

  onDestroy(): void {
    this.consumers.forEach((consumer) => {
      consumer.rtcPeerConnection.close();
    });
    this.consumers.clear();
    for (const event$ of this.events$) {
      event$.unsubscribe();
    }
  }

  fail = (e: any): void => console.error({ error: `${e.name}: ${e.message}` });
  assert_equals = (a: any, b: any, msg: string) =>
    a === b || void this.fail(new Error(`${msg} expected ${b} but got ${a}`));
}
