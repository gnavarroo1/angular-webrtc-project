import { Injectable } from '@angular/core';
import { MeetingMemberDto, MeetingServiceType } from '../../types/defines';
import { SignalingService } from './signaling.service';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MeetingDataService } from '../meeting-data.service';
import { P2PConsumer } from '../../types/p2p-consumer.class';

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

  async initReceive(
    meetingMember: MeetingMemberDto,
    targetMemberId: string
  ): Promise<void> {
    if (meetingMember._id && meetingMember.meetingId) {
      this.signalingService.initReceive({
        meetingMemberId: meetingMember._id,
        meetingId: meetingMember.meetingId,
        targetMemberId: targetMemberId,
      });
    }
  }
  joinMeeting(meetingMember: MeetingMemberDto): void {
    if (meetingMember._id && meetingMember.meetingId) {
      this._meetingMemberId = meetingMember._id;
      this.signalingService.joinMeeting({
        meetingMemberId: meetingMember._id,
        meetingId: meetingMember.meetingId,
      });
    }
    const onInitReceive$ = this.signalingService
      .onInitReceive()
      .subscribe((payload) => {
        // console.warn('on init receive');
        if (
          this.meetingDataService.meetingMember._id !== payload.targetMemberId
        ) {
          return;
        }
        const meetingMember = this.meetingDataService.meetingMembers.get(
          payload.meetingMemberId
        );
        if (meetingMember) {
          if (
            this.meetingDataService.meetingServiceType ===
              MeetingServiceType.SFU ||
            meetingMember.remoteConnectionType === MeetingServiceType.SFU
          ) {
            return;
          }
        }
        this.addConsumerConnection(payload.meetingMemberId, payload.socketId);
        this.signalingService.initSend({
          socketId: payload.socketId,
          meetingMemberId: payload.meetingMemberId,
        });
      });

    const onInitSend$ = this.signalingService
      .onInitSend()
      .subscribe((payload) => {
        const meetingMember = this.meetingDataService.meetingMembers.get(
          payload.srcMeetingMember
        );
        if (meetingMember) {
          if (
            this.meetingDataService.meetingServiceType ===
              MeetingServiceType.SFU ||
            meetingMember.remoteConnectionType === MeetingServiceType.SFU
          ) {
            return;
          }
        }
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

              await consumer.rtcPeerConnection.setRemoteDescription(
                payload.sdp
              );

              await consumer.rtcPeerConnection.setLocalDescription();
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
    this.events$.push(onInitReceive$);
    this.events$.push(onMemberDisconnection$);
  }
  async addConsumerConnection(
    meetingMemberId: string,
    socketId: string,
    isPolite = true
  ): Promise<void> {
    if (meetingMemberId) {
      const member =
        this.meetingDataService.meetingMembers.get(meetingMemberId);
      if (member) {
        // if (member.p2pConsumerConnection) {
        //   member.p2pConsumerConnection.rtcPeerConnection.close();
        // }
        const configuration = environment.rtcConfiguration;
        const peer = new P2PConsumer({
          id: meetingMemberId,
          socketId: socketId,
          rtcPeerConnection: new RTCPeerConnection(configuration),
          isPolite: isPolite,
        });
        member.p2pConsumerConnection = peer;
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
                  streams: [new MediaStream([track])],
                  sendEncodings: [
                    {
                      maxBitrate: 1572864,
                    },
                  ],
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
                  streams: [new MediaStream([track])],
                }
              );
              break;
          }
        });

        peer.rtcPeerConnection.ontrack = ({ transceiver, track, streams }) => {
          const stream = streams[0];
          // transceiver.receiver.track.onunmute = () => {
          //   // console.log(`${track.kind} unmuted`);
          // };
          // transceiver.receiver.track.onmute = () => {
          //   // console.log(`${track.kind} muted`, track);
          // };
          // transceiver.receiver.track.onended = () => {
          //   // console.log(`${track.kind} ended`, track);
          // };
          switch (track.kind) {
            case 'audio':
              if (!peer.noiseRecvTransceiver) {
                peer.noiseRecvTransceiver = transceiver;
              }
              peer.remoteAudioTrack = track;
              member.audioStream = stream;
              break;
            case 'video': {
              if (!peer.videoRecvTransceiver) {
                peer.videoRecvTransceiver = transceiver;
              }
              peer.remoteVideoTrack = track;
              member.videoStream = stream;
              break;
            }
          }
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
          console.log(
            `On negotiation needed : ${peer.rtcPeerConnection.connectionState}`
          );
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
        // peer.rtcPeerConnection.onicegatheringstatechange = (ev) => {
        //   console.log(
        //     `ICE gathering state change: ${peer.rtcPeerConnection.iceGatheringState} `
        //   );
        // };

        // peer.rtcPeerConnection.onconnectionstatechange = async (ev) => {
        //   peer.connected =
        //     peer.rtcPeerConnection.connectionState === 'connected';
        //   // if (peer.rtcPeerConnection.connectionState === 'connected') {
        //
        //   // }
        //   console.log(
        //     ` Connection state change: ${peer.rtcPeerConnection.connectionState}`
        //   );
        // };
        // peer.rtcPeerConnection.onsignalingstatechange = (ev) => {
        //   console.log(
        //     ` Signal state change: ${peer.rtcPeerConnection.connectionState}`
        //   );
        // };
        peer.rtcPeerConnection.oniceconnectionstatechange = (ev) => {
          // console.log(
          //   `ICE connection state change: ${peer.rtcPeerConnection.iceConnectionState} `
          // );
          if (peer.rtcPeerConnection.iceConnectionState === 'failed') {
            peer.rtcPeerConnection.restartIce();
          }
        };
      }
      return;
    }
  }

  async pauseAudioTrack(): Promise<void> {
    this.meetingDataService.meetingMembers.forEach((member) => {
      if (
        !this.meetingDataService.hasSFUFullConnection &&
        !member.hasSFUConnection
      ) {
        if (
          member.p2pConsumerConnection.rtcPeerConnection.signalingState !=
          'closed'
        ) {
          member.p2pConsumerConnection.noiseSendTransceiver.direction =
            'inactive';
        }
      }
    });
  }
  async resumeAudioTrack(): Promise<void> {
    this.meetingDataService.meetingMembers.forEach((member) => {
      if (
        !this.meetingDataService.hasSFUFullConnection &&
        !member.hasSFUConnection
      ) {
        if (
          member.p2pConsumerConnection.rtcPeerConnection.signalingState !=
          'closed'
        ) {
          member.p2pConsumerConnection.noiseSendTransceiver.direction =
            'sendonly';
        }
      }
    });
  }

  async pauseVideoTrack(): Promise<void> {
    this.meetingDataService.meetingMembers.forEach((member) => {
      if (
        !this.meetingDataService.hasSFUFullConnection &&
        !member.hasSFUConnection
      ) {
        if (
          member.p2pConsumerConnection.rtcPeerConnection.signalingState !=
          'closed'
        ) {
          member.p2pConsumerConnection.videoSendTransceiver.direction =
            'inactive';
        }
      }
    });
  }
  async resumeVideoTrack(): Promise<void> {
    this.meetingDataService.meetingMembers.forEach((member) => {
      if (
        !this.meetingDataService.hasSFUFullConnection &&
        !member.hasSFUConnection
      ) {
        if (
          member.p2pConsumerConnection.rtcPeerConnection.signalingState !=
          'closed'
        ) {
          member.p2pConsumerConnection.videoSendTransceiver.direction =
            'sendonly';
        }
      }
    });
  }
  async startScreenSharing(stream: MediaStream): Promise<void> {
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
