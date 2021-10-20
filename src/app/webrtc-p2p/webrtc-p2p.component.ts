import { Component, OnDestroy, OnInit } from '@angular/core';
import { NGXLogger } from 'ngx-logger';
import { AuthService } from '../core/services/auth.service';
import { TokenManagerService } from '../core/services/token-manager.service';
import { MeetingService } from '../services/meeting.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ClipboardService } from 'ngx-clipboard';
import {
  MeetingMemberDto,
  MeetingServiceType,
  MemberType,
} from '../types/defines';
import { Subscription } from 'rxjs';
import { MeetingDataService } from '../services/meeting-data.service';
import { environment } from '../../environments/environment';
import { MeetingMember } from '../types/meeting-member.class';

@Component({
  selector: 'app-webrtc-p2p',
  templateUrl: './webrtc-p2p.component.html',
  styleUrls: ['./webrtc-p2p.component.css'],
})
export class WebrtcP2pComponent implements OnInit, OnDestroy {
  opened = true;
  volume = 10;
  subscriptions: Subscription[] = [];
  private state: any;
  constructor(
    private readonly logger: NGXLogger,
    private authService: AuthService,
    private tokenManagerService: TokenManagerService,
    private meetingService: MeetingService,
    private activatedRoute: ActivatedRoute,
    private clipboard: ClipboardService,
    private meetingDataService: MeetingDataService,
    private router: Router
  ) {
    const currentNavigation = this.router.getCurrentNavigation();
    if (currentNavigation) {
      this.state = currentNavigation.extras.state;
    }
  }

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
  get meetingMembers(): Map<string, MeetingMember> {
    return this.meetingService.meetingMembers;
  }
  get meetingMember(): MeetingMemberDto {
    return this.meetingService.meetingMember;
  }
  async ngOnInit(): Promise<void> {
    const authToken = this.tokenManagerService.hasAuthToken();
    const user = authToken.user;
    const snapshotData = this.activatedRoute.snapshot.data;
    let meetingId;
    const params = this.activatedRoute.snapshot.params;
    if (this.state && this.state.meetingId) {
      meetingId = this.state.meetingId;
    }
    if (!meetingId) {
      meetingId = params.id;
    }
    this.meetingService.initMeeting(
      user,
      snapshotData.memberType,
      MeetingServiceType.MESH,
      meetingId
    );
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
    console.log(this.meetingMember);
    if (this.meetingMember) {
      if (this.meetingMember.produceVideoEnabled) {
        this.meetingService.videoPause();
        console.log(this.meetingMember);
        console.log(this.meetingService.localStream);
        console.log(this.meetingDataService.localStream);
      } else {
        this.meetingService.videoResume();
        console.log(this.meetingService.videoTrack?.enabled);
        console.log(this.meetingService.localStream);
        console.log(this.meetingDataService.localStream);
        console.log(this.meetingMember);
      }
    }
  }
  // getMeetingMemberAudioStream(key: string): MediaStream | undefined {
  //   return this.meetingService.getMeetingMemberAudio(key);
  // }
  // getMeetingMemberVideoStream(key: string): MediaStream | undefined {
  //   return this.meetingService.getMeetingMemberVideo(key);
  // }
  // getMeetingMemberScreenStream(key: string): MediaStream | undefined {
  //   return this.meetingService.getMeetingMemberScreenVideo(key);
  // }
  volumeChange(event: any, key: string) {
    const peer = this.meetingMembers.get(key);
    console.log(event.value);
    if (peer) {
      const audioStream = peer.audioStream;
      if (audioStream) {
        const audioTrack = audioStream?.getTracks()[0];
        if (audioTrack) {
          if (peer.volume !== event.value) peer.volume = event.value;
        }
      }
    }
  }
  globalAudioToggle(key: string): void {
    console.log(key);
    console.log(this.meetingMembers.get(key));
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
  toggleService() {
    this.meetingService.toggleService();
  }
  //Temporal functions
  printMeetingMembers() {
    console.log(this.meetingMember);
    console.log(this.producerMeetingMembers);
    const members = Array.from(this.producerMeetingMembers.values());
    console.log(this.hasSFUConnection || members[0].hasSFUConnection);
    console.log(members[0].sfuVideoStream);
    this.meetingService.producerVideoStatus();
    console.log(members[0].videoStream);
    console.log(members[0].videoStream?.getVideoTracks());

    // this.meetingService.closeTransport();
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
    //     console.warn(member.produceVideoAllowed && member.isScreenSharing);
    //     console.warn(this.meetingService.getMeetingMemberVideo(value.id));
    //   }
    //
    //   console.warn('consumer', value);
    // });
  }
  printStreams(): void {
    this.meetingService.getSessionStats();
  }
  isConsumer(meetingMember: MeetingMember): boolean {
    return meetingMember.memberType === MemberType.CONSUMER;
  }

  get producerMeetingMembers(): MeetingMember[] {
    return Array.from(this.meetingMembers.values()).filter(
      (item) => item.memberType !== MemberType.CONSUMER
    );
  }
  get consumerMeetingMembers(): MeetingMember[] {
    return Array.from(this.meetingMembers.values()).filter(
      (item) => item.memberType === MemberType.CONSUMER
    );
  }
  get hasSFUConnection(): boolean {
    return this.meetingMember.connectionType === MeetingServiceType.SFU;
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
