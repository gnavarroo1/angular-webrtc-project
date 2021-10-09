import { Component, OnDestroy, OnInit } from '@angular/core';
import { NGXLogger } from 'ngx-logger';
import { AuthService } from '../core/services/auth.service';
import { TokenManagerService } from '../core/services/token-manager.service';
import { MeetingService } from '../wss/meeting.service';
import { ActivatedRoute } from '@angular/router';
import { ClipboardService } from 'ngx-clipboard';
import {
  MeetingMemberDto,
  MeetingServiceType,
  MemberType,
} from '../meetings/types/defines';
import { ReplaySubject, Subscription } from 'rxjs';

@Component({
  selector: 'app-webrtc-p2p',
  templateUrl: './webrtc-p2p.component.html',
  styleUrls: ['./webrtc-p2p.component.css'],
})
export class WebrtcP2pComponent implements OnInit, OnDestroy {
  opened = true;
  constructor(
    private readonly logger: NGXLogger,
    private authService: AuthService,
    private tokenManagerService: TokenManagerService,
    private meetingService: MeetingService,
    private activatedRoute: ActivatedRoute,
    private clipboard: ClipboardService
  ) {}
  public meetingMembers: Map<string, MeetingMemberDto> = new Map<
    string,
    MeetingMemberDto
  >();
  meetingMember!: MeetingMemberDto;
  volume = 10;
  private subcriptions: Subscription[] = [];
  // localStream: MediaStream | undefined;
  async ngOnInit(): Promise<void> {
    const result = this.tokenManagerService.hasAuthToken();
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
    const user = authToken.user;
    const snapshotData = this.activatedRoute.snapshot.data;
    const params = this.activatedRoute.snapshot.params;

    this.meetingService
      .initMeeting(
        user,
        snapshotData.memberType,
        MeetingServiceType.MESH,
        params.id
      )
      .then(() => {
        this.meetingMembers = this.meetingService.meetingMembers;
        this.meetingMember = this.meetingService.meetingMember;
      });
  }
  // private eventHandlers() {
  //   const localStream$ = this.meetingService.localStream$.subscribe((value) => {
  //     this.localStream = value;
  //   });
  //   this.subcriptions.push(localStream$);
  // }
  async getMeetingLink() {
    if (this.meetingService.meetingId) {
      this.clipboard.copyFromContent(
        window.location.origin +
          '/meetings/join/' +
          this.meetingService.meetingId
      );
    }
  }

  async toggleAudio(): Promise<void> {
    if (this.meetingMember) {
      if (this.meetingMember.produceAudioEnabled) {
        this.meetingService.audioPause();
      } else {
        this.meetingService.audioResume();
      }
    }
    // this.audioEnabled = !this.audioEnabled;
  }
  async toggleVideo(): Promise<void> {
    if (this.meetingMember) {
      if (this.meetingMember.produceVideoEnabled) {
        this.meetingService.videoPause();
      } else {
        this.meetingService.videoResume();
      }
    }
  }

  get isOnlyConsumer(): boolean {
    return this.meetingService.meetingMember.memberType === MemberType.CONSUMER;
  }
  get isMeetingReady(): boolean {
    return this.meetingService.isMeetingReady;
  }

  printMeetingMembers() {
    console.log(this.meetingService.meetingMembers);
    const consumers = this.meetingService.getConsumers();
    consumers.forEach((value) => {
      console.warn('consumer', value.rtcPeerConnection.getTransceivers());
    });
    console.log(this.localStream);
  }
  printStreams(key: string): void {
    console.log('audio stream', this.meetingService.getMeetingMemberAudio(key));
    console.log('video stream', this.meetingService.getMeetingMemberVideo(key));
  }
  getMeetingMemberAudioStream(key: string): MediaStream | undefined {
    return this.meetingService.getMeetingMemberAudio(key);
  }
  getMeetingMemberVideoStream(key: string): MediaStream | undefined {
    return this.meetingService.getMeetingMemberVideo(key);
  }
  get localStream(): MediaStream | undefined {
    return this.meetingService.localStream;
  }
  get audioLevel(): number {
    return this.meetingService.activeSpeaker
      ? this.meetingService.activeSpeaker
      : 0;
  }
  ngOnDestroy(): void {
    this.subcriptions.forEach((sub) => {
      sub.unsubscribe();
    });
    this.meetingService.onDestroy();
  }

  volumeChange(event: any, key: string) {
    const peer = this.meetingMembers.get(key);
    console.log(event.value);
    if (peer) {
      const audioStream = this.meetingService.getMeetingMemberAudio(key);
      if (audioStream) {
        const audioTrack = audioStream?.getTracks()[0];
        if (audioTrack) {
          if (peer.volume !== event.value) peer.volume = event.value;
        }
      }
    }
  }

  globalAudioToggle(key: string): void {
    this.meetingService.globalAudioToggle(key);
  }
  globalVideoToggle(key: string): void {
    this.meetingService.globalVideoToggle(key);
  }
  localAudioToggle(key: string): void {}
  localVideoToggle(key: string): void {}

  get isMeetingCreator(): boolean {
    return this.meetingService.isMeetingCreator;
  }
}
