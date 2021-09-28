import { Component, OnInit } from '@angular/core';
import { NGXLogger } from 'ngx-logger';
import { animate, style, transition, trigger } from '@angular/animations';
import {
  IMemberIdentifier,
  MeetingDto,
  MeetingMemberDto,
  MeetingServiceType,
  MemberType,
} from '../../meetings/types/defines';
import { ActivatedRoute } from '@angular/router';
import { ClipboardService } from 'ngx-clipboard';
import { MeetingService } from '../../wss/meeting.service';
import { TokenManagerService } from '../services/token-manager.service';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-test',
  templateUrl: './test.component.html',
  styleUrls: ['./test.component.css'],
  animations: [
    trigger('inOutAnimation', [
      transition(':enter', [
        style({ height: 0, opacity: 0 }),
        animate('1s ease-out', style({ height: 300, opacity: 1 })),
      ]),
      transition(':leave', [
        style({ height: 300, opacity: 1 }),
        animate('1s ease-in', style({ height: 0, opacity: 0 })),
      ]),
    ]),
  ],
})
export class TestComponent implements OnInit {
  public meetingMember!: MeetingMemberDto;
  userId!: string;
  opened = true;
  room: Record<string, number> = {};
  peers: Map<string, IMemberIdentifier> = new Map<string, IMemberIdentifier>();
  producerPeers: Map<string, IMemberIdentifier> = new Map<
    string,
    IMemberIdentifier
  >();
  activeSpeakerId = '';
  audioEnabled = false;
  videoEnabled = false;
  videoConsumer = false;
  public memberType!: MemberType;
  meetingId!: string;
  isBroadcasting = false;
  isValidMeeting = false;
  localStream: MediaStream | undefined;
  hasError = false;
  errorMessage = '';
  constructor(
    private readonly logger: NGXLogger,
    private authService: AuthService,
    private tokenManagerService: TokenManagerService,
    private meetingService: MeetingService,
    // private mediasoupService: MediasoupService,
    private activatedRoute: ActivatedRoute,
    private clipboard: ClipboardService
  ) {}

  async ngOnInit(): Promise<void> {
    const result = this.tokenManagerService.hasAuthToken();
    console.log(result);
    if (!result.hasAuthToken || result.isExpired) {
      await this.authService
        .createTemporalUser()
        .toPromise()
        .then((data) => {
          console.log(data);
          this.tokenManagerService.saveAuthToken(data.accessToken);
        });
    }
    const authToken = this.tokenManagerService.hasAuthToken();
    this.userId = authToken.user.isGuest
      ? authToken.user.sessionId
      : authToken.user.sub;

    const snapshotData = this.activatedRoute.snapshot.data;
    const params = this.activatedRoute.snapshot.params;
    this.memberType = snapshotData.memberType;
    this.meetingMember = {
      isGuest: authToken.user.isGuest,
      userId: this.userId,
      sessionUserId: authToken.user.sessionId,
      nickname: authToken.user.username ? authToken.user.username : this.userId,
      memberType: MemberType[this.memberType],
    };
    new Promise((resolve, reject) => {
      if (!snapshotData.newMeeting) {
        if (params.id) {
          this.meetingService
            .validateMeeting(params.id)
            .then((data: MeetingDto) => {
              this.meetingId = params.id;
              resolve(data);
              console.warn('meeting', data);
            })
            .catch((err) => {
              reject(err);
              console.error(err.message, err.stack);
            });
        }
      } else {
        this.meetingService
          .createMeeting(authToken.user)
          .then((data: MeetingDto) => {
            console.warn('NEW MEETING', data);
            this.meetingId = data._id;
            resolve(data);
          })
          .catch((err) => {
            console.error(err.message, err.stack);
            reject(err);
          });
      }
    }).then(async (data) => {
      console.log('after meeting validation events', data);
      const meeting = data as MeetingDto;
      this.isValidMeeting = !!meeting._id;
      this.isBroadcasting = meeting.isBroadcasting;
      this.meetingMember.meetingId = meeting._id;
      if (
        (this.memberType === MemberType.CONSUMER && meeting.isBroadcasting) ||
        this.memberType === MemberType.PRODUCER ||
        this.memberType === MemberType.BOTH
      ) {
        //Validate local stream and then initialize the connection to the meeting
        this.meetingService
          .getLocalMediaDevices()
          .then(async () => {
            const result = await this.meetingService.addMeetingMember(
              this.meetingMember
            );
            if (result.success) {
              const data = result.payload;
              this.meetingMember._id = data._id;
              this.meetingService.meetingMember = this.meetingMember;
              this.meetingService.meetingServiceType = MeetingServiceType.MESH;
              // this.mediasoupService.session_id = meeting._id;
              // this.mediasoupService.user_id = this.meetingMember.sessionUserId;
              // this.mediasoupService.initWssService();

              this.eventHandlers();
              this.meetingService.initMeeting();
            } else {
              const msg = result.payload;
              window.location.href = 'https://www.google.com/nonexistent';
              //handle disconnections
            }
          })
          .catch((err) => {
            console.log(err);
          });
      } else {
        window.location.href = 'https://www.google.com/nonexistent';
      }
    });

    //TODO VALIDATE LINK ID
  }

