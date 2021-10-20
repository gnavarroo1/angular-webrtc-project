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

  initReceive(meetingMember: MeetingMemberDto, targetMemberId: string): void {
    console.warn('send init receive', meetingMember);
    if (meetingMember._id && meetingMember.meetingId) {
      this.signalingService.initReceive({
        meetingMemberId: meetingMember._id,
        meetingId: meetingMember.meetingId,
        targetMemberId: targetMemberId,
      });
    }
  }
  joinMeeting(meetingMember: MeetingMemberDto): void {
    console.warn('JOIN MEETING CHANNEL ON SIGNALING SERVER');
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
        console.warn('on init receive');
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
            meetingMember.connectionType === MeetingServiceType.SFU
          ) {
            return;
          }
        }
        this.addConsumerConnection(payload.meetingMemberId, payload.socketId);
        console.warn('oninitreceive', payload);
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
        console.warn('on init send', payload, meetingMember);
        if (meetingMember) {
          if (
            this.meetingDataService.meetingServiceType ===
              MeetingServiceType.SFU ||
            meetingMember.connectionType === MeetingServiceType.SFU
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
        if (member.p2pConsumerConnection) {
          member.p2pConsumerConnection.rtcPeerConnection.close();
          member.p2pConsumerConnection;
        }
        const configuration = environment.rtcConfiguration;
        const peer = new P2PConsumer({
          id: meetingMemberId,
          socketId: socketId,
          rtcPeerConnection: new RTCPeerConnection(configuration),
          isPolite: isPolite,
        });
        member.p2pConsumerConnection = peer;
        peer.remoteVideoTrack = new MediaStream();
        console.warn('p2p member', member);
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
            console.log(`${track.kind} muted`, track);
          };
          transceiver.receiver.track.onended = () => {
            console.log(`${track.kind} ended`, track);
          };
          switch (track.kind) {
            case 'audio':
              if (!peer.noiseRecvTransceiver) {
                peer.noiseRecvTransceiver = transceiver;
              }
              if (!peer.remoteAudioTrack) {
                peer.remoteAudioTrack = new MediaStream([track]);
              }
              break;
            case 'video': {
              if (streams && streams.length > 0) {
                if (!peer.screenRecvTransceiver) {
                  peer.screenRecvTransceiver = transceiver;
                }
                if (!peer.screenStream) {
                  peer.screenStream = streams[0];
                }
              } else {
                if (!peer.videoRecvTransceiver) {
                  peer.videoRecvTransceiver = transceiver;
                }
                if (!peer.videoReady) {
                  console.warn('closing consumers video if exists');
                  if (member.sfuConsumerConnection) {
                    member.sfuConsumerConnection.videoReady = false;
                    member.sfuConsumerConnection.consumerVideo?.pause();
                    member.sfuConsumerConnection.consumerVideoStream
                      ?.getTracks()
                      .forEach((track) => {
                        track.stop();
                      });
                    member.sfuConsumerConnection.consumerVideo?.close();
                  }
                  peer.remoteVideoTrack = new MediaStream([track]);
                  member.videoStream = peer.remoteVideoTrack;
                  peer.videoReady = true;
                }
              }
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
