import { Component, OnInit } from '@angular/core';
import { NGXLogger } from 'ngx-logger';
import { MediasoupService } from '../../wss/wss.mediasoup';
import { environment } from '../../../environments/environment';
import { animate, style, transition, trigger } from '@angular/animations';
import { IMemberIdentifier, MemberType } from '../../meetings/types/defines';
import { ActivatedRoute } from '@angular/router';
import { ClipboardService } from 'ngx-clipboard';

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
  readonly user_id: string = environment.user_id;
  room: Record<string, number> = {};
  peers: Map<string, IMemberIdentifier> = new Map<string, IMemberIdentifier>();
  activeSpeakerId = '';
  audioEnabled = false;
  videoEnabled = false;
  videoConsumer = false;
  memberType!: MemberType;
  constructor(
    private readonly logger: NGXLogger,
    private mediasoupService: MediasoupService,
    private activatedRoute: ActivatedRoute,
    private clipboard: ClipboardService
  ) {}

  async ngOnInit(): Promise<void> {
    const snapshotData = this.activatedRoute.snapshot.data;
    const params = this.activatedRoute.snapshot.params;
    this.memberType = snapshotData.memberType;
    //TODO VALIDATE LINK ID
    this.mediasoupService.onConnectionReady().subscribe(async (data) => {
      this.mediasoupService.user_id = this.user_id;
      this.mediasoupService.session_id = '4zsnRr+4wWBLFcSb';
      if (data) {
        await this.mediasoupService
          .joinRoom(snapshotData.memberType)
          .then(async () => {
            // await this.mediasoupService.initCommunication();
          })
          .catch((err) => {
            this.logger.error('TEST COMPONENT', err);
          });
      }
    });
    this.mediasoupService.onAudioEnabled().subscribe((data) => {});
    this.mediasoupService.onVideoEnabled().subscribe((data) => {});
    this.mediasoupService.getConsumers().subscribe((peers) => {
      this.peers = peers;
    });
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
    this.mediasoupService.producerAudioPause(environment.user_id);
  }

  resumeProducerAudio(): void {
    this.mediasoupService.producerAudioResume(environment.user_id);
  }
  printConsumers(): void {
    this.logger.warn('TEST', this.mediasoupService.consumerTransport);
  }
  getLocalStream(): MediaStream | undefined {
    // console.log(this.mediasoupService.getStream());
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
      await this.mediasoupService.producerAudioPause(environment.user_id);
    } else {
      await this.mediasoupService.producerAudioResume(environment.user_id);
    }
    this.audioEnabled = !this.audioEnabled;
  }

  async toggleVideo(): Promise<void> {
    try {
      if (this.videoEnabled) {
        // console.log('PAUSE');
        await this.mediasoupService.producerVideoPause(environment.user_id);
      } else {
        // console.log('RESUME');
        await this.mediasoupService.producerVideoResume(environment.user_id);
      }
      this.videoEnabled = !this.videoEnabled;
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }
  async getMeetingLink() {
    this.clipboard.copyFromContent(
      window.location.origin + '/meetings/join/' + environment.testRoom
    );
  }
  async getBroadcastingLink() {
    this.clipboard.copyFromContent(
      window.location.origin + '/meetings/broadcasting/' + environment.testRoom
    );
  }
  notConsumer(memberType: MemberType) {
    return memberType !== MemberType.CONSUMER;
  }
}
