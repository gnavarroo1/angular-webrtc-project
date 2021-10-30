import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NGXLogger } from 'ngx-logger';
import { AuthService } from '../../../shared/services/auth.service';
import { TokenManagerService } from '../../../shared/services/token-manager.service';
import { MeetingService } from '../../services/meeting.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ClipboardService } from 'ngx-clipboard';
import {
  MeetingMemberDto,
  MeetingServiceType,
  MemberType,
} from '../../types/defines';
import { Subscription } from 'rxjs';
import { MeetingDataService } from '../../services/meeting-data.service';
import { environment } from '../../../../environments/environment';
import { MeetingMember } from '../../types/meeting-member.class';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-webrtc-p2p',
  templateUrl: './webrtc-p2p.component.html',
  styleUrls: ['./webrtc-p2p.component.css'],
})
export class WebrtcP2pComponent implements OnInit, OnDestroy {
  opened = true;
  volume = 10;
  subscriptions: Subscription[] = [];
  durationInSeconds = 0;
  private state: any;
  constructor(
    private readonly logger: NGXLogger,
    private authService: AuthService,
    private tokenManagerService: TokenManagerService,
    private meetingService: MeetingService,
    private activatedRoute: ActivatedRoute,
    private clipboard: ClipboardService,
    private meetingDataService: MeetingDataService,
    private router: Router,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private snackBar: MatSnackBar
  ) {
    this.matIconRegistry.addSvgIcon(
      'svg-mic-on',
      this.domSanitizer.bypassSecurityTrustResourceUrl('/assets/svg/mic-on.svg')
    );
    this.matIconRegistry.addSvgIcon(
      'svg-mic-off',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg/mic-off.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'svg-cam-on',
      this.domSanitizer.bypassSecurityTrustResourceUrl('/assets/svg/cam-on.svg')
    );
    this.matIconRegistry.addSvgIcon(
      'svg-cam-off',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg/cam-off.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'svg-share-on',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg/share-on.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'svg-share-off',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg/share-off.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'svg-bc-on',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg/broadcast-on.svg'
      )
    );
    this.matIconRegistry.addSvgIcon(
      'svg-bc-off',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        '/assets/svg/broadcast-off.svg'
      )
    );

    const currentNavigation = this.router.getCurrentNavigation();
    if (currentNavigation) {
      this.state = currentNavigation.extras.state;
    }
  }

  openSnackBar() {
    this.snackBar.open('Enlace copiado!', '', {
      verticalPosition: 'top',
      horizontalPosition: 'center',
      duration: 5000,
    });
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
  get isScreenSharing(): boolean {
    return this.meetingService.isScreenSharing;
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
  get screenStream(): MediaStream | undefined | null {
    return this.meetingService.screenStream;
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
          '/meetings/join/' +
          this.meetingService.meetingId
      );
      this.openSnackBar();
    }
  }
  async getBroadcastingLink() {
    if (this.meetingService.meetingId) {
      this.clipboard.copyFromContent(
        window.location.origin +
          '/meetings/broadcasting/' +
          this.meetingService.meetingId
      );
      this.openSnackBar();
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
    if (!this.meetingMember.isScreenSharing) {
      this.meetingService.startScreenShare();
    } else {
      this.meetingService.stopScreenShare();
    }
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
    // console.log(members[0].sfuVideoStream);
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

  get rowCount(): number {
    const size = this.meetingMembers.size + 1;
    if (size < 3) {
      return 1;
    } else if (size < 7) {
      return 2;
    } else if (size < 13) {
      return 3;
    } else {
      return 4;
    }
  }
  get colCount(): number {
    const size = this.meetingMembers.size + 1;
    if (size < 2) {
      return 1;
    } else if (size < 5) {
      return 2;
    } else if (size < 10) {
      return 3;
    } else {
      return 4;
    }
  }
  get memberCardClass(): string {
    if (this.isScreenSharing) {
      return 'member-card-row';
    }
    return `member-card-${this.rowCount}-${this.colCount}`;
  }

  @HostListener('unloaded')
  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
    this.meetingService.onDestroy();
  }
}