  eventHandlers() {
    this.meetingService.localStream$.subscribe((value) => {
      this.localStream = value;
    });
    this.meetingService.isBroadcasting$.subscribe((value) => {
      console.log(value);
      this.isBroadcasting = value;
      if (
        !this.isBroadcasting &&
        this.meetingMember.memberType === MemberType[MemberType.CONSUMER]
      ) {
        let timerInterval: NodeJS.Timeout;
        Swal.fire({
          title: `SESIÓN FINALIZADA`,
          html: 'SERA REDIRIGIDO A LA PÁGINA PRINCIPAL EN <strong></strong> SEGUNDOS.<br/><br/>',
          timer: 5000,
          icon: 'warning',
          showCancelButton: false,
          confirmButtonColor: '#3085d6',
          allowOutsideClick: false,
          confirmButtonText: 'PÁGINA PRINCIPAL',
          willOpen() {
            Swal.showLoading();
            timerInterval = setInterval(() => {
              const timeLeft = Swal.getTimerLeft();
              let timer = '0';
              if (timeLeft) {
                timer = (timeLeft / 1000).toFixed(0);
              }
              const container =
                Swal.getHtmlContainer()?.querySelector('strong');
              if (container) {
                container.textContent = timer;
              }
            }, 100);
          },
          willClose: () => {
            clearInterval(timerInterval);
            this.leaveMeetingSession();
          },
        })
          .then((result) => {
            if (result.value) {
              this.leaveMeetingSession();
            }
          })
          .catch((e) => {
            console.log(e);
          });
      }
    });
    // this.mediasoupService.onConnectionReady().subscribe(async (data) => {
    //   this.mediasoupService.session_id = this.meetingId;
    //   if (data) {
    //     await this.mediasoupService
    //       .joinRoom(this.memberType)
    //       .then(async () => {
    //         // await this.mediasoupService.initCommunication();
    //       })
    //       .catch((err) => {
    //         this.logger.error('TEST COMPONENT', err);
    //       });
    //   }
    // });
    // this.mediasoupService.onAudioEnabled().subscribe((data) => {});
    // this.mediasoupService.onVideoEnabled().subscribe((data) => {});
    //
    // this.mediasoupService.getConsumers().subscribe((peers) => {
    //   this.producerPeers = new Map<string, IMemberIdentifier>();
    //   this.peers = peers;
    //   for (const [key, value] of peers) {
    //     if (value.kind != MemberType.CONSUMER) {
    //       this.producerPeers.set(key, value);
    //     }
    //   }
    // });
  }
  leaveMeetingSession() {
    window.location.href = 'https://about.google/';
  }

  isOnlyConsumer() {
    return this.memberType === MemberType.CONSUMER;
  }

  // showProducerVideo():void{
  //   this.producerVideo.nativeElement.srcObject = this.mediasoupService.getStream();
  // }
  showConsumerVideo(): void {
    // const keys = Array.from(this.mediasoupService.consumersVideoStream.keys());
    // this.consumerVideo.nativeElement.srcObject = this.mediasoupService.consumersVideoStream.get(keys[0]);
  }
  showConsumerAudio(): void {
    // const keys = Array.from(this.mediasoupService.consumersAudioStream.keys());
    // this.consumerAudio.nativeElement.srcObject = this.mediasoupService.consumersAudioStream.get(keys[0]);
  }
  pauseProducerVideo(): void {
    // this.mediasoupService.producerVideoPause();
  }

