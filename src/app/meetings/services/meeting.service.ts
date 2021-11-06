import { Injectable } from '@angular/core';
import { ApiGatewayService } from './api-connection/api-gateway.service';
import { interval, Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { DeviceService } from '../../shared/helpers/device-manager.service';
import { ApiRestService } from './api-connection/api-rest.service';
import {
  AudioConsumerStats,
  ConsumerStatsSnapshot,
  CurrentSessionStats,
  MeetingDto,
  MeetingMemberDto,
  MeetingServiceType,
  MemberType,
  TChatDto,
  VideoConsumerStats,
} from '../types/defines';
import { NGXLogger } from 'ngx-logger';
import { P2pWebrtcService } from './p2p-connection/p2p-webrtc.service';
import { SignalingService } from './p2p-connection/signaling.service';
import { SignalingSocket } from '../types/custom-sockets';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { MeetingDataService } from './meeting-data.service';
import { SfuWebrtcService } from './mediasoup-connection/mediasoup.service';
import { MeetingMember } from '../types/meeting-member.class';
import { first } from 'rxjs/operators';

@Injectable()
export class MeetingService {
  get isScreenSharing(): boolean {
    return this._isScreenSharing;
  }

  set isScreenSharing(value: boolean) {
    this._isScreenSharing = value;
  }
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
  private _isScreenSharing = false;
  private _screenStream: MediaStream | null | undefined;

  get screenStream(): MediaStream | null | undefined {
    return this.meetingDataService.screenStream;
  }

  set screenStream(value: MediaStream | null | undefined) {
    this.meetingDataService.screenStream = value;
  }

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
          this.isScreenSharing = true;
        });
      const onEndScreenSharing$ = this.apiGatewayService
        .onStopScreenSharing()
        .subscribe((data) => {
          console.log(data, 'stopscreensharing');
          const member = this.meetingMembers.get(data.meetingMemberId);
          if (member) {
            member.isScreenSharing = data.isScreenSharing;
          }
          this.isScreenSharing = false;
        });
      const onStartBroadcasting$ = this.apiGatewayService
        .onStartMeetingBroadcast()
        .subscribe((data) => {
          if (!this.isMediasoupReady) {
            this.mediasoupService.initMediaProduction();
          }
          this.isBroadcasting = true;
        });
      const onEndBroadcasting$ = this.apiGatewayService
        .onEndMeetingBroadcast()
        .subscribe((data) => {
          console.log('endBroadcastingSession', data);
          console.log(data);
          if (this.meetingServiceType === 'MESH' && this.isMediasoupReady) {
            // this.mediasoupService.leaveSfuSession();
          }
          this.isBroadcasting = false;
        });

      const onMeetingMemberDisconnected$ = this.apiGatewayService
        .onMeetingMemberDisconnected()
        .subscribe((data) => {
          this.meetingViewers.delete(data.sender);
          const member = this.meetingMembers.get(data.sender);
          if (member) {
            // if (
            //   member.connectionType == MeetingServiceType.SFU ||
            //   this.meetingServiceType == MeetingServiceType.SFU
            // ) {
            //
            // } else {
            //   consumer = this.meshService.consumers.get(data.sender);
            //   if (consumer) {
            //     consumer.rtcPeerConnection.close();
            //     this.meshService.consumers.delete(data.sender);
            //   }
            // }
            const sfuConsumer = member.sfuConsumerConnection;
            const p2pConsumer = member.p2pConsumerConnection;
            if (sfuConsumer) {
              if (sfuConsumer.consumerVideo) {
                sfuConsumer.consumerVideo.close();
                sfuConsumer.consumerVideoTrack = undefined;
              }
              if (sfuConsumer.consumerAudio) {
                sfuConsumer.consumerAudio.close();
                sfuConsumer.consumerAudioTrack = undefined;
              }
              if (sfuConsumer.consumerScreen) {
                sfuConsumer.consumerScreen.close();
                sfuConsumer.consumerScreenStream = undefined;
              }
            }

            if (p2pConsumer) {
              p2pConsumer.onDestroy();
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
            switch (member.remoteConnectionType) {
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
            switch (member.remoteConnectionType) {
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
            const member = this.meetingMembers.get(data.meetingMemberId);
            if (member) {
              console.warn(
                ` MEMBER WITH id ${member.id} toggle service to ${data.connectionType}`
              );
              switch (data.connectionType as MeetingServiceType) {
                case MeetingServiceType.SFU:
                  this.changeConnectionOfMemberToSFU(data.meetingMemberId);
                  break;
                case MeetingServiceType.MESH:
                  this.changeConnectionOfMemberToP2P(data.meetingMemberId);
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
        // onMemberJoin$,
        onToggleAudio$,
        onToggleVideo$,
        onToggleGlobalAudio$,
        onToggleGlobalVideo$,
        onMeetingMemberDisconnected$,
        onMessageReceived$,
        onToggleScreenSharePermission$,
        onToggleConnectionType$
        // interval$
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
        console.warn('INIT MEETING');
        const result = await this.getLocalMediaDevices(memberType);
        if (result) {
          this.meetingMember = {
            userId: user.sub ? user.sub : user.sessionId,
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
          console.warn(meeting);
          if (meeting._id) {
            if (!meeting.isBroadcasting && memberType === MemberType.CONSUMER) {
              this.router.navigate(['/error-page'], {
                state: {
                  errorMessage:
                    "Invalid meeting link. This session doesn't have broadcasting option active.",
                },
              });
              return;
            }
            this.meetingId = meeting._id;
            this.meetingServiceType = meetingServiceType;
            this.meetingMember.meetingId = meeting._id;
            this.isBroadcasting = meeting.isBroadcasting;
            let nickname;
            if (environment.development) {
              nickname = this.meetingMember.userId;
            } else {
              nickname = localStorage.getItem(environment.lsGuessName);
            }

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
                  console.error(e);
                });
            }
            this.meetingMember.nickname = nickname
              ? nickname
              : this.meetingMember.userId;
            this.joinMeeting(this.meetingMember)
              .then(async (resAddMeetingMember) => {
                console.warn(resAddMeetingMember);
                if (resAddMeetingMember.success) {
                  const onMemberJoin$ = this.apiGatewayService
                    .onJoinMeeting()
                    .subscribe((data) => {
                      console.warn('member join', data);
                      const member = new MeetingMember({
                        ...data,
                        localConnectionType: this.meetingMember.connectionType,
                      });
                      if (data.member === MemberType.CONSUMER) {
                        this.meetingViewers.set(data._id, member);
                      } else {
                        const meetingMember = this.meetingMembers.get(data._id);
                        if (!meetingMember) {
                          this.meetingMembers.set(data._id, member);
                        }
                      }
                    });
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
                  const interval$ = interval(10000).subscribe((val) => {
                    if (
                      this.meetingMembers.size > 0 ||
                      this.meetingViewers.size > 0
                    ) {
                      this.getSessionStats();
                    }
                  });
                  this.apiRestService
                    .getMeetingMembers(meetingId)
                    .toPromise()
                    .then((resGetMeetingMembers) => {
                      const activeMembers = resGetMeetingMembers.activeMembers;
                      activeMembers.forEach(async (member: any) => {
                        if (member._id !== this.meetingMember._id) {
                          let meetingMember = this.meetingMembers.get(
                            member._id
                          );
                          if (!meetingMember) {
                            meetingMember = new MeetingMember({
                              ...member,
                              localConnectionType:
                                this.meetingMember.connectionType,
                            });
                            this.meetingMembers.set(member._id, meetingMember);
                          }
                          this.isScreenSharing = member.isScreenSharing;
                          await Promise.all([
                            this.initRemoteConsumers(meetingMember),
                            this.meshService.initReceive(
                              this.meetingMember,
                              member._id
                            ),
                          ]);
                          // if (
                          //   meetingMember.connectionType ===
                          //     MeetingServiceType.SFU ||
                          //   this.meetingServiceType === MeetingServiceType.SFU
                          // ) {
                          // } else {
                          //
                          // }
                        }
                      });
                      const activeViewers = resGetMeetingMembers.activeViewers;
                      activeViewers.forEach((viewer: any) => {
                        const meetingViewer = new MeetingMember(viewer);
                        this.meetingViewers.set(viewer._id, meetingViewer);
                      });
                      this._isMeetingReady = true;
                    })
                    .catch((e) => {
                      console.error(e.message, e.stack);
                    });
                  this.subscriptions.push(onMemberJoin$, interval$);
                } else {
                  const msg = resAddMeetingMember.payload;
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
        console.error(e.message, e.stack);
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

  async initRemoteConsumers(meetingMember: MeetingMember): Promise<void> {
    if (!meetingMember.isScreenSharing) {
      Promise.all([
        this.mediasoupService.consumerVideoStart(meetingMember.id),
        this.mediasoupService.consumerAudioStart(meetingMember.id),
      ]);
    } else {
      Promise.all([
        this.mediasoupService.consumerVideoStart(meetingMember.id),
        this.mediasoupService.consumerAudioStart(meetingMember.id),
        this.mediasoupService.consumerScreenMediaStart(meetingMember.id),
      ]);
    }
  }

  /**
   * Pause local video track transmission
   */
  videoPause(): boolean {
    console.log('video pause');
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
        }
      }
    }
    return false;
  }
  /**
   * Resume local video track transmission
   */
  async videoResume(): Promise<boolean> {
    console.log('video pause');
    if (this._videoTrack) {
      if (!this._videoTrack.enabled) {
        if (!this.meetingMember.produceVideoEnabled) {
          this._videoTrack.enabled = true;
          this.meetingMember.produceVideoEnabled = true;
          await Promise.all([
            this.mediasoupService.producerVideoResume(this.meetingMember._id!),
            this.meshService.resumeVideoTrack(),
          ]);
          const result = await this.apiGatewayService.toggleVideo({
            meetingId: this.meetingId,
            meetingMemberId: this.meetingMember._id!,
            produceVideoEnabled: true,
          });
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
    console.log('audio pause');
    if (this._audioTrack) {
      if (this.meetingMember.produceAudioEnabled) {
        this.apiGatewayService.toggleAudio({
          meetingId: this.meetingId,
          meetingMemberId: this.meetingMember._id!,
          produceAudioEnabled: false,
        });
        this._audioTrack.enabled = false;
        this.meetingMember.produceAudioEnabled = false;
        Promise.all([
          this.mediasoupService.producerAudioPause(this.meetingMember._id!),
          this.meshService.pauseAudioTrack(),
        ]);
      }
    }
    return false;
  }
  /**
   * Pauses local audio track transmission
   */
  async audioResume(): Promise<boolean> {
    console.log('audio resume');
    if (this._audioTrack) {
      if (!this.meetingMember.produceAudioEnabled) {
        this._audioTrack.enabled = true;
        this.meetingMember.produceAudioEnabled = true;
        await Promise.all([
          this.mediasoupService.producerAudioResume(this.meetingMember._id!),
          this.meshService.resumeAudioTrack(),
        ]);
        const result = this.apiGatewayService.toggleAudio({
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
      switch (meetingMember.remoteConnectionType) {
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
      switch (meetingMember.remoteConnectionType) {
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
            this.screenStream = stream;

            await this.mediasoupService.startScreenShare(stream);
            this.apiGatewayService.startScreenSharing({
              meetingId: meetingId,
              meetingMemberId: _id,
            });
            this.meetingMember.isScreenSharing = true;
            this.isScreenSharing = true;
            stream.getVideoTracks()[0].onended = async () => {
              console.warn('ended');
              this.apiGatewayService.stopScreenSharing({
                meetingId: meetingId!,
                meetingMemberId: _id!,
              });
              this.meetingMember.isScreenSharing = false;
              this.isScreenSharing = false;
            };
            console.log(stream);
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

  public stopScreenShare(): void {
    if (this.screenStream && this.meetingMember.isScreenSharing) {
      this.screenStream.getTracks().forEach((track) => {
        track.stop();
        this.meetingMember.isScreenSharing = false;
        this.isScreenSharing = false;
        track.dispatchEvent(new Event('ended'));
      });
    }
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
        this.meetingMember.userId
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
        this.meetingMember.userId
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
        // reject(false);
      }
    });
  }
  /**
   * getUserMedia handler, sets local stream audio and video tracks
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
          text: 'Importante: El navegador necesita acceso a su micrófono y cámara para reproducir el audio y video, incluso si no desea hablar. Para escuchar a los demás en una sesión, permita que el navegador acceda a su micrófono.',
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
          text: 'No se han encontrado dispositivos de entrada conectados o estos estan siendo usados por otro recurso. Una vez liberados estos recursos recargue la página.',
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

  /**
   * Gets information about the connections on the session using getStats API
   */
  async getSessionStats() {
    const sessionStatsSnapshot: CurrentSessionStats = {
      meetingId: this.meetingId,
      meetingMemberId: this.meetingMember._id!,
      p2pSnapshots: [],
      sfuSnapshot: {},
    };
    await this.mediasoupService.getStats();
    sessionStatsSnapshot.sfuSnapshot = this.mediasoupService.statsSummary;
    let consumer: ConsumerStatsSnapshot | undefined =
      sessionStatsSnapshot.sfuSnapshot.consumer;
    if (!consumer) {
      consumer = {
        audio: new Map<string, AudioConsumerStats>(),
        video: new Map<string, VideoConsumerStats>(),
      };
    }

    for (const [key, member] of this.meetingMembers) {
      await Promise.all([
        member.p2pConsumerConnection.getStats(),
        member.sfuConsumerConnection.getStats(),
      ]);
      sessionStatsSnapshot.p2pSnapshots.push(
        member.p2pConsumerConnection.statsSummary
      );
      if (member.sfuConsumerConnection.statsSummary.video) {
        consumer?.video.set(
          member.id,
          member.sfuConsumerConnection.statsSummary.video
        );
      }
      if (member.sfuConsumerConnection.statsSummary.video) {
        consumer?.audio.set(
          member.id,
          member.sfuConsumerConnection.statsSummary.audio
        );
      }
    }
    // this.meetingMembers.forEach(async (member) => {
    //
    // });
    sessionStatsSnapshot.sfuSnapshot.consumer = consumer;
    console.warn(sessionStatsSnapshot);
    this.apiRestService
      .addSnapshot(sessionStatsSnapshot)
      .pipe(first())
      .subscribe({
        next: (data) => {
          console.warn('success', data);
        },
        error: (err) => {
          console.error(err);
        },
      });
    console.warn(sessionStatsSnapshot);
  }

  onDestroy(): void {
    if (this.meshService) this.meshService.onDestroy();
    this.mediasoupService.onDestroy();
    this.localStream?.getTracks().forEach((track) => {
      track.stop();
    });
    if (this.meetingMember.isScreenSharing) {
      this.stopScreenShare();
    }
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
      if (
        this.meetingDataService.meetingServiceType === MeetingServiceType.MESH
      ) {
        console.log('toggle to', toggleTo);
        await this.mediasoupService.initMediaProduction(true);
        const result = await this.apiGatewayService.toggleConnectionType({
          meetingId: this.meetingId,
          meetingMemberId: this.meetingMember._id!,
          connectionType: toggleTo,
        });
        this.meetingMembers.forEach(async (member) => {
          await Promise.all([
            this.mediasoupService.consumerVideoStart(member.id),
            this.mediasoupService.consumerAudioStart(member.id),
          ]).then(async () => {
            member.updateLocalConnectionType(MeetingServiceType.SFU);
            console.log('inactive audio');
            member.sfuConsumerConnection.consumerVideo?.resume();
            member.sfuConsumerConnection.consumerAudio?.resume();

            new Promise((f) => setTimeout(f, 1500)).then(async () => {
              member.p2pConsumerConnection.noiseSendTransceiver.direction =
                'inactive';
              await new Promise((f) => setTimeout(f, 2000));
              member.p2pConsumerConnection.videoSendTransceiver.direction =
                'inactive';
            });
          });
        });
        this.meetingDataService.meetingServiceType = MeetingServiceType.SFU;
        this.meetingMember.connectionType = MeetingServiceType.SFU;
      } else {
        console.log('toggle to', toggleTo);
        const result = await this.apiGatewayService.toggleConnectionType({
          meetingId: this.meetingId,
          meetingMemberId: this.meetingMember._id!,
          connectionType: toggleTo,
        });
        this.meetingDataService.meetingServiceType = MeetingServiceType.MESH;
        this.meetingMember.connectionType = MeetingServiceType.MESH;
        this.meetingMembers.forEach(async (member) => {
          if (member.remoteConnectionType !== MeetingServiceType.SFU) {
            if (
              member.p2pConsumerConnection.noiseSendTransceiver &&
              this.meetingMember.produceAudioEnabled
            ) {
              member.p2pConsumerConnection.noiseSendTransceiver.direction =
                'sendonly';
            }
            await new Promise((f) => setTimeout(f, 1000));
            if (
              member.p2pConsumerConnection.videoSendTransceiver &&
              this.meetingMember.produceVideoEnabled
            ) {
              member.p2pConsumerConnection.videoSendTransceiver.direction =
                'sendonly';
            }
            if (member.sfuConsumerConnection.consumerAudio) {
              member.sfuConsumerConnection.consumerAudio.pause();
            }
            if (member.sfuConsumerConnection.consumerVideo) {
              member.sfuConsumerConnection.consumerVideo.pause();
            }
            member.updateLocalConnectionType(MeetingServiceType.MESH);
          }
        });
        if (
          !this.isBroadcasting &&
          !this.isScreenSharing &&
          !this.meetingDataService.hasOneSFUConnection
        ) {
          this.mediasoupService.producerVideo?.pause();
          this.mediasoupService.producerAudio?.pause();
        }
      }
    }
  }

  private async toggleConnectionTypeToMesh() {
    // if (result.success) {
    this.meetingDataService.meetingServiceType = MeetingServiceType.MESH;
    this.meetingMembers.forEach((member) => {
      if (member.remoteConnectionType !== MeetingServiceType.SFU) {
        if (
          member.p2pConsumerConnection.noiseSendTransceiver &&
          this.meetingMember.produceAudioEnabled
        ) {
          member.p2pConsumerConnection.noiseSendTransceiver.direction =
            'sendonly';
        }

        if (
          member.p2pConsumerConnection.videoSendTransceiver &&
          this.meetingMember.produceVideoEnabled
        ) {
          member.p2pConsumerConnection.videoSendTransceiver.direction =
            'sendonly';
        }

        member.updateRemoteConnectionType(MeetingServiceType.MESH);

        if (
          member.produceAudioEnabled &&
          member.sfuConsumerConnection.consumerAudio &&
          !member.sfuConsumerConnection.consumerAudio.paused
        ) {
          member.sfuConsumerConnection.consumerAudio.pause();
        }
        if (
          member.produceVideoEnabled &&
          member.sfuConsumerConnection.consumerVideo &&
          !member.sfuConsumerConnection.consumerVideo.paused
        ) {
          member.sfuConsumerConnection.consumerVideo.pause();
        }
      }
    });
    const result = await this.apiGatewayService.toggleConnectionType({
      meetingId: this.meetingId,
      meetingMemberId: this.meetingMember._id!,
      connectionType: MeetingServiceType.SFU,
    });
    if (
      !this.isBroadcasting &&
      !this.isScreenSharing &&
      !this.meetingDataService.hasOneSFUConnection
    ) {
      this.mediasoupService.producerVideo?.pause();
      this.mediasoupService.producerAudio?.pause();
    }
    // }
  }
  private async toggleConnectionTypeToSfu() {
    const result = await this.apiGatewayService.toggleConnectionType({
      meetingId: this.meetingId,
      meetingMemberId: this.meetingMember._id!,
      connectionType: MeetingServiceType.MESH,
    });
    if (result) {
      await this.mediasoupService.initMediaProduction(true);
      this.meetingMembers.forEach(async (member) => {
        await this.mediasoupService.consumerVideoStart(member.id);
        await this.mediasoupService.consumerAudioStart(member.id);
        if (
          member.produceAudioEnabled &&
          member.sfuConsumerConnection.consumerAudio &&
          !member.sfuConsumerConnection.consumerAudio.paused
        ) {
          member.sfuConsumerConnection.consumerAudio.resume();
        }
        if (
          member.produceVideoEnabled &&
          member.sfuConsumerConnection.consumerVideo &&
          !member.sfuConsumerConnection.consumerVideo.paused
        ) {
          member.sfuConsumerConnection.consumerVideo.resume();
        }
        if (member.remoteConnectionType === MeetingServiceType.MESH) {
          member.updateRemoteConnectionType(MeetingServiceType.SFU);
          if (
            member.p2pConsumerConnection.videoSendTransceiver.direction !=
            'inactive'
          ) {
            member.p2pConsumerConnection.videoSendTransceiver.direction =
              'inactive';
          }
          await new Promise((f) => setTimeout(f, 2500));
          if (
            member.p2pConsumerConnection.noiseSendTransceiver.direction !=
            'inactive'
          ) {
            member.p2pConsumerConnection.noiseSendTransceiver.direction =
              'inactive';
          }
        }
      });
      this.meetingDataService.meetingServiceType = MeetingServiceType.SFU;
    }
  }

  private async changeConnectionOfMemberToP2P(
    meetingMemberId: string
  ): Promise<void> {
    const member = this.meetingMembers.get(meetingMemberId);
    if (member) {
      member.remoteConnectionType = MeetingServiceType.MESH;
      if (this.meetingMember.produceVideoEnabled) {
        member.p2pConsumerConnection.videoSendTransceiver.direction =
          'sendonly';
      }

      if (this.meetingMember.produceAudioEnabled) {
        member.p2pConsumerConnection.noiseSendTransceiver.direction =
          'sendonly';
      }

      new Promise((f) => setTimeout(f, 1500)).then(() => {
        member.sfuConsumerConnection.consumerAudio?.pause();
        member.sfuConsumerConnection.consumerVideo?.pause();
      });

      if (
        !this.isBroadcasting &&
        !this.isScreenSharing &&
        !this.meetingDataService.hasOneSFUConnection
      ) {
        await this.mediasoupService.producerVideoPause(this.meetingMember._id!);
        await this.mediasoupService.producerAudioPause(this.meetingMember._id!);
      }

      // this.meshService.initReceive(this.meetingMember, meetingMemberId);

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
  private async changeConnectionOfMemberToSFU(
    meetingMemberId: string
  ): Promise<void> {
    console.log('change member id ', meetingMemberId);
    const member = this.meetingMembers.get(meetingMemberId);
    if (member) {
      await Promise.all([
        this.mediasoupService.consumerVideoStart(meetingMemberId),
        this.mediasoupService.consumerAudioStart(meetingMemberId),
      ]);
      await this.mediasoupService.initMediaProduction(true);
      member.updateRemoteConnectionType(MeetingServiceType.SFU);
      member.sfuConsumerConnection.consumerVideo?.resume();
      member.sfuConsumerConnection.consumerAudio?.resume();
      member.p2pConsumerConnection.noiseSendTransceiver.direction = 'inactive';
      await new Promise((f) => setTimeout(f, 1500)).then(() => {
        member.p2pConsumerConnection.videoSendTransceiver.direction =
          'inactive';
      });
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
