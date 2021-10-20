import { Injectable } from '@angular/core';
import { ApiGatewayService } from './api-connection/api-gateway.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { DeviceService } from '../core/helpers/device-manager.service';
import { ApiRestService } from './api-connection/api-rest.service';
import {
  MeetingDto,
  MeetingMemberDto,
  MeetingServiceType,
  MemberType,
  TChatDto,
} from '../types/defines';
import * as hark from 'hark';
import { NGXLogger } from 'ngx-logger';
import { P2pWebrtcService } from './p2p-connection/p2p-webrtc.service';
import { SignalingService } from './p2p-connection/signaling.service';
import { SignalingSocket } from '../types/custom-sockets';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { MeetingDataService } from './meeting-data.service';
import { SfuWebrtcService } from './mediasoup-connection/mediasoup.service';
import { MeetingMember } from '../types/meeting-member.class';
import { SfuConsumer } from '../types/sfu-consumer.class';

@Injectable()
export class MeetingService {
  get isMediasoupReady(): boolean {
    return this._isMediasoupReady;
  }

  set isMediasoupReady(value: boolean) {
    this._isMediasoupReady = value;
  }
  get isBroadcasting(): boolean {
    return this._isBroadcasting;
  }

  set isBroadcasting(value: boolean) {
    this._isBroadcasting = value;
  }
  get isMeetingCreator(): boolean {
    return this.meetingDataService.isMeetingCreator;
  }

  set isMeetingCreator(value: boolean) {
    this.meetingDataService.isMeetingCreator = value;
  }
  get activeSpeaker(): number {
    return this._activeSpeaker;
  }

  set activeSpeaker(value: number) {
    this._activeSpeaker = value;
  }
  get localStream(): MediaStream | undefined {
    return this.meetingDataService.localStream;
  }
  set localStream(value) {
    this.meetingDataService.localStream = value;
  }

  get meetingId(): string {
    return this.meetingDataService.meetingId;
  }
  set meetingId(value: string) {
    this.meetingDataService.meetingId = value;
  }

  get meetingMembers(): Map<string, MeetingMember> {
    return this.meetingDataService.meetingMembers;
  }
  set meetingMembers(value: Map<string, MeetingMember>) {
    this.meetingDataService.meetingMembers = value;
  }
  get meetingViewers(): Map<string, MeetingMember> {
    return this.meetingDataService.meetingViewers;
  }
  set meetingViewers(value: Map<string, MeetingMember>) {
    this.meetingDataService.meetingViewers = value;
  }

  get meetingMember(): MeetingMemberDto {
    return this.meetingDataService.meetingMember;
  }
  set meetingMember(value: MeetingMemberDto) {
    this.meetingDataService.meetingMember = value;
  }
  get meetingServiceType(): MeetingServiceType {
    return this.meetingDataService.meetingServiceType;
  }
  set meetingServiceType(value: MeetingServiceType) {
    this.meetingDataService.meetingServiceType = value;
  }
  get isMeetingReady() {
    return this._isMeetingReady;
  }

