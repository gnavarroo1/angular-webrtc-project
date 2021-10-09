import { Injectable } from '@angular/core';
import { ApiGatewayService } from './api-connection/api-gateway.service';
import { MediasoupService } from './wss.mediasoup';
import { BehaviorSubject, ReplaySubject, Subscription } from 'rxjs';
import { IMemberIdentifier, MemberType } from './types/defines';
import Swal from 'sweetalert2';
import { DeviceService } from '../core/helpers/device-manager.service';
import { ApiRestService } from './api-connection/api-rest.service';
import {
  MeetingDto,
  MeetingMemberDto,
  MeetingServiceType,
} from '../meetings/types/defines';
import * as hark from 'hark';
import { NGXLogger } from 'ngx-logger';
import { P2pWebrtcService } from './p2p-webrtc.service';
import { SignalingService } from '../meetings/services/wss/signaling.service';
import { SignalingSocket } from './types/custom-sockets';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';

@Injectable()
export class MeetingService {
  get isMeetingCreator(): boolean {
    return this._isMeetingCreator;
  }

  set isMeetingCreator(value: boolean) {
    this._isMeetingCreator = value;
  }
  get activeSpeaker(): number {
    return this._activeSpeaker;
  }

  set activeSpeaker(value: number) {
    this._activeSpeaker = value;
  }
  get localStream(): MediaStream | undefined {
    return this._localStream;
  }

