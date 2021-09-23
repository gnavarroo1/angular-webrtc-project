import { Injectable } from '@angular/core';
import { ApiGatewayService } from './api-connection/api-gateway.service';
import { MediasoupService } from './wss.mediasoup';
import { BehaviorSubject, ReplaySubject } from 'rxjs';
import { IMemberIdentifier, MemberType } from './types/defines';
import { environment } from '../../environments/environment';
import Swal from 'sweetalert2';
import { DeviceService } from '../core/helpers/device-manager.service';
import { ApiRestService } from './api-connection/api-rest.service';
import { IAuthTokenDecoded } from '../core/types/helper.types';
import { MeetingMemberDto } from '../meetings/types/defines';

@Injectable()
export class MeetingService {
  videoAspectRatio = 1.77;
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
  private localStream!: MediaStream;
  public localStream$: ReplaySubject<MediaStream> =
    new ReplaySubject<MediaStream>();

  public remotePeers$: BehaviorSubject<Map<string, IMemberIdentifier>> =
    new BehaviorSubject<Map<string, IMemberIdentifier>>(
      new Map<string, IMemberIdentifier>()
    );

  audioEnabled$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  videoEnabled$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  private _memberType!: MemberType;
  private _sessionUserId!: string;

  private _isMeetingValid$: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(true);
  get sessionUserId(): string {
    return this._sessionUserId;
  }

  set sessionUserId(value: string) {
    this._sessionUserId = value;
  }

  get memberType(): MemberType {
    return this._memberType;
  }

  set memberType(value: MemberType) {
    this._memberType = value;
  }

  constructor(
    private apiGatewayService: ApiGatewayService,
    private apiRestService: ApiRestService,
    private mediasoupService: MediasoupService,
    private deviceManagerService: DeviceService
  ) {
    this.apiGatewayService.onConnectionReady().subscribe(async (data) => {
      console.log('CONNECTION API GATEWAY READY');
      this.connectionApiGatewayReady$.next(true);
      this.mediasoupService.onConnectionReady().subscribe(async (data) => {
        console.log('CONNECTION MEDIASOUP READY');
      });
      this.apiGatewayService.onStartMeetingBroadcast().subscribe((data) => {
        console.log(data);
        this.isBroadcasting$.next(true);
      });
      this.apiGatewayService.onEndMeetingBroadcast().subscribe((data) => {
        console.log(data);
        this.isBroadcasting$.next(false);
      });
    });
  }

  public async validateMeeting(meetingId: string) {
    return this.apiRestService.getMeeting(meetingId).toPromise();
  }
  public createMeeting(user: any) {
    return this.apiRestService
      .addMeeting({
        meetingCreatorId: user.isGuest ? user.sessionId : user.sub,
      })
      .toPromise();
  }
  public async addMeetingMember(meetingMember: MeetingMemberDto) {
    try {
      const response = await this.apiGatewayService.joinMeeting(meetingMember);
      console.log(response);
      return response;
    } catch (e) {
      console.log(e);
    }
  }

  getLocalMediaDevices() {
    const stream = this.deviceManagerService
      .getUserMedia()
      .then(this.handleGetUserMedia)
      .catch(this.handleMediaDevicesError);
  }

  private handleGetUserMedia(stream: MediaStream) {
    this.localStream = stream;
    this.localStream$.next(stream);
  }
  private handleMediaDevicesError = (e: any) => {
    console.log(e.message, e.name);
    switch (e.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        if (window.location.protocol === 'http:') {
          //TODO MENSAJE DE ERROR POR USO DE PROTOCOLO HTTP EN LUGAR DE HTTPS
        } else {
          Swal.fire({
            icon: 'error',
            title:
              'No tenemos permiso para acceder a su micrófono ni a su cámara.\n' +
              'Verifique si su navegador necesita permiso.',
            text: 'Importante: El navegador necesita acceso a su micrófono para reproducir el audio, incluso si no desea hablar. Para escuchar a los demás en una sesión, permita que el navegador acceda a su micrófono.',
            allowOutsideClick: false,
            confirmButtonText: 'REINTENTAR',
          })
            .then((result) => {})
            .catch((error) => {
              console.error(error, 'Swal Exception ' + e.name);
            });
        }
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
          'he list of constraints specified is empty, or has all constraints set to false, or you tried to call getUserMedia() in an insecure context.',
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

  private async handleErrorPage() {
    await this.mediasoupService.close();
  }

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
}