  get audioTrack(): MediaStreamTrack | undefined {
    return this._audioTrack;
  }
  get videoTrack(): MediaStreamTrack | undefined {
    return this._videoTrack;
  }
  get messages(): TChatDto[] {
    return this.meetingDataService.messages;
  }
  private _isBroadcasting = false;
  private meshService!: P2pWebrtcService;
  private _audioTrack: MediaStreamTrack | undefined;
  private _videoTrack: MediaStreamTrack | undefined;
  private _isMeetingReady = false;
  private _isMediasoupReady = false;
  private _activeSpeaker = 0;
  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private logger: NGXLogger,
    private apiGatewayService: ApiGatewayService,
    private apiRestService: ApiRestService,
    private deviceManagerService: DeviceService,
    private meetingDataService: MeetingDataService,
    private mediasoupService: SfuWebrtcService
  ) {
    this.apiGatewayService.onConnectionReady().subscribe(async () => {
      const onStartScreenSharing$ = this.apiGatewayService
        .onStartScreenSharing()
        .subscribe((data) => {
          console.log(data, 'startscreensharing');
          const member = this.meetingMembers.get(data.meetingMemberId);
          if (member) {
            member.isScreenSharing = data.isScreenSharing;
          }
        });
      const onEndScreenSharing$ = this.apiGatewayService
        .onStopScreenSharing()
        .subscribe((data) => {
          console.log(data, 'stopscreensharing');
          const member = this.meetingMembers.get(data.meetingMemberId);
          if (member) {
            member.isScreenSharing = data.isScreenSharing;
          }
        });
      const onStartBroadcasting$ = this.apiGatewayService
        .onStartMeetingBroadcast()
        .subscribe((data) => {
          console.log('startBroadcastingSession', data);
          if (!this.isMediasoupReady) {
            this.initSFUInstance(true);
          }
          this.isBroadcasting = true;
        });
      const onEndBroadcasting$ = this.apiGatewayService
        .onEndMeetingBroadcast()
        .subscribe((data) => {
          console.log('endBroadcastingSession', data);
          console.log(data);
          if (this.meetingServiceType === 'MESH' && this.isMediasoupReady) {
            this.mediasoupService.leaveSfuSession();
          }
          this.isBroadcasting = false;
        });
      const onMemberJoin$ = this.apiGatewayService
        .onJoinMeeting()
        .subscribe((data) => {
          const member = new MeetingMember(data);
          if (data.member === MemberType.CONSUMER) {
            this.meetingViewers.set(data._id, member);
          } else {
            this.meetingMembers.set(data._id, member);
          }
        });
      const onMeetingMemberDisconnected$ = this.apiGatewayService
        .onMeetingMemberDisconnected()
        .subscribe((data) => {
          let consumer;
          this.meetingViewers.delete(data.sender);
          const member = this.meetingMembers.get(data.sender);
          if (member) {
            if (
              member.connectionType == MeetingServiceType.SFU ||
              this.meetingServiceType == MeetingServiceType.SFU
            ) {
              consumer = this.mediasoupService.consumers.get(data.sender);
              if (consumer) {
                if (consumer.consumerVideo) {
                  consumer.consumerVideo.close();
                  consumer.consumerVideoStream = undefined;
                }
                if (consumer.consumerAudio) {
                  consumer.consumerAudio.close();
                  consumer.consumerAudioStream = undefined;
                }
                if (consumer.consumerScreen) {
                  consumer.consumerScreen.close();
                  consumer.consumerScreenStream = undefined;
                }
              }
            } else {
              consumer = this.meshService.consumers.get(data.sender);
              if (consumer) {
                consumer.rtcPeerConnection.close();
                this.meshService.consumers.delete(data.sender);
              }
            }
            this.meetingMembers.delete(data.sender);
          }
        });
      const onToggleAudio$ = this.apiGatewayService
        .onToggleAudio()
        .subscribe((data) => {
          console.log(
            'RECEIVING CHANGE ON AUDIO STATUS FROM MEMBER =>',
            data.meetingMemberId,
            data
          );
          const meetingMember = this.meetingMembers.get(data.meetingMemberId);
          if (meetingMember) {
            meetingMember.produceAudioEnabled = data.produceAudioEnabled;
          }
        });
      const onToggleVideo$ = this.apiGatewayService
        .onToggleVideo()
        .subscribe(async (data) => {
          console.log(
            'RECEIVING CHANGE ON VIDEO STATUS FROM MEMBER =>',
            data.meetingMemberId,
            data
          );
          const meetingMember = this.meetingMembers.get(data.meetingMemberId);
          if (meetingMember) {
            meetingMember.produceVideoEnabled = data.produceVideoEnabled;
            console.warn(
              'sfu connection',
              this.meetingDataService.hasSFUFullConnection ||
                meetingMember.hasSFUConnection
            );
            if (
              meetingMember.hasSFUConnection ||
              this.meetingDataService.hasSFUFullConnection
            ) {
              if (
                data.produceVideoEnabled &&
                !meetingMember.sfuConsumerConnection.consumerVideo
              ) {
                console.warn('not consumer video for x reason');
                await this.mediasoupService.consumerVideoStart(
                  data.meetingMemberId
                );
              }
            }
          }
        });

      const onToggleGlobalAudio$ = this.apiGatewayService
        .onToggleGlobalAudio()
        .subscribe((data) => {
          if (data.meetingMemberId === this.meetingMember._id) {
            return;
          }
          const member = this.meetingMembers.get(data.meetingMemberId);
          if (member) {
            member.produceAudioAllowed = data.produceAudioAllowed;
            let consumer;
            switch (member.connectionType) {
              case MeetingServiceType.MESH:
                consumer = this.meshService.consumers.get(data.meetingMemberId);
                if (consumer) {
                  const transceiver = consumer.noiseRecvTransceiver;
                  if (transceiver) {
                    if (data.produceAudioAllowed) {
                      transceiver.direction = 'recvonly';
                    } else {
                      transceiver.direction = 'inactive';
                    }
                  }
                }
                break;
              case MeetingServiceType.SFU:
                break;
            }
          }
        });

      const onToggleGlobalVideo$ = this.apiGatewayService
        .onToggleGlobalVideo()
        .subscribe((data) => {
          if (data.meetingMemberId === this.meetingMember._id) {
            return;
          }
          const member = this.meetingMembers.get(data.meetingMemberId);

          if (member) {
            member.produceVideoAllowed = data.produceVideoAllowed;
            let consumer;
            switch (member.connectionType) {
              case MeetingServiceType.MESH:
                consumer = this.meshService.consumers.get(data.meetingMemberId);
                if (consumer) {
                  const transceiver = consumer.videoRecvTransceiver;
                  if (transceiver) {
                    if (data.produceVideoAllowed) {
                      transceiver.direction = 'recvonly';
                    } else {
                      transceiver.direction = 'inactive';
                    }
                  }
                }
                break;
              case MeetingServiceType.SFU:
                break;
            }
          }
        });

      const onMessageReceived$ = this.apiGatewayService
        .onMessage()
        .subscribe((data) => {
          this.messages.push(data);
        });

      const onToggleScreenSharePermission$ = this.apiGatewayService
        .onToggleScreenSharePermission()
        .subscribe((data) => {
          if (data.meetingMemberId === this.meetingMember._id) {
            this.meetingMember.canScreenShare = data.canScreenShare;
          } else {
            const member = this.meetingMembers.get(data.meetingMemberId);
            if (member) {
              member.canScreenShare = data.canScreenShare;
            }
          }
        });
      const onToggleConnectionType$ = this.apiGatewayService
        .onToggleConnectionType()
        .subscribe((data) => {
          if (data.meetingMemberId !== this.meetingMember._id) {
            console.warn(
              ` MEMBER WITH id ${data.meetingMemberId} toggle service to ${data.connectionType}`
            );
            const member = this.meetingMembers.get(data.meetingMemberId);
            if (member) {
              console.warn(
                ` MEMBER WITH id ${member.id} toggle service to ${data.connectionType}`
              );
              switch (data.connectionType as MeetingServiceType) {
                case MeetingServiceType.SFU:
                  this.changeConnectionToMemberToSFU(data.meetingMemberId);
                  break;
                case MeetingServiceType.MESH:
                  this.changeConnectionToMemberToP2P(data.meetingMemberId);
                  break;
                default:
                  console.error("SHOULD'T GET HERE");
                  break;
              }
            }
          }
        });
      this.subscriptions.push(
        onStartScreenSharing$,
        onEndScreenSharing$,
        onStartBroadcasting$,
        onEndBroadcasting$,
        onMemberJoin$,
        onToggleAudio$,
        onToggleVideo$,
        onToggleGlobalAudio$,
        onToggleGlobalVideo$,
        onMeetingMemberDisconnected$,
        onMessageReceived$,
        onToggleScreenSharePermission$,
        onToggleConnectionType$
      );
    });
  }

  /**
   * Send request to validate that the meeting exists and its active
   * @param meetingId type string, Id of meeting to validate
   * @private
   */
  public async validateMeeting(meetingId: string): Promise<any> {
    return this.apiRestService.getMeeting(meetingId).toPromise();
  }

  /**
   * Send request to join the meeting
   * @param meetingMember type MeetingMemberDto
   * @private
   */
  public async joinMeeting(meetingMember: MeetingMemberDto): Promise<any> {
    try {
      return await this.apiGatewayService.joinMeeting(meetingMember);
    } catch (e) {
      console.log(e);
    }
  }
  /**
   * Inits meeting session
   * @param user type object
   * @param memberType tyoe MemberType
   * @param meetingServiceType type MeetingServiceType
   * @param meetingId type string
   */
  async initMeeting(
    user: {
      isGuest: boolean;
      sessionId: string;
      sub: string;
      username: string;
    },
    memberType: MemberType,
    meetingServiceType: MeetingServiceType,
    meetingId?: string
  ): Promise<void> {
    if (meetingId) {
      try {
        const result = await this.getLocalMediaDevices(memberType);
        if (result) {
          this.meetingMember = {
            isGuest: user.isGuest,
            userId: user.sub ? user.sub : user.sessionId,
            sessionUserId: user.sessionId,
            memberType: memberType,
            isScreenSharing: false,
            produceAudioEnabled: false,
            produceVideoEnabled: false,
            connectionType:
              meetingServiceType === MeetingServiceType.BOTH
                ? MeetingServiceType.MESH
                : meetingServiceType,
          };
          const meeting: MeetingDto = await this.validateMeeting(meetingId);
          if (meeting._id) {
            if (!meeting.isBroadcasting && memberType === MemberType.CONSUMER) {
              return;
            }
            this.meetingId = meeting._id;
            this.meetingServiceType = meetingServiceType;
            this.meetingMember.meetingId = meeting._id;
            this.isBroadcasting = meeting.isBroadcasting;
            let nickname = localStorage.getItem(environment.lsGuessName);
            if (!nickname) {
              await Swal.fire({
                title: 'Nickname',
                html: `<input type="text" id="input-nickname" class="swal2-input" placeholder="Nickname"> `,
                showCancelButton: false,
                confirmButtonText: 'Ok',
                focusConfirm: false,
                showLoaderOnConfirm: true,
                preConfirm: () => {
                  const input = Swal.getPopup()?.querySelector(
                    '#input-nickname'
                  ) as HTMLInputElement;
                  const nickname = input.value;
                  if (nickname) {
                    localStorage.setItem(environment.lsGuessName, nickname);
                  } else {
                    Swal.showValidationMessage(
                      'Debe de ingresar su nombre de usuario'
                    );
                  }
                  return {
                    nickname: nickname,
                  };
                },
              })
                .then((result) => {
                  nickname = result.value!.nickname;
                })
                .catch((e) => {
                  console.log(e);
                });
            }
            this.meetingMember.nickname = nickname
              ? nickname
              : this.meetingMember.userId;
            this.joinMeeting(this.meetingMember)
              .then(async (resAddMeetingMember) => {
                if (resAddMeetingMember.success) {
                  if (memberType === MemberType.CONSUMER) {
                    await Swal.fire({
                      title: 'Welcome',
                      showCancelButton: false,
                      confirmButtonText: 'Ok',
                    })
                      .then((result) => {
                        console.log(result);
                      })
                      .catch((e) => {
                        console.log(e);
                      });
                  }
                  this.isMeetingCreator =
                    resAddMeetingMember.payload.isMeetingCreator;
                  this.meetingMember._id = resAddMeetingMember.payload._id;
                  this.meetingMember.canScreenShare =
                    resAddMeetingMember.payload.canScreenShare;
                  this.meetingMember.produceAudioAllowed =
                    resAddMeetingMember.payload.produceAudioAllowed;
                  this.meetingMember.produceVideoAllowed =
                    resAddMeetingMember.payload.produceVideoAllowed;
                  await Promise.all([
                    this.initMeshInstance(),
                    this.initSFUInstance(),
                  ]);
                  this._isMeetingReady = true;
                  this.apiRestService
                    .getMeetingMembers(meetingId)
                    .toPromise()
                    .then((resGetMeetingMembers) => {
                      const activeMembers = resGetMeetingMembers.activeMembers;
                      console.warn('active meeting members', activeMembers);
                      activeMembers.forEach((member: any) => {
                        if (member._id !== this.meetingMember._id) {
                          const meetingMember = new MeetingMember(member);
                          this.meetingMembers.set(member._id, meetingMember);
                          if (
                            meetingMember.connectionType ===
                              MeetingServiceType.SFU ||
                            this.meetingServiceType === MeetingServiceType.SFU
                          ) {
                            Promise.all([
                              this.mediasoupService.consumerVideoStart(
                                member._id
                              ),
                              this.mediasoupService.consumerAudioStart(
                                member._id
                              ),
                            ]);
                          } else {
                            this.meshService.initReceive(
                              this.meetingMember,
                              member._id
                            );
                          }
                        }
                      });
                      const activeViewers = resGetMeetingMembers.activeViewers;
                      activeViewers.forEach((viewer: any) => {
                        const meetingViewer = new MeetingMember(viewer);
                        this.meetingViewers.set(viewer._id, meetingViewer);
                      });
                    })
                    .catch((e) => {
                      console.error(e.message, e.stack);
                    });
                } else {
                  const msg = resAddMeetingMember.payload;
                  //TODO redirect to error page
                  console.error(msg);
                  this.router.navigate(['/error-page'], {
                    state: {
                      errorMessage: msg,
                    },
                  });
                }
              })
              .catch((e) => {
                console.error(e.message, e.stack);
              });
          } else {
            this.router.navigate(['/error-page'], {
              state: {
                errorMessage: 'Invalid meeting link.',
              },
            });
          }
        }
      } catch (e) {
        console.log(e.message, e.stack);
        this.router.navigate(['/error-page'], {
          state: {
            errorMessage: e.message,
          },
        });
      }
    } else {
      this.router.navigate(['/error-page'], {
        state: {
          errorMessage: 'Invalid meeting link.',
        },
      });
    }
  }

  /**
   * Pause local video track transmission
   */
  videoPause(): boolean {
    if (this._videoTrack) {
      if (this._videoTrack.enabled) {
        if (this.meetingMember.produceVideoEnabled) {
          this.apiGatewayService.toggleVideo({
            meetingId: this.meetingId,
            meetingMemberId: this.meetingMember._id!,
            produceVideoEnabled: false,
          });
          this._videoTrack.enabled = false;
          this.meetingMember.produceVideoEnabled = false;
          Promise.all([
            this.mediasoupService.producerVideoPause(this.meetingMember._id!),
            this.meshService.pauseVideoTrack(),
          ]);
          // switch (this.meetingServiceType) {
          //   case MeetingServiceType.MESH: {
          //     const consumers = this.meshService.consumers;
          //     if (consumers.size > 0) {
          //       consumers.forEach((consumer) => {
          //         if (consumer.rtcPeerConnection.signalingState !== 'closed') {
          //           consumer.videoSendTransceiver.direction = 'inactive';
          //         }
          //       });
          //     }
          //     if (this.isBroadcasting) {
          //       this.mediasoupService.producerVideoPause(
          //         this.meetingMember._id!
          //       );
          //     }
          //     break;
          //   }
          //   case MeetingServiceType.SFU:
          //     this.mediasoupService.producerVideoPause(this.meetingMember._id!);
          //     break;
          // }
        }
      }
    }
    return false;
  }
  /**
   * Resume local video track transmission
   */
  async videoResume(): Promise<boolean> {
    console.log(this._videoTrack);
    if (this._videoTrack) {
      if (!this._videoTrack.enabled) {
        if (!this.meetingMember.produceVideoEnabled) {
          this._videoTrack.enabled = true;
          this.meetingMember.produceVideoEnabled = true;
          console.log('here');
          await Promise.all([
            this.mediasoupService.producerVideoResume(this.meetingMember._id!),
            this.meshService.resumeVideoTrack(),
          ]);
          // switch (this.meetingServiceType) {
          //
          //   case MeetingServiceType.MESH: {
          //     const consumers = this.meshService.consumers;
          //     if (consumers.size > 0) {
          //       consumers.forEach((consumer) => {
          //         if (consumer.rtcPeerConnection.signalingState != 'closed') {
          //           consumer.videoSendTransceiver.direction = 'sendonly';
          //         }
          //       });
          //       if (this.isBroadcasting) {
          //         this.mediasoupService.producerVideoResume(
          //           this.meetingMember._id!
          //         );
          //       }
          //     }
          //     break;
          //   }
          //   case MeetingServiceType.SFU:
          //     this.mediasoupService.producerVideoResume(
          //       this.meetingMember._id!
          //     );
          //     break;
          // }
          const result = await this.apiGatewayService.toggleVideo({
            meetingId: this.meetingId,
            meetingMemberId: this.meetingMember._id!,
            produceVideoEnabled: true,
          });
          console.log('video resume', result);
          return true;
        }
      }
    }
    return false;
  }
  /**
   * Pause local audio track transmission
   */
  audioPause(): boolean {
    if (this._audioTrack) {
      if (this.meetingMember.produceAudioEnabled) {
        this.apiGatewayService.toggleAudio({
          meetingId: this.meetingId,
          meetingMemberId: this.meetingMember._id!,
          produceAudioEnabled: false,
        });
        this._audioTrack.enabled = false;
        switch (this.meetingServiceType) {
          case MeetingServiceType.MESH: {
            const consumers = this.meshService.consumers;
            if (consumers.size > 0) {
              consumers.forEach((consumer) => {
                if (consumer.rtcPeerConnection.signalingState !== 'closed') {
                  consumer.noiseSendTransceiver.direction = 'inactive';
                }
              });
            }
            if (this.isBroadcasting) {
              this.mediasoupService.producerAudioPause(this.meetingMember._id!);
            }
            this.meetingMember.produceAudioEnabled = false;
            break;
          }
          case MeetingServiceType.SFU:
            this.mediasoupService.producerAudioPause(this.meetingMember._id!);
            break;
        }
      }
    }
    return false;
  }
  /**
   * Pauses local audio track transmission
   */
  audioResume(): boolean {
    if (this._audioTrack) {
      if (!this.meetingMember.produceAudioEnabled) {
        this._audioTrack.enabled = true;
        switch (this.meetingServiceType) {
          case MeetingServiceType.MESH: {
            const consumers = this.meshService.consumers;
            if (consumers.size > 0) {
              consumers.forEach((consumer) => {
                if (consumer.rtcPeerConnection.signalingState !== 'closed') {
                  consumer.noiseSendTransceiver.direction = 'sendonly';
                }
              });
            }
            if (this.isBroadcasting) {
              this.mediasoupService.producerAudioResume(
                this.meetingMember._id!
              );
            }
            this.meetingMember.produceAudioEnabled = true;
            break;
          }
          case MeetingServiceType.SFU:
            this.mediasoupService.producerAudioResume(this.meetingMember._id!);
            break;
        }
        this.apiGatewayService.toggleAudio({
          meetingId: this.meetingId,
          meetingMemberId: this.meetingMember._id!,
          produceAudioEnabled: true,
        });
        return true;
      }
    }
    return false;
  }
  /**
   * Enable or disable audio stream reception from the selected user on the rest of meeting members
   * @param key type string, id of the remote meeting member to whom the action will be performed
   */
  async globalAudioToggle(key: string): Promise<void> {
    const meetingMember = this.meetingMembers.get(key);
    if (meetingMember) {
      switch (meetingMember.connectionType) {
        case MeetingServiceType.MESH:
          break;
        case MeetingServiceType.SFU:
          this.mediasoupService.globalToggleMedia(key, 'audio');
          break;
      }
      const result = await this.apiGatewayService.toggleGlobalAudio({
        meetingId: this.meetingId,
        meetingMemberId: key,
        produceAudioAllowed: !meetingMember.produceAudioAllowed,
      });
      console.log('toggleglobalaudio', result);
    }
  }
  /**
   * Enable or disable video stream reception from the selected user on the rest of meeting members
   * @param key type string, id of the remote meeting member to whom the action will be performed
   */
  async globalVideoToggle(key: string): Promise<void> {
    const meetingMember = this.meetingMembers.get(key);
    if (meetingMember) {
      switch (meetingMember.connectionType) {
        case MeetingServiceType.MESH:
          break;
        case MeetingServiceType.SFU:
          this.mediasoupService.globalToggleMedia(key, 'video');
          break;
      }
      const result = await this.apiGatewayService.toggleGlobalVideo({
        meetingId: this.meetingId,
        meetingMemberId: key,
        produceVideoAllowed: !meetingMember.produceVideoAllowed,
      });
    }
  }

  /**
   * Enable or disable screen share capability from the selected user to the rest of the meeting members
   * @param key type string, id of the remote meeting member to whom the action will be performed
   */
  async screenSharePermissionToggle(key: string) {
    const meetingMember = this.meetingMembers.get(key);
    if (meetingMember) {
      const result = await this.apiGatewayService.toggleScreenSharePermission({
        meetingId: this.meetingId,
        meetingMemberId: key,
        canScreenShare: !meetingMember.canScreenShare,
      });
    }
  }
  /**
   * Inits MeshService instance
   */
  async initMeshInstance() {
    this.meshService = new P2pWebrtcService(
      new SignalingService(new SignalingSocket()),
      this.meetingDataService
    );
    this.meshService.localMeetingMember = this.meetingMember;
    this.meshService.meetingMemberId = this.meetingMember._id!;
    this.meshService.localStream = this.localStream
      ? this.localStream
      : new MediaStream();

    this.meshService.onConnectionReady().subscribe((isReady) => {
      if (isReady) {
        this._isMeetingReady = isReady;
        this.meshService.joinMeeting(this.meetingMember);
      }
    });
  }
  /**
   * Inits SFU instance connection to its wss service
   */
  async initSFUInstance(skipConsume = false) {
    this.mediasoupService.initWssService();
    const onMediasoupServiceConnectionReady$ = this.mediasoupService
      .onConnectionReady()
      .subscribe(async (data) => {
        this.isMediasoupReady = true;
        await this.mediasoupService.joinRoom(this.meetingMember, skipConsume);
        await this.mediasoupService.initMediaProduction();
      });
    this.subscriptions.push(onMediasoupServiceConnectionReady$);
  }
  /**
   * Starts screen share
   */
  public async startScreenShare(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.meetingMember.meetingId && this.meetingMember._id) {
        const { meetingId, _id } = this.meetingMember;
        this.deviceManagerService
          .getDisplayMedia()
          .then(async (stream) => {
            switch (this.meetingServiceType) {
              case MeetingServiceType.MESH:
                this.meshService.startScreenSharing(stream);
                break;
              case MeetingServiceType.SFU:
                try {
                  await this.mediasoupService.startScreenShare(stream);
                } catch (e) {
                  console.error(e.message, 'SFU ERROR SHARE CONTENT');
                  return;
                }
                break;
              case MeetingServiceType.BOTH:
                break;
            }
            this.apiGatewayService.startScreenSharing({
              meetingId: meetingId,
              meetingMemberId: _id,
            });
            this.meetingMember.isScreenSharing = true;
            stream.getVideoTracks()[0].addEventListener('ended', async () => {
              this.apiGatewayService.stopScreenSharing({
                meetingId: meetingId,
                meetingMemberId: _id,
              });
              this.meetingMember.isScreenSharing = false;
            });
            resolve(true);
          })
          .catch((e) => {
            this.handleDisplayMediaError(e);
            resolve(false);
          });
      } else {
        resolve(false);
      }
    });
  }
  /**
   * Displey media error handler
   * @param e
   */
  private handleDisplayMediaError = (e: any) => {
    console.log(e.message, e.name);
    switch (e.name) {
      case 'NotAllowedError':
        break;
      case 'PermissionDeniedError':
        break;
      case 'NotFoundError':
        Swal.fire({
          icon: 'error',
          title: 'NOT FOUND ERROR',
          text: 'No sources of screen video are available for capture',
          allowOutsideClick: true,
          confirmButtonText: 'CERRAR',
        })
          .then((result) => {
            return;
          })
          .catch((error) => {
            console.error(error, 'Swal Exception ' + e.name);
          });
        break;
      case 'NotReadableError':
        Swal.fire({
          icon: 'error',
          title: 'NOT READABLE ERROR',
          text: 'A hardware or operating system level error or lockout occurred, preventing the sharing of the selected source.',
          allowOutsideClick: true,
          confirmButtonText: 'CERRAR',
        })
          .then((result) => {
            return;
          })
          .catch((error) => {
            console.error(error, 'Swal Exception ' + e.name);
          });
        break;
      case 'TypeError':
        console.info(
          'The list of constraints specified is empty, or has all constraints set to false, or you tried to call getUserMedia() in an insecure context.',
          e.name
        );
        break;
      case 'OverconstrainedError':
      default:
        console.log(e.message, e.name);
        break;
    }
  };
  /**
   * Starts broadcasting session using SFU instance
   * @param meetingMember
   */
  public async startBroadcastingSession() {
    return this.apiRestService
      .startBroadcastingSession(
        this.meetingMember.meetingId!,
        this.meetingMember.userId,
        this.meetingMember.sessionUserId
      )
      .toPromise()
      .then(() => {
        this.isBroadcasting = true;
      });
  }
  /**
   * Ends broadcasting session
   * @param meetingMember
   */
  public async endBroadcastingSession() {
    return this.apiRestService
      .endBroadcastingSession(
        this.meetingMember.meetingId!,
        this.meetingMember.userId,
        this.meetingMember.sessionUserId
      )
      .toPromise()
      .then(() => {
        this.isBroadcasting = false;
      });
  }
  /**
   * Gets local stream media using getUserMedia API
   * @param memberType
   */
  async getLocalMediaDevices(memberType: MemberType): Promise<boolean> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        if (memberType !== MemberType.CONSUMER) {
          const stream = await this.deviceManagerService.getUserMedia();
          this.handleGetUserMedia(stream);
        }
        resolve(true);
      } catch (e) {
        this.handleMediaDevicesError(e);
        reject(false);
      }
    });
  }
  /**
   * getUserMedia handler, sets local stream audio and video tracks and add speech events to follow changes on audio track volume using hark library
   * @param stream type MediaStream
   * @private
   */
  private handleGetUserMedia(stream: MediaStream) {
    this.localStream = stream;
    const videoTracks = this.localStream.getVideoTracks();
    const audioTracks = this.localStream.getAudioTracks();
    if (videoTracks) {
      this._videoTrack = videoTracks[0];
      if (this._videoTrack) this._videoTrack.enabled = false;
    }
    if (audioTracks) {
      this._audioTrack = audioTracks[0];
      if (this._audioTrack) this._audioTrack.enabled = false;
      const speechEvents = hark(stream, { play: false });
      speechEvents.on('volume_change', (dBs, threshold) => {
        if (!this.meetingMember.produceAudioEnabled) return;
        // The exact formula to convert from dBs (-100..0) to linear (0..1) is:
        //   Math.pow(10, dBs / 20)
        // However it does not produce a visually useful output, so let exagerate
        // it a bit. Also, let convert it from 0..1 to 0..10 and avoid value 1 to
        // minimize component renderings.
        let audioVolume = Math.round(Math.pow(10, dBs / 85) * 10);
        if (audioVolume === 1) audioVolume = 0;
        if (audioVolume !== this.activeSpeaker) {
          this.activeSpeaker = audioVolume;
        }
      });
    }
    this.localStream.getTracks().forEach((track: MediaStreamTrack) => {
      track.enabled = false;
    });
    return true;
  }
  /**
   * getUserMedia error handler
   * @param e
   */
  private handleMediaDevicesError = (e: any) => {
    switch (e.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        Swal.fire({
          icon: 'error',
          title:
            'No tenemos permiso para acceder a su micrófono ni a su cámara.\n' +
            'Verifique si su navegador necesita permiso.',
          text: 'Importante: El navegador necesita acceso a su micrófono para reproducir el audio, incluso si no desea hablar. Para escuchar a los demás en una sesión, permita que el navegador acceda a su micrófono.',
          allowOutsideClick: false,
          confirmButtonText: 'REINTENTAR',
        })
          .then((result) => {
            location.reload();
          })
          .catch((error) => {
            console.error(error, 'Swal Exception ' + e.name);
          });
        break;
      case 'NotFoundError':
      case 'DevicesNotFoundError':
      case 'NotReadableError':
        console.error(e);
        Swal.fire({
          icon: 'error',
          title:
            'No se ha podido acceder a su micrófono o cámara.' +
            'Por favor verifique que su dispositivo esta conectado.',
          text: 'Importante: El navegador necesita acceso a su micrófono para reproducir el audio, incluso si no desea hablar. Para escuchar a los demás en una sesión, permita que el navegador acceda a su micrófono.',
          allowOutsideClick: false,
          confirmButtonText: 'REINTENTAR',
        })
          .then((result) => {
            return;
          })
          .catch((error) => {
            console.error(error, 'Swal Exception ' + e.name);
          });
        break;
      case 'TypeError':
        console.info(
          'The list of constraints specified is empty, or has all constraints set to false, or you tried to call getUserMedia() in an insecure context.',
          e.name
        );
        break;
      case 'OverconstrainedError':
      default:
        console.log(e.message, e.name);
        break;
    }
    return false;
  };

  // /**
  //  * Gets audio MediaStream object from the meeting member
  //  * @param key type string,  meeting member id
  //  */
  // getMeetingMemberAudio(key: string): MediaStream | undefined {
  //   const member = this.meetingMembers.get(key);
  //   if (member) {
  //     let consumer;
  //     switch (this.meetingServiceType) {
  //       case MeetingServiceType.MESH:
  //         consumer = this.meshService.consumers.get(key);
  //         if (consumer) {
  //           return consumer.remoteAudioTrack;
  //         }
  //         break;
  //       case MeetingServiceType.SFU:
  //         consumer = this.mediasoupService.consumers.get(key);
  //         if (consumer) {
  //           return consumer.consumerAudioStream;
  //         }
  //         break;
  //       case MeetingServiceType.BOTH:
  //         switch (member.connectionType) {
  //           case MeetingServiceType.MESH:
  //             consumer = this.meshService.consumers.get(key);
  //             if (consumer) {
  //               return consumer.remoteAudioTrack;
  //             }
  //             break;
  //           case MeetingServiceType.SFU:
  //             consumer = this.mediasoupService.consumers.get(key);
  //             if (consumer) {
  //               return consumer.consumerAudioStream;
  //             }
  //             break;
  //         }
  //         break;
  //     }
  //   }
  //   return;
  // }
  // /**
  //  * Gets video MediaStream object from the meeting member
  //  * @param key type string,  meeting member id
  //  */
  // getMeetingMemberVideo(key: string): MediaStream | undefined {
  //   const member = this.meetingMembers.get(key);
  //   if (member) {
  //     let consumer;
  //     this.getConsumers();
  //     switch (this.meetingServiceType) {
  //       case MeetingServiceType.SFU:
  //         consumer = this.mediasoupService.consumers.get(key);
  //         if (consumer) {
  //           return consumer.consumerVideoStream;
  //         }
  //         break;
  //       case MeetingServiceType.MESH:
  //         consumer = this.meshService.consumers.get(key);
  //         if (consumer) {
  //           return consumer.remoteVideoTrack;
  //         }
  //         break;
  //       case MeetingServiceType.BOTH:
  //         switch (member.connectionType) {
  //           case MeetingServiceType.MESH:
  //             consumer = this.meshService.consumers.get(key);
  //             if (consumer) {
  //               return consumer.remoteVideoTrack;
  //             }
  //             break;
  //           case MeetingServiceType.SFU:
  //             consumer = this.mediasoupService.consumers.get(key);
  //             if (consumer) {
  //               return consumer.consumerVideoStream;
  //             }
  //             return;
  //         }
  //         break;
  //     }
  //   }
  //   return;
  // }
  /**
   * Gets screen video MediaStream object from the meeting member
   * @param key type string,  meeting member id
   */
  // getMeetingMemberScreenVideo(key: string): MediaStream | undefined {
  //   const member = this.meetingMembers.get(key);
  //   if (member) {
  //     let consumer;
  //     switch (member.connectionType) {
  //       case MeetingServiceType.MESH:
  //         consumer = this.meshService.consumers.get(key);
  //         if (consumer) {
  //           return consumer.screenStream;
  //         }
  //         break;
  //       case MeetingServiceType.SFU:
  //         consumer = this.mediasoupService.consumers.get(key);
  //         if (consumer) {
  //           return consumer.consumerScreenStream;
  //         }
  //         break;
  //     }
  //   }
  //   return;
  // }

  async getSessionStats() {
    switch (this.meetingMember.connectionType) {
      case MeetingServiceType.SFU:
        await this.mediasoupService.getStats().then(() => {});
        break;
      case MeetingServiceType.MESH:
        this.meetingMembers.forEach(async (member) => {
          switch (member.connectionType) {
            case MeetingServiceType.MESH: {
              const consumer = this.meshService.consumers.get(member.id!);
              if (consumer) {
                // const prevStats = { ...consumer.getStatsResult };
                // console.log(Date.now());
                await consumer.getStats().then(() => {
                  // console.log(Date.now());
                  // console.warn('prevstats', prevStats);
                  // console.warn('currentstats', consumer.getStatsResult);
                });
              }
              break;
            }
          }
        });
        break;
      case MeetingServiceType.BOTH:
        break;
    }
  }

  onDestroy(): void {
    this.localStream?.getTracks().forEach((track) => {
      track.stop();
    });
    if (this.meshService) this.meshService.onDestroy();
    this.mediasoupService.onDestroy();
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
    this.subscriptions = [];
  }

  async toggleService() {
    let toggleTo;
    switch (this.meetingServiceType) {
      case MeetingServiceType.MESH:
        toggleTo = MeetingServiceType.SFU;
        break;
      case MeetingServiceType.SFU:
        toggleTo = MeetingServiceType.MESH;
        break;
    }
    if (toggleTo) {
      const result = await this.apiGatewayService.toggleConnectionType({
        meetingId: this.meetingId,
        meetingMemberId: this.meetingMember._id!,
        connectionType: toggleTo,
      });
      console.log('toggle service', result);
      if (result.success) {
        if (
          this.meetingDataService.meetingServiceType === MeetingServiceType.MESH
        ) {
          this.meetingDataService.meetingServiceType = MeetingServiceType.SFU;
          await this.mediasoupService.initMediaProduction();
          // this.meetingDataService.meetingMembers.forEach((member) => {
          //   if (member.p2pConsumerConnection) {
          //     member.p2pConsumerConnection.rtcPeerConnection.close();
          //   }
          // });
        } else {
          this.meetingDataService.meetingServiceType = MeetingServiceType.MESH;
        }
      }
    }
  }

  private async changeConnectionToMemberToP2P(
    meetingMemberId: string
  ): Promise<void> {
    const member = this.meetingMembers.get(meetingMemberId);
    if (member) {
      member.connectionType = MeetingServiceType.MESH;
      this.meshService.initReceive(this.meetingMember, meetingMemberId);
      setTimeout(() => {
        this.mediasoupService.producerVideoPause(this.meetingMember._id!);
      }, 6000);
      // await new Promise<void>((resolve, reject) => {
      //   (function waitForStateCompleted() {
      //     console.error('waitforstatecompleted');
      //     if (
      //       member.p2pConsumerConnection.connected &&
      //       member.p2pConsumerConnection.remoteVideoTrack
      //     ) {
      //       member.sfuConsumerConnection.consumerVideoStream
      //         ?.getVideoTracks()
      //         .forEach((track) => {
      //           track.stop();
      //         });
      //       member.sfuConsumerConnection.consumerVideoStream
      //         ?.getAudioTracks()
      //         .forEach((track) => {
      //           track.stop();
      //         });
      //       member.sfuConsumerConnection.consumerVideo?.close();
      //       member.sfuConsumerConnection.consumerAudio?.close();
      //       return resolve();
      //     }
      //     setTimeout(waitForStateCompleted, 30);
      //   });
      // });
    }
  }

  private async changeConnectionToMemberToSFU(
    meetingMemberId: string
  ): Promise<void> {
    const member = this.meetingMembers.get(meetingMemberId);
    if (member) {
      member.sfuConsumerConnection = new SfuConsumer();
      await Promise.all([
        this.mediasoupService.consumerVideoStart(meetingMemberId),
        this.mediasoupService.consumerAudioStart(meetingMemberId),
      ]);
      console.warn('close peer connection', member.videoStream);
      // member.connectionType = MeetingServiceType.SFU;
      member.p2pConsumerConnection.rtcPeerConnection.close();
    }
  }

  producerVideoStatus(): void {
    console.log('producervideo', this.mediasoupService.producerVideo);
    console.log(
      'producervideopaused',
      this.mediasoupService.producerVideo?.paused
    );
  }

  /**
   * Build message to emit to the rest of members
   * @param value
   */
  sendMessage(value: string): void {
    const todayDate: Date = new Date();
    const message = {
      meetingMemberId: this.meetingMember._id!,
      text: value,
      timestamp: todayDate.toLocaleString(),
      nickname: this.meetingMember.nickname
        ? this.meetingMember.nickname
        : this.meetingMember._id!,
    };
    this.messages.push(message);
    this.apiGatewayService.sendMessage(message, this.meetingId);
  }
}