  get meetingId(): string {
    return this._meetingId;
  }
  set meetingId(value: string) {
    this._meetingId = value;
  }
  private _meetingId!: string;
  private readonly PC_PROPRIETARY_CONSTRAINTS = {
    optional: [{ googDscp: true }],
  };
  connectionMediasoupReady$: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);
  connectionApiGatewayReady$: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);
  connectionSignalingGatewayReady$: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);
  isBroadcasting$: ReplaySubject<boolean> = new ReplaySubject<boolean>();
  audioEnabled$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  videoEnabled$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private _isMeetingValid$: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(true);
  public remotePeers$: BehaviorSubject<Map<string, IMemberIdentifier>> =
    new BehaviorSubject<Map<string, IMemberIdentifier>>(
      new Map<string, IMemberIdentifier>()
    );
  private _isMeetingCreator!: boolean;
  private _localStream: MediaStream | undefined;
  private _meetingMember!: MeetingMemberDto;
  private _meetingServiceType!: MeetingServiceType;
  private mediasoupService!: MediasoupService;
  private meshService!: P2pWebrtcService;
  private _meetingMembers: Map<string, MeetingMemberDto> = new Map<
    string,
    MeetingMemberDto
  >();
  get meetingMembers(): Map<string, MeetingMemberDto> {
    return this._meetingMembers;
  }

  set meetingMembers(value: Map<string, MeetingMemberDto>) {
    this._meetingMembers = value;
  }

  private _audioTrack: MediaStreamTrack | undefined;
  private _videoTrack: MediaStreamTrack | undefined;
  get meetingMember(): MeetingMemberDto {
    return this._meetingMember;
  }
  set meetingMember(value: MeetingMemberDto) {
    this._meetingMember = value;
  }
  get meetingServiceType(): MeetingServiceType {
    return this._meetingServiceType;
  }
  set meetingServiceType(value: MeetingServiceType) {
    this._meetingServiceType = value;
  }
  private _isMeetingReady = false;
  private _activeSpeaker = 0;
  get isMeetingReady() {
    return this._isMeetingReady;
  }
  private subscriptions: Subscription[] = [];
  constructor(
    private router: Router,
    private logger: NGXLogger,
    private apiGatewayService: ApiGatewayService,
    private apiRestService: ApiRestService,
    private deviceManagerService: DeviceService
  ) {
    this.apiGatewayService.onConnectionReady().subscribe(async () => {
      console.log('CONNECTION API GATEWAY READY');
      this.connectionApiGatewayReady$.next(true);
      // this.mediasoupService.onConnectionReady().subscribe(async (data) => {
      //   console.log('CONNECTION MEDIASOUP READY');
      // });
      const onStartBroadcasting$ = this.apiGatewayService
        .onStartMeetingBroadcast()
        .subscribe((data) => {
          console.log(data);
          this.isBroadcasting$.next(true);
        });
      const onEndBroadcasting$ = this.apiGatewayService
        .onEndMeetingBroadcast()
        .subscribe((data) => {
          console.log(data);
          this.isBroadcasting$.next(false);
        });
      const onJoinMeeting$ = this.apiGatewayService
        .onJoinMeeting()
        .subscribe((data) => {
          console.log('MEMBER JOINED', data);
          this._meetingMembers.set(data._id, data);
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
        .subscribe((data) => {
          console.log(
            'RECEIVING CHANGE ON VIDEO STATUS FROM MEMBER =>',
            data.meetingMemberId,
            data
          );
          const meetingMember = this.meetingMembers.get(data.meetingMemberId);
          if (meetingMember) {
            meetingMember.produceVideoEnabled = data.produceVideoEnabled;
          }
        });
      const onMeetingMemberDisconnected$ = this.apiGatewayService
        .onMeetingMemberDisconnected()
        .subscribe((data) => {
          switch (this.meetingServiceType) {
            case MeetingServiceType.SFU:
              break;
            case MeetingServiceType.MESH: {
              const consumer = this.meshService.consumers.get(data.sender);
              if (consumer) {
                consumer.rtcPeerConnection.close();
                this.meshService.consumers.delete(data.sender);
              }
              this.meetingMembers.delete(data.sender);
              break;
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

      this.subscriptions.push(
        onStartBroadcasting$,
        onEndBroadcasting$,
        onJoinMeeting$,
        onToggleAudio$,
        onToggleVideo$,
        onMeetingMemberDisconnected$
      );
    });
  }

  //<editor-fold desc="Meeting session handlers">
  public async validateMeeting(meetingId: string): Promise<any> {
    return this.apiRestService.getMeeting(meetingId).toPromise();
  }
  public createMeeting(userId: string): Promise<any> {
    return this.apiRestService
      .addMeeting({
        meetingCreatorId: userId,
      })
      .toPromise();
  }
  public async addMeetingMember(meetingMember: MeetingMemberDto): Promise<any> {
    try {
      return await this.apiGatewayService.joinMeeting(meetingMember);
    } catch (e) {
      console.log(e);
    }
  }
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
          this._meetingMember = {
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
            this.meetingServiceType = meetingServiceType;
            this.meetingId = meeting._id;
            this._meetingMember.meetingId = meeting._id;
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
            this._meetingMember.nickname = nickname
              ? nickname
              : this._meetingMember.userId;
            this.addMeetingMember(this.meetingMember)
              .then((resAddMeetingMember) => {
                if (resAddMeetingMember.success) {
                  console.log('currentMember', resAddMeetingMember);
                  this._isMeetingCreator =
                    resAddMeetingMember.payload.isMeetingCreator;
                  this.meetingMember._id = resAddMeetingMember.payload._id;
                  this.meetingMember.produceAudioAllowed =
                    resAddMeetingMember.payload.produceAudioAllowed;
                  this.meetingMember.produceVideoAllowed =
                    resAddMeetingMember.payload.produceVideoAllowed;
                  this.apiRestService
                    .getMeetingMembers(meetingId)
                    .pipe(take(1))
                    .subscribe((resGetMeetingMembers) => {
                      console.log('GET MEETING MEMBERS');
                      const activeMembers = resGetMeetingMembers.activeMembers;
                      activeMembers.forEach((member: any) => {
                        if (member._id !== this.meetingMember._id) {
                          this.meetingMembers.set(member._id, {
                            userId: member.userId,
                            _id: member._id,
                            nickname: member.nickname,
                            meetingId: member._meetingId,
                            memberType: member.memberType,
                            produceAudioEnabled: member.produceAudioEnabled,
                            produceVideoEnabled: member.produceVideoEnabled,
                            produceAudioAllowed: member.produceAudioAllowed,
                            produceVideoAllowed: member.produceVideoAllowed,
                            sessionUserId: member.sessionUserId,
                            isScreenSharing: member.isScreenSharing,
                            connectionType: member.connectionType,
                          });
                        }
                      });
                    });
                  switch (this._meetingServiceType) {
                    case MeetingServiceType.MESH:
                      this.initMeshInstance();
                      this._isMeetingReady = true;
                      console.log('meeting is ready');
                      break;
                    case MeetingServiceType.SFU:
                      break;
                    case MeetingServiceType.BOTH:
                      break;
                  }
                } else {
                  const msg = resAddMeetingMember.payload;
                  //TODO redirect to error page
                  console.error(msg);
                }
              })
              .catch((e) => {
                console.error(e.message, e.stack);
              });
          } else {
            //todo error not valid meeting
          }
        }
      } catch (e) {
        console.log(e.message, e.stack);
      }
    }
  }

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
          switch (this.meetingServiceType) {
            case MeetingServiceType.MESH: {
              const consumers = this.meshService.consumers;
              if (consumers.size > 0) {
                consumers.forEach((consumer) => {
                  if (consumer.rtcPeerConnection.signalingState !== 'closed') {
                    consumer.videoSendTransceiver.direction = 'inactive';
                  }
                });
              }
              this.meetingMember.produceVideoEnabled = false;
              break;
            }
            case MeetingServiceType.SFU:
              break;
          }
        }
      }
    }
    return false;
  }
  async videoResume(): Promise<boolean> {
    if (this._videoTrack) {
      if (!this._videoTrack.enabled) {
        if (!this.meetingMember.produceVideoEnabled) {
          this._videoTrack.enabled = true;
          switch (this.meetingServiceType) {
            case MeetingServiceType.MESH: {
              const consumers = this.meshService.consumers;
              if (consumers.size > 0) {
                consumers.forEach((consumer) => {
                  if (consumer.rtcPeerConnection.signalingState != 'closed') {
                    consumer.videoSendTransceiver.direction = 'sendonly';
                  }
                });
              }
              this.meetingMember.produceVideoEnabled = true;
              break;
            }
            case MeetingServiceType.SFU:
              break;
          }
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
            this.meetingMember.produceAudioEnabled = false;
            break;
          }
          case MeetingServiceType.SFU:
            break;
        }
      }
    }
    return false;
  }
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
            this.meetingMember.produceAudioEnabled = true;

            break;
          }
          case MeetingServiceType.SFU:
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
  async globalVideoToggle(key: string): Promise<void> {
    const meetingMember = this.meetingMembers.get(key);
    console.log('validate member', meetingMember, key);
    if (meetingMember) {
      switch (meetingMember.connectionType) {
        case MeetingServiceType.MESH:
          break;
        case MeetingServiceType.SFU:
          this.mediasoupService.globalToggleMedia(key, 'video');
          break;
      }
      console.log('send beacon', this.meetingId);
      const result = await this.apiGatewayService.toggleGlobalVideo({
        meetingId: this.meetingId,
        meetingMemberId: key,
        produceVideoAllowed: !meetingMember.produceVideoAllowed,
      });
      console.log('toggleglobalvideo', result);
    }
  }
  //</editor-fold>

  //<editor-fold desc="Mesh instance handlers">
  initMeshInstance() {
    this.meshService = new P2pWebrtcService(
      new SignalingService(new SignalingSocket())
    );
    this.meshService.meetingMemberId = this._meetingMember._id!;
    console.warn('Add reference to localstream', this._localStream);
    this.meshService.localStream = this._localStream
      ? this._localStream
      : new MediaStream();
    this.meshService.onConnectionReady().subscribe((isReady) => {
      if (isReady) {
        this.meshService.joinMeeting(this._meetingMember);
      }
    });
  }
  //</editor-fold>

  //<editor-fold desc="Mediasoup sfu instance handlers">
  initSFUInstance() {
    this.mediasoupService = new MediasoupService(this.logger);
  }
  //</editor-fold>

  private async handleErrorPage() {
    await this.mediasoupService.close();
  }

  //<editor-fold desc="Broadcasting controls(SFU)">
  public async startBroadcastingSession(meetingMember: MeetingMemberDto) {
    await this.apiRestService
      .startBroadcastingSession(
        meetingMember.meetingId!,
        meetingMember.userId,
        meetingMember.sessionUserId
      )
      .toPromise();
  }
  public async endBroadcastingSession(meetingMember: MeetingMemberDto) {
    return this.apiRestService
      .endBroadcastingSession(
        meetingMember.meetingId!,
        meetingMember.userId,
        meetingMember.sessionUserId
      )
      .toPromise();
  }
  //</editor-fold>

  //<editor-fold desc="getUserMedia handler">
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
  private handleGetUserMedia(stream: MediaStream) {
    this._localStream = stream;
    const videoTracks = this._localStream.getVideoTracks();
    const audioTracks = this._localStream.getAudioTracks();
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
    console.warn('disable tracks');
    this._localStream.getTracks().forEach((track: MediaStreamTrack) => {
      track.enabled = false;
    });
    console.warn('videotrack', this.videoTrack?.enabled);
    console.warn('audiotrack', this.audioTrack?.enabled);

    return true;
  }

  private handleMediaDevicesError = (e: any) => {
    console.warn('HANDLING GETUSERMEDIA ERROR');
    console.log(e.message, e.name);
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

  get audioTrack(): MediaStreamTrack | undefined {
    return this._audioTrack;
  }
  get videoTrack(): MediaStreamTrack | undefined {
    return this._videoTrack;
  }

  getConsumers() {
    return this.meshService.consumers;
  }

  getMeetingMemberAudio(key: string): MediaStream | undefined {
    const member = this._meetingMembers.get(key);
    if (member) {
      let consumer;
      switch (member.connectionType) {
        case MeetingServiceType.MESH:
          consumer = this.meshService.consumers.get(key);
          if (consumer) {
            return consumer.remoteAudioTrack;
          }
          break;
        case MeetingServiceType.SFU:
          consumer = this.mediasoupService.consumers.get(key);
          if (consumer) {
            return this.mediasoupService.consumersAudioStream.get(key);
          }
          break;
      }
    }
    return;
  }

  getMeetingMemberVideo(key: string): MediaStream | undefined {
    const member = this._meetingMembers.get(key);
    if (member) {
      let consumer;
      switch (member.connectionType) {
        case MeetingServiceType.MESH:
          consumer = this.meshService.consumers.get(key);
          if (consumer) {
            return consumer.remoteVideoTrack;
          }
          break;
        case MeetingServiceType.SFU:
          consumer = this.mediasoupService.consumers.get(key);
          if (consumer) {
            return this.mediasoupService.consumersVideoStream.get(key);
          }
          break;
      }
    }
    return;
  }

  //</editor-fold>

  onDestroy(): void {
    if (this.meshService) this.meshService.onDestroy();
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
  }
}
