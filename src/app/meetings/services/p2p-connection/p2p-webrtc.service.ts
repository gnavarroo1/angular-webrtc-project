import { Injectable } from '@angular/core';
import { MeetingMemberDto, MeetingServiceType } from '../../types/defines';
import { SignalingService } from './signaling.service';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
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
  public onConnectionReady(): Observable<boolean> {
    return this.isSignallingServerConnected$.asObservable();
  }
  private onInitReceiveSent = false;
  async initReceive(
    meetingMember: MeetingMemberDto,
    targetMemberId: string
  ): Promise<void> {
    if (meetingMember._id && meetingMember.meetingId) {
      if (this.onInitReceiveSent) {
        return;
      }
      this.onInitReceiveSent = true;
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
        if (
          this.meetingDataService.meetingMember._id === payload.meetingMemberId
        ) {
          return;
        }
        const member = this.meetingDataService.meetingMembers.get(
          payload.meetingMemberId
        );

        if (
          member &&
          member.p2pConsumerConnection &&
          member.p2pConsumerConnection.rtcPeerConnection
        ) {
          return;
        }
        console.error('on init receive', payload.meetingMemberId);
        this.addConsumerConnection(
          payload.meetingMemberId,
          payload.socketId,
          true
        );
        this.signalingService.initSend({
          socketId: payload.socketId,
          srcMeetingMemberId: this._meetingMemberId,
        });
      });

    const onInitSend$ = this.signalingService
      .onInitSend()
      .subscribe((payload) => {
        const member = this.meetingDataService.meetingMembers.get(
          payload.srcMeetingMember
        );
        if (
          member &&
          member.p2pConsumerConnection &&
          member.p2pConsumerConnection.rtcPeerConnection
        ) {
          return;
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
        const member = this.meetingDataService.meetingMembers.get(
          payload.meetingMemberId
        );
        if (member && member.p2pConsumerConnection) {
          const consumer = member.p2pConsumerConnection;
          try {
            if (payload.sdp) {
              const isStable =
                consumer.rtcPeerConnection.signalingState == 'stable' ||
                consumer.rtcPeerConnection.signalingState == 'have-local-offer';
              const offerCollision =
                payload.sdp.type == 'offer' &&
                (consumer.makingOffer || !isStable);
              consumer.ignoreOffer = !consumer.polite && offerCollision;
              if (consumer.ignoreOffer) {
                // console.log('offer ignored');
                return;
              }
              await consumer.rtcPeerConnection.setRemoteDescription(
                payload.sdp
              );
              if (payload.sdp.type == 'offer') {
                await consumer.rtcPeerConnection.setLocalDescription();
                // console.warn('answering', payload.meetingMemberId);
                this.signalingService.answer({
                  id: this._meetingMemberId,
                  target: payload.meetingMemberId,
                  targetSocketId: consumer.socketId,
                  sdp: consumer.rtcPeerConnection.localDescription,
                });
                // console.warn('answered', payload.meetingMemberId);
              }
            }
          } catch (e) {
            console.error(e.message, e.name);
          }
        }
      });

    const onAnswer$ = this.signalingService
      .onAnswer()
      .subscribe(async (payload: any) => {
        // console.warn('on answer', payload.meetingMemberId);
        try {
          const member = this.meetingDataService.meetingMembers.get(
            payload.meetingMemberId
          );
          if (member && member.p2pConsumerConnection) {
            member.p2pConsumerConnection.answerPending = true;
            await member.p2pConsumerConnection.rtcPeerConnection.setRemoteDescription(
              payload.sdp
            );
          }
        } catch (e) {
          // console.warn(consumer.rtcPeerConnection.localDescription?.sdp);
          console.error(e);
        }
      });

    const onHanshakeMessage$ = this.signalingService
      .onHandshakeMessage()
      .subscribe(async (payload: any) => {
        try {
          const member = this.meetingDataService.meetingMembers.get(
            payload.meetingMemberId
          );
          if (
            member &&
            member.p2pConsumerConnection &&
            member.p2pConsumerConnection.rtcPeerConnection
          ) {
            if (payload.sdp) {
              const pc = member.p2pConsumerConnection.rtcPeerConnection;
              const isStable =
                pc.signalingState == 'stable' ||
                (pc.signalingState == 'have-local-offer' &&
                  member.p2pConsumerConnection.answerPending);
              member.p2pConsumerConnection.ignoreOffer =
                payload.sdp.type == 'offer' &&
                !member.p2pConsumerConnection.polite &&
                (member.p2pConsumerConnection.makingOffer || !isStable);
              if (member.p2pConsumerConnection.ignoreOffer) {
                return;
              }
              member.p2pConsumerConnection.answerPending =
                payload.sdp.type == 'answer';
              await pc.setRemoteDescription(payload.sdp);
              member.p2pConsumerConnection.answerPending = false;

              if (payload.sdp.type == 'offer') {
                await pc.setLocalDescription();
                this.signalingService.answer({
                  id: this._meetingMemberId,
                  target: payload.meetingMemberId,
                  targetSocketId: member.p2pConsumerConnection.socketId,
                  sdp: pc.localDescription,
                });
              } else {
                pc.dispatchEvent(new Event('negotiated'));
              }
            } else if (payload.candidate) {
              try {
                await member.p2pConsumerConnection.rtcPeerConnection.addIceCandidate(
                  payload.candidate
                );
              } catch (e) {
                if (!member.p2pConsumerConnection.ignoreOffer) {
                  throw e;
                }
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
      });

    const onIceCandidate$ = this.signalingService
      .onIceCandidate()
      .subscribe(async (payload: any) => {
        try {
          const member = this.meetingDataService.meetingMembers.get(
            payload.meetingMemberId
          );
          if (member && member.p2pConsumerConnection) {
            const consumer = member.p2pConsumerConnection;
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
        const member = this.meetingDataService.meetingMembers.get(
          payload.meetingMemberId
        );
        if (member) {
          member.p2pConsumerConnection.rtcPeerConnection.close();
        }
      });

    this.events$.push(onInitSend$);
    this.events$.push(onOffer$);
    this.events$.push(onAnswer$);
    this.events$.push(onHanshakeMessage$);
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
        const configuration = environment.rtcConfiguration;
        if (
          member.p2pConsumerConnection &&
          member.p2pConsumerConnection.rtcPeerConnection
        ) {
          member.p2pConsumerConnection.socketId = socketId;
          return;
        }
        const peer = new P2PConsumer({
          id: meetingMemberId,
          socketId: socketId,
          rtcPeerConnection: new RTCPeerConnection(configuration),
          isPolite: isPolite,
        });
        member.p2pConsumerConnection = peer;
        this._localStream.getTracks().forEach((track) => {
          switch (track.kind) {
            case 'video':
              peer.videoSendTransceiver = peer.rtcPeerConnection.addTransceiver(
                'video',
                {
                  direction:
                    this.localMeetingMember.produceVideoEnabled &&
                    !(
                      member.remoteConnectionType === MeetingServiceType.SFU ||
                      this.localMeetingMember.connectionType ===
                        MeetingServiceType.SFU
                    )
                      ? 'sendonly'
                      : 'inactive',
                  sendEncodings: [
                    {
                      maxBitrate: 1572864,
                    },
                  ],
                }
              );
              peer.videoSendTransceiver.sender.replaceTrack(track);
              break;
            case 'audio':
              peer.noiseSendTransceiver = peer.rtcPeerConnection.addTransceiver(
                'audio',
                {
                  direction:
                    this.localMeetingMember.produceAudioEnabled &&
                    !(
                      member.remoteConnectionType === MeetingServiceType.SFU ||
                      this.localMeetingMember.connectionType ===
                        MeetingServiceType.SFU
                    )
                      ? 'sendonly'
                      : 'inactive',
                }
              );
              peer.noiseSendTransceiver.sender.replaceTrack(track);
              break;
          }
        });

        peer.rtcPeerConnection.ontrack = ({ transceiver, track, streams }) => {
          const stream = streams[0];

          switch (track.kind) {
            case 'audio':
              if (!peer.noiseRecvTransceiver) {
                peer.noiseRecvTransceiver = transceiver;
              }
              peer.remoteAudioTrack = track;
              member.audioStream = new MediaStream([track]);
              break;
            case 'video': {
              if (!peer.videoRecvTransceiver) {
                peer.videoRecvTransceiver = transceiver;
              }
              peer.remoteVideoTrack = track;
              member.videoStream = new MediaStream([track]);
              break;
            }
          }
        };

        peer.rtcPeerConnection.onicecandidate = ({ candidate }) => {
          if (candidate) {
            this.signalingService.handshakeMessage({
              id: this._meetingMemberId,
              target: meetingMemberId,
              targetSocketId: peer.socketId,
              candidate: candidate,
            });
          }
        };

        peer.makingOffer = false;
        peer.ignoreOffer = false;
        peer.answerPending = false;
        peer.rtcPeerConnection.onnegotiationneeded = async () => {
          try {
            if (peer.rtcPeerConnection.signalingState != 'stable') {
              return;
            }
            peer.makingOffer = true;
            await peer.rtcPeerConnection.setLocalDescription();
            this.signalingService.handshakeMessage({
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
        peer.rtcPeerConnection.oniceconnectionstatechange = () => {
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
          if (
            member.p2pConsumerConnection.noiseSendTransceiver.direction !==
            'inactive'
          ) {
            member.p2pConsumerConnection.noiseSendTransceiver.direction =
              'inactive';
          }
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
          if (
            member.p2pConsumerConnection.noiseSendTransceiver.direction !==
            'sendonly'
          ) {
            member.p2pConsumerConnection.noiseSendTransceiver.direction =
              'sendonly';
          }
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
          if (
            member.p2pConsumerConnection.videoSendTransceiver.direction !==
            'inactive'
          ) {
            member.p2pConsumerConnection.videoSendTransceiver.direction =
              'inactive';
          }
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
          if (
            member.p2pConsumerConnection.videoSendTransceiver.direction !==
            'sendonly'
          ) {
            member.p2pConsumerConnection.videoSendTransceiver.direction =
              'sendonly';
          }
        }
      }
    });
  }
  // async startScreenSharing(stream: MediaStream): Promise<void> {
  //   const videoTracks = stream.getVideoTracks();
  //   if (videoTracks.length > 0) {
  //     const videoTrack = videoTracks[0];
  //     this.consumers.forEach((consumer) => {
  //       consumer.screenSendTransceiver =
  //         consumer.rtcPeerConnection.addTransceiver('video', {
  //           direction: 'sendonly',
  //           streams: [stream],
  //         });
  //       consumer.screenSendTransceiver.sender.replaceTrack(videoTrack);
  //     });
  //   }
  // }
  // stopScreenSharing(): void {
  //   this.consumers.forEach((consumer) => {
  //     consumer.screenSendTransceiver.sender.replaceTrack(null);
  //     consumer.screenSendTransceiver.stop();
  //   });
  // }
  onDestroy(): void {
    // this.consumers.forEach((consumer) => {
    //   consumer.rtcPeerConnection.close();
    // });
    // this.consumers.clear();
    for (const event$ of this.events$) {
      event$.unsubscribe();
    }
  }
  fail = (e: any): void => console.error({ error: `${e.name}: ${e.message}` });

  assert_equals = (a: any, b: any, msg: string) =>
    a === b || void this.fail(new Error(`${msg} expected ${b} but got ${a}`));
}
