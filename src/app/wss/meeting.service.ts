import { Injectable } from '@angular/core';
import { ApiGatewayService } from './api-connection/api-gateway.service';
import { MediasoupService } from './wss.mediasoup';
import { BehaviorSubject, ReplaySubject } from 'rxjs';
import { IMemberIdentifier, MemberType } from './types/defines';
import Swal from 'sweetalert2';
import { DeviceService } from '../core/helpers/device-manager.service';
import { ApiRestService } from './api-connection/api-rest.service';
import {
  MeetingMemberDto,
  MeetingServiceType,
} from '../meetings/types/defines';
import { NGXLogger } from 'ngx-logger';
import { P2PConsumer, P2pWebrtcService } from './p2p-webrtc.service';
import { SignalingService } from '../meetings/services/wss/signaling.service';
import { SignalingSocket } from './types/custom-sockets';
import { environment } from '../../environments/environment';

@Injectable()
export class MeetingService {
  // videoAspectRatio = 1.77;
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
  public localStream$: ReplaySubject<MediaStream> =
    new ReplaySubject<MediaStream>();
  public remotePeers$: BehaviorSubject<Map<string, IMemberIdentifier>> =
    new BehaviorSubject<Map<string, IMemberIdentifier>>(
      new Map<string, IMemberIdentifier>()
    );

  private localStream: any;
  private _meetingMember!: MeetingMemberDto;
  private _meetingServiceType!: MeetingServiceType;
  private mediasoupService!: MediasoupService;
  private meshService!: P2pWebrtcService;
  private meetingMembers: Map<string, MeetingMemberDto> = new Map<
    string,
    MeetingMemberDto
  >();
  private _audioTrack: MediaStreamTrack | undefined;
  private _videoTrack: MediaStreamTrack | undefined;
  set meetingMember(value: MeetingMemberDto) {
    this._meetingMember = value;
  }
  set meetingServiceType(value: MeetingServiceType) {
    this._meetingServiceType = value;
  }
  private _isMeetingReady = false;

  get isMeetingReady() {
    return this._isMeetingReady;
  }

  constructor(
    private logger: NGXLogger,
    private apiGatewayService: ApiGatewayService,
    private apiRestService: ApiRestService,
    private deviceManagerService: DeviceService
  ) {
    this.apiGatewayService.onConnectionReady().subscribe(async (data) => {
      console.log('CONNECTION API GATEWAY READY');
      this.connectionApiGatewayReady$.next(true);
      // this.mediasoupService.onConnectionReady().subscribe(async (data) => {
      //   console.log('CONNECTION MEDIASOUP READY');
      // });
      this.apiGatewayService.onStartMeetingBroadcast().subscribe((data) => {
        console.log(data);
        this.isBroadcasting$.next(true);
      });
      this.apiGatewayService.onEndMeetingBroadcast().subscribe((data) => {
        console.log(data);
        this.isBroadcasting$.next(false);
      });
      this.apiGatewayService.onJoinMeeting().subscribe((data) => {
        this.meetingMembers.set(data._id, data);
      });
    });
  }

  //<editor-fold desc="Meeting session handlers">
  public async validateMeeting(meetingId: string): Promise<any> {
    return this.apiRestService.getMeeting(meetingId).toPromise();
  }
  public createMeeting(user: any): Promise<any> {
    return this.apiRestService
      .addMeeting({
        meetingCreatorId: user.sessionId,
      })
      .toPromise();
  }
  public async addMeetingMember(meetingMember: MeetingMemberDto): Promise<any> {
    try {
      const response = await this.apiGatewayService.joinMeeting(meetingMember);
      return response;
    } catch (e) {
      console.log(e);
    }
  }

  initMeeting(): void {
    this.apiRestService
      .getMeetingMembers(this._meetingMember.meetingId!)
      .subscribe((data) => {
        for (const member of data.activeMembers) {
          // console.log(member);
          if (member._id !== this._meetingMember._id!) {
            this.meetingMembers.set(member._id, {
              ...member,
              isGuest: member.userId === member.sessionUserId,
              meetingId: this._meetingMember.meetingId!,
            });
            switch (this._meetingServiceType) {
              case MeetingServiceType.MESH:
                // this.meshService.addConsumerConnection(
                //   member._id,
                //   false
                // );
                break;
              case MeetingServiceType.SFU:
                break;
              case MeetingServiceType.BOTH:
                break;
            }
          }
        }
      });
    switch (this._meetingServiceType) {
      case MeetingServiceType.MESH:
        this.initMeshInstance();
        this._isMeetingReady = true;
        break;
      case MeetingServiceType.SFU:
        break;
      case MeetingServiceType.BOTH:
        break;
    }
  }

  videoPause(): boolean {
    if (this._videoTrack) {
      this._videoTrack.enabled = false;
    }
    return false;
  }
  videoResume(): boolean {
    if (this._videoTrack) {
      this._videoTrack.enabled = true;
      return true;
    }
    return false;
  }
  audioPause(): boolean {
    if (this._audioTrack) {
      this._audioTrack.enabled = false;
    }
    return false;
  }
  audioResume(): boolean {
    if (this._audioTrack) {
      this._audioTrack.enabled = true;
      return true;
    }
    return false;
  }

  //</editor-fold>

  //<editor-fold desc="Mesh instance handlers">
  initMeshInstance() {
    this.meshService = new P2pWebrtcService(
      new SignalingService(new SignalingSocket())
    );
    this.meshService.meetingMemberId = this._meetingMember._id!;
    this.meshService.localStream = this.localStream;
    this.meshService.onConnectionReady().subscribe((isReady) => {
      if (isReady) {
        this.meshService.joinMeeting(this._meetingMember);
        this.apiGatewayService.onJoinMeeting().subscribe((data) => {
          console.warn('onjoinmeeting', data);
          // this.meshService.addConsumerConnection(data._id);
        });
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
  async getLocalMediaDevices(): Promise<boolean> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await this.deviceManagerService.getUserMedia();
        this.handleGetUserMedia(stream);
        resolve(true);
      } catch (e) {
        this.handleMediaDevicesError(e);
        reject(false);
      }
    });
  }
  private handleGetUserMedia(stream: MediaStream) {
    this.localStream = stream;
    const videoTracks = this.localStream.getVideoTracks();
    const audioTracks = this.localStream.getAudioTracks();
    if (videoTracks) {
      this._videoTrack = videoTracks[0];
    }
    if (audioTracks) {
      this._audioTrack = audioTracks[0];
    }

    this.localStream.getTracks().forEach((track: MediaStreamTrack) => {
      track.enabled = false;
    });
    this.localStream$.next(stream);
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
          .then((result) => {})
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

  //</editor-fold>
}
