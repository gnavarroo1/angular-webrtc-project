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
import { Subscription } from 'rxjs';
import { MeetingDataService } from '../meetings/services/meeting-data.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-webrtc-sfu',
  templateUrl: './webrtc-sfu.component.html',
  styleUrls: ['./webrtc-sfu.component.css'],
})
export class WebrtcSfuComponent implements OnInit, OnDestroy {
  opened = true;
  meetingMembers: Map<string, MeetingMemberDto> = new Map<
    string,
    MeetingMemberDto
  >();
  meetingMember!: MeetingMemberDto;
  volume = 10;
  subscriptions: Subscription[] = [];

  constructor(
    private readonly logger: NGXLogger,
    private authService: AuthService,
    private tokenManagerService: TokenManagerService,
    private meetingService: MeetingService,
    private activatedRoute: ActivatedRoute,
    private clipboard: ClipboardService,
    private meetingDataService: MeetingDataService
  ) {}

  get isOnlyConsumer(): boolean {
    return this.meetingService.meetingMember.memberType === MemberType.CONSUMER;
  }
  get isMeetingReady(): boolean {
    return this.meetingService.isMeetingReady;
  }
  get localStream(): MediaStream | undefined {
    return this.meetingService.localStream;
  }
  get audioLevel(): number {
    return this.meetingService.activeSpeaker
      ? this.meetingService.activeSpeaker
      : 0;
  }
  get isMeetingCreator(): boolean {
    return this.meetingService.isMeetingCreator;
  }
  get isBroadcasting(): boolean {
    return this.meetingService.isBroadcasting;
  }
  get isDevelopment(): boolean {
    return environment.development;
  }
  async ngOnInit(): Promise<void> {
    const result = this.tokenManagerService.hasAuthToken();
    if (!result.hasAuthToken || result.isExpired) {
      await this.authService
        .createTemporalUser()
        .toPromise()
        .then((data) => {
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
        MeetingServiceType.SFU,
        params.id
      )
      .then(() => {
        this.meetingMembers = this.meetingService.meetingMembers;
        this.meetingMember = this.meetingService.meetingMember;
      });
  }

  async getMeetingLink() {
    if (this.meetingService.meetingId) {
      this.clipboard.copyFromContent(
        window.location.origin +
          '/meetings-sfu/join/' +
          this.meetingService.meetingId
      );
    }
  }
  async getBroadcastingLink() {
    if (this.meetingService.meetingId) {
      this.clipboard.copyFromContent(
        window.location.origin +
          '/meetings-sfu/broadcasting/' +
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
  getMeetingMemberAudioStream(key: string): MediaStream | undefined {
    return this.meetingService.getMeetingMemberAudio(key);
  }
  getMeetingMemberVideoStream(key: string): MediaStream | undefined {
    return this.meetingService.getMeetingMemberVideo(key);
  }
  getMeetingMemberScreenStream(key: string): MediaStream | undefined {
    return this.meetingService.getMeetingMemberScreenVideo(key);
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
  screenSharing(): void {
    this.meetingService.startScreenShare();
  }
  handleBroadcast(): void {
    if (!this.isBroadcasting) {
      this.meetingService.startBroadcastingSession();
    } else {
      this.meetingService.endBroadcastingSession();
    }
  }
  //Temporal functions
  printMeetingMembers() {
    this.meetingService.closeTransport();
    // console.warn('member', this.meetingService.meetingMembers);
    // console.warn(this.meetingService.localStream);
    // const consumers = this.meetingService.getConsumers();
    // consumers.forEach((value: any) => {
    //   const member = this.meetingMembers.get(value.id);
    //   if (member) {
    //     console.warn(
    //       member.produceVideoAllowed &&
    //         member.produceVideoEnabled &&
    //         !member.isScreenSharing
    //     );
    //   }
    // });
  }
  printStreams(key: string): void {
    console.log(this.meetingDataService.meetingMembers);
    console.log(this.meetingService.getConsumers());
  }
  isConsumer(meetingMember: MeetingMemberDto): boolean {
    return meetingMember.memberType === MemberType.CONSUMER;
  }
  get producerMeetingMembers(): MeetingMemberDto[] {
    return Array.from(this.meetingMembers.values()).filter(
      (item) => item.memberType !== MemberType.CONSUMER
    );
  }
  get consumerMeetingMembers(): MeetingMemberDto[] {
    return Array.from(this.meetingMembers.values()).filter(
      (item) => item.memberType === MemberType.CONSUMER
    );
  }
  get messages() {
    return this.meetingService.messages;
  }
  sendMessage(value: string): void {
    this.meetingService.sendMessage(value);
  }
  screenSharePermissionToggle(key: string): void {
    this.meetingService.screenSharePermissionToggle(key);
  }
  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
    this.meetingService.onDestroy();
  }
}
