import { Component, OnInit } from '@angular/core';
import { NGXLogger } from 'ngx-logger';
import { MediasoupService } from '../../wss/wss.mediasoup';
import { animate, style, transition, trigger } from '@angular/animations';
import {
  IMemberIdentifier,
  MeetingDto,
  MeetingMemberDto,
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

  constructor(
    private readonly logger: NGXLogger,
    private authService: AuthService,
    private tokenManagerService: TokenManagerService,
    private meetingService: MeetingService,
    private mediasoupService: MediasoupService,
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
      memberType: this.memberType,
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
      this.isBroadcasting = meeting.isBroadcasting;
      this.meetingMember.meetingId = meeting._id;

      if (
        (this.memberType === MemberType.CONSUMER && meeting.isBroadcasting) ||
        this.memberType === MemberType.PRODUCER ||
        this.memberType === MemberType.BOTH
      ) {
        const result = await this.meetingService.addMeetingMember(
          this.meetingMember
        );
        console.log('im over here now');
        console.log(result);
        if (result.success) {
          const data = result.payload;
          this.meetingMember._id = data._id;
          this.meetingMember.produceAudioAllowed = data.produceAudioAllowed;
          this.meetingMember.produceVideoAllowed = data.produceVideoAllowed;
          this.meetingMember.produceAudioEnabled = false;
          this.meetingMember.produceVideoEnabled = false;
          this.meetingService.meetingMember = this.meetingMember;
          this.mediasoupService.sessionId = meeting._id;
          this.mediasoupService.userId = this.meetingMember.sessionUserId;
          this.mediasoupService.initWssService();
          this.eventHandlers();
        } else {
          const msg = result.payload;
          window.location.href = 'https://www.google.com/nonexistent';
          //handle disconnections
        }
      } else {
        window.location.href = 'https://www.google.com/nonexistent';
      }
    });
  }

  eventHandlers() {
    this.meetingService.isBroadcasting$.subscribe((value) => {
      console.log(value);
      this.isBroadcasting = value;
      if (
        !this.isBroadcasting &&
        this.meetingMember.memberType === MemberType.CONSUMER
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
    this.mediasoupService.onConnectionReady().subscribe(async (data) => {
      this.mediasoupService.sessionId = this.meetingId;
      if (data) {
        await this.mediasoupService
          .joinRoom(this.meetingMember)
          .then(async () => {
            if (this.memberType !== MemberType.CONSUMER)
              await this.mediasoupService.initCommunication();
          })
          .catch((err) => {
            this.logger.error('TEST COMPONENT', err);
          });
      }
    });
    this.mediasoupService.getConsumers().subscribe((peers) => {
      this.producerPeers = new Map<string, IMemberIdentifier>();
      for (const [key, value] of peers) {
        if (value.kind != MemberType.CONSUMER) {
          console.log('MEETING MEMBER', value);
          this.producerPeers.set(key, value);
        }
      }
    });
  }
  leaveMeetingSession() {
    window.location.href = 'https://about.google/';
  }

  isOnlyConsumer() {
    return this.memberType === MemberType.CONSUMER;
  }
  volumeChange(event: any, key: string) {
    const peer = this.producerPeers.get(key);
    console.log(event.value);
    if (peer) {
      console.log(peer.volume);
      const audioStream = this.getMemberAudioStream(key);
      const audioTrack = audioStream?.getTracks()[0];
      if (audioTrack) {
        peer.volume = event.value;
        // const { meetingId, _id } = this.meetingMember;
        // if (meetingId && _id) {
        //   this.meetingService.updateMeetingMemberInformation(meetingId, {
        //   //   id: _id,
        //   //   volume: peer.volume,
        //   // });
        // }
      }
    }
  }

  getLocalStream(): MediaStream | undefined {
    return this.mediasoupService.getStream();
  }
  getMemberVideoStream(key: string): MediaStream | undefined {
    return this.mediasoupService.getMemberVideoStream(key);
  }
  getMemberAudioStream(key: string): MediaStream | undefined {
    return this.mediasoupService.getMemberAudioStream(key);
  }
  async restartIce(): Promise<void> {
    this.logger.warn('TEST', this.mediasoupService.consumersAudio);
    this.logger.warn('TEST', this.mediasoupService.consumersVideo);
  }
  async toggleAudio(): Promise<void> {
    if (this.audioEnabled) {
      await this.mediasoupService.producerAudioPause(
        this.meetingMember.sessionUserId
      );
    } else {
      await this.mediasoupService.producerAudioResume(
        this.meetingMember.sessionUserId
      );
    }

    this.audioEnabled = !this.audioEnabled;
    this.meetingMember.produceAudioEnabled = this.audioEnabled;
  }

  async toggleVideo(): Promise<void> {
    try {
      if (this.videoEnabled) {
        // console.log('PAUSE');
        await this.mediasoupService.producerVideoPause(
          this.meetingMember.sessionUserId
        );
      } else {
        // console.log('RESUME');
        await this.mediasoupService.producerVideoResume(
          this.meetingMember.sessionUserId
        );
      }
      this.videoEnabled = !this.videoEnabled;
      this.meetingMember.produceVideoEnabled = this.videoEnabled;
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
    const consumerAudio = this.mediasoupService.consumersAudio.get(userId);
    const consumerVideo = this.mediasoupService.consumersVideo.get(userId);
    const consumer = this.mediasoupService.consumers.get(userId);
    console.warn('consumerVideo', await consumerVideo?.getStats());
    console.warn(
      'consumerAudioState',
      this.mediasoupService.getMemberVideoStream(userId)?.getTracks()
    );
    console.warn('consumerVideoState', consumerVideo?.paused);
    console.warn('consumerState', consumer);
  }
  async printConsumers(): Promise<void> {
    if (this.mediasoupService.producerScreenMedia) {
      console.log(this.mediasoupService.producerScreenMedia.track);
    }
    console.log(this.mediasoupService.consumersScreen);
  }
  startBroadcast() {}
  endBroadcast() {}

  globalAudioToggle(key: string) {
    this.mediasoupService.globalToggleMedia(key, 'audio');
  }
  globalVideoToggle(key: string) {
    this.mediasoupService.globalToggleMedia(key, 'video');
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
  async shareScreen() {
    await this.meetingService.startScreenShare(this.meetingMember);
  }

  printConsumerScreen(key: string) {
    console.log(
      'consumers video',
      this.mediasoupService.consumersVideo.get(key)
    );
    console.log(
      'consumers video stream',
      this.mediasoupService.consumersVideoStream.get(key)
    );
    console.log(
      'consumers screen',
      this.mediasoupService.consumersScreen.get(key)
    );
    console.log('consumers', this.mediasoupService.consumers.get(key));
    console.log('current VIdeo ', this.getMemberVideoStream(key));
  }
}