  resumeProducerVideo(): void {
    // this.mediasoupService.producerVideoResume();
  }

  pauseProducerAudio(): void {
    // this.mediasoupService.producerAudioPause(this.meetingMember.sessionUserId);
  }

  resumeProducerAudio(): void {
    // this.mediasoupService.producerAudioResume(this.meetingMember.sessionUserId);
  }

  getLocalStream(): MediaStream | undefined {
    return;
    // console.log(this.mediasoupService.getStream());

    // return this.mediasoupService.getStream();
  }
  getMemberVideoStream(key: string): MediaStream | undefined {
    return;
    // return this.mediasoupService.getMemberVideoStream(key);
  }
  getMemberAudioStream(key: string): MediaStream | undefined {
    return;
    // return this.mediasoupService.getMemberAudioStream(key);
  }
  async restartIce(): Promise<void> {
    // this.logger.warn('TEST', this.mediasoupService.consumersAudio);
    // this.logger.warn('TEST', this.mediasoupService.consumersVideo);
  }
  async toggleAudio(): Promise<void> {
    console.log(this.localStream?.getAudioTracks()[0]);
    if (this.audioEnabled) {
      this.audioEnabled = this.meetingService.audioPause();
    } else {
      this.audioEnabled = this.meetingService.audioResume();
    }
    // this.audioEnabled = !this.audioEnabled;
  }

  async toggleVideo(): Promise<void> {
    try {
      if (this.videoEnabled) {
        this.videoEnabled = this.meetingService.videoPause();
      } else {
        // console.log('RESUME');
        // await this.mediasoupService.producerVideoResume(
        //   this.meetingMember.sessionUserId
        // );
        this.videoEnabled = this.meetingService.videoResume();
      }
      // this.videoEnabled = !this.videoEnabled;
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }
  async getMeetingLink() {
    console.log(this.meetingId);
    if (this.meetingId) {
      this.clipboard.copyFromContent(
        window.location.origin + '/meetings/join/' + this.meetingId
      );
    }
  }
  async getBroadcastingLink() {
    if (this.meetingId) {
      this.clipboard.copyFromContent(
        window.location.origin + '/meetings/broadcasting/' + this.meetingId
      );
    }
  }
  notConsumer(memberType: MemberType) {
    return memberType !== MemberType.CONSUMER;
  }

  async getConsumerState(userId: string) {
    // const consumerAudio = this.mediasoupService.consumersAudio.get(userId);
    // const consumerVideo = this.mediasoupService.consumersVideo.get(userId);
    // const consumer = this.mediasoupService.consumers.get(userId);
    // console.warn('consumerVideo', await consumerVideo?.getStats());
    // console.warn(
    //   'consumerAudioState',
    //   this.mediasoupService.getMemberVideoStream(userId)?.getTracks()
    // );
    // console.warn('consumerVideoState', consumerVideo?.paused);
    // console.warn('consumerState', consumer);
  }
  printConsumers(): void {
    this.logger.warn(this.producerPeers);
  }

  globalAudioToggle(key: string) {
    // this.mediasoupService.globalToggleMedia(key, 'audio');
  }
  globalVideoToggle(key: string) {
    // this.mediasoupService.globalToggleMedia(key, 'video');
  }

  startBroadcastingSession() {
    this.meetingService
      .startBroadcastingSession(this.meetingMember)
      .then(() => {})
      .catch(() => {});
  }
  async endBroadcastingSession() {
    this.meetingService
      .endBroadcastingSession(this.meetingMember)
      .then(() => {})
      .catch(() => {});
  }

  getConsumers() {
    return this.meetingService.getConsumers();
  }
  get isMeetingReady(): boolean {
    return this.meetingService.isMeetingReady;
  }

  getMemberPeerConnection(key: string) {
    const meetingMembers = this.meetingService.getConsumers();
    const member = meetingMembers.get(key);
    if (member) console.warn(member);
  }
}
