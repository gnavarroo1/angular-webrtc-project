import { Injectable } from '@angular/core';
import { ApiGatewayService } from './api-connection/api-gateway.service';
import { MediasoupService } from './wss.mediasoup';
import { BehaviorSubject, ReplaySubject, Subscription } from 'rxjs';
import { IMemberIdentifier, MemberType } from './types/defines';
import { environment } from '../../environments/environment';
import Swal from 'sweetalert2';
import { DeviceService } from '../core/helpers/device-manager.service';
import { ApiRestService } from './api-connection/api-rest.service';
import { IAuthTokenDecoded } from '../core/types/helper.types';
import { MeetingMemberDto } from '../meetings/types/defines';

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
  private localStream!: MediaStream;
  public localStream$: ReplaySubject<MediaStream> =
    new ReplaySubject<MediaStream>();

  public remotePeers$: BehaviorSubject<Map<string, IMemberIdentifier>> =
    new BehaviorSubject<Map<string, IMemberIdentifier>>(
      new Map<string, IMemberIdentifier>()
    );
  private events$: Subscription[] = [];
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

  private _meetingMember!: MeetingMemberDto;
  get meetingMember(): MeetingMemberDto {
    return this._meetingMember;
  }

  set meetingMember(value: MeetingMemberDto) {
    this._meetingMember = value;
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
      this.apiGatewayService.onStartScreenSharing().subscribe((data) => {});
      this.apiGatewayService.onStopScreenSharing().subscribe((data) => {});
      this.apiGatewayService.onToggleGlobalVideo().subscribe((data) => {
        const consumer = this.mediasoupService.getConsumerByKey(
          data.meetingMemberId
        );
        if (consumer) {
          consumer.globalAudioEnabled = data.produceAudioAllowed;
        }
      });
      this.apiGatewayService.onToggleGlobalAudio().subscribe((data) => {
        const consumer = this.mediasoupService.getConsumerByKey(
          data.meetingMemberId
        );
        if (consumer) {
          consumer.globalVideoEnabled = data.produceVideoAllowed;
        }
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
      console.log('join meeting');
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

  public async startScreenShare(
    meetingMember: MeetingMemberDto
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (meetingMember.meetingId && meetingMember._id) {
        const { meetingId, _id } = meetingMember;
        this.deviceManagerService
          .getDisplayMedia()
          .then((stream) => {
            this.mediasoupService
              .startScreenShare(stream)
              .then(() => {
                this.apiGatewayService.startScreenSharing({
                  meetingId: meetingId,
                  meetingMemberId: _id,
                });
                this.meetingMember.isScreenSharing = true;

                stream
                  .getVideoTracks()[0]
                  .addEventListener('ended', async () => {
                    this.apiGatewayService.stopScreenSharing({
                      meetingId: meetingId,
                      meetingMemberId: _id,
                    });
                    this.meetingMember.isScreenSharing = false;
                  });
              })
              .catch((e) => {
                console.error(e.message, e.stack);
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
          .then((result) => {})
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
  };

  public globalAudioToggle(meetingMember: MeetingMemberDto) {
    const { _id, meetingId } = meetingMember;
    if (_id) {
      this.mediasoupService.globalToggleMedia(_id, 'audio');
      this.apiGatewayService.updateMeetingParticipant({
        meetingId: meetingId,
        meetingMemberId: _id,
        produceVideoAllowed: !meetingMember.produceAudioAllowed,
      });
    }
  }
  public globalVideoToggle(meetingMember: MeetingMemberDto) {
    const { _id, meetingId } = meetingMember;
    if (_id && meetingId) {
      this.mediasoupService.globalToggleMedia(_id, 'video');
      this.apiGatewayService.updateMeetingParticipant({
        meetingId: meetingId,
        meetingMemberId: _id,
        produceVideoAllowed: !meetingMember.produceVideoAllowed,
      });
    }
  }

  private async updateMeetingMemberInformation(
    meetingId: string,
    meetingMemberInformation: any
  ) {
    await this.apiRestService
      .updateMeetingMember(meetingId, meetingMemberInformation)
      .toPromise();
  }
}
