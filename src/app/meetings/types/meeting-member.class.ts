import { MeetingServiceType, MemberType } from './defines';
import { P2PConsumer } from './p2p-consumer.class';
import { SfuConsumer } from './sfu-consumer.class';
import * as EventEmitter from 'events';

export class MeetingMember {
  //Getter and Setters
  get localConnectionType(): MeetingServiceType {
    return this._localConnectionType;
  }
  set localConnectionType(value: MeetingServiceType) {
    this._localConnectionType = value;
  }

  get id(): string {
    return this._id;
  }
  set id(value: string) {
    this._id = value;
  }

  get userId(): string {
    return this._userId;
  }
  set userId(value: string) {
    this._userId = value;
  }

  get nickname(): string {
    return this._nickname;
  }
  set nickname(value: string) {
    this._nickname = value;
  }

  get memberType(): MemberType {
    return this._memberType;
  }
  set memberType(value: MemberType) {
    this._memberType = value;
  }

  get isScreenSharing(): boolean {
    return this._isScreenSharing;
  }
  set isScreenSharing(value: boolean) {
    this._isScreenSharing = value;
  }

  get remoteConnectionType(): MeetingServiceType {
    return this._remoteConnectionType;
  }
  set remoteConnectionType(value: MeetingServiceType) {
    this._remoteConnectionType = value;
  }

  get canScreenShare(): boolean {
    return this._canScreenShare;
  }
  set canScreenShare(value: boolean) {
    this._canScreenShare = value;
  }

  get produceVideoEnabled(): boolean {
    return this._produceVideoEnabled;
  }
  set produceVideoEnabled(value: boolean) {
    this._produceVideoEnabled = value;
  }

  get produceAudioEnabled(): boolean {
    return this._produceAudioEnabled;
  }
  set produceAudioEnabled(value: boolean) {
    this._produceAudioEnabled = value;
  }

  get produceVideoAllowed(): boolean {
    return this._produceVideoAllowed;
  }
  set produceVideoAllowed(value: boolean) {
    this._produceVideoAllowed = value;
  }

  get produceAudioAllowed(): boolean {
    return this._produceAudioAllowed;
  }
  set produceAudioAllowed(value: boolean) {
    this._produceAudioAllowed = value;
  }

  get volume(): number {
    return this._volume;
  }
  set volume(value: number) {
    this._volume = value;
  }

  get p2pConsumerConnection(): P2PConsumer {
    return this._p2pConsumerConnection;
  }
  set p2pConsumerConnection(value: P2PConsumer) {
    this._p2pConsumerConnection = value;
  }

  get sfuConsumerConnection(): SfuConsumer {
    return this._sfuConsumerConnection;
  }
  set sfuConsumerConnection(value: SfuConsumer) {
    this._sfuConsumerConnection = value;
  }

  get audioStream(): MediaStream | undefined | null {
    return this._audioStream;
  }
  set audioStream(value: MediaStream | undefined | null) {
    this._audioStream = value;
  }

  get videoStream(): MediaStream | undefined | null {
    return this._videoStream;
  }
  set videoStream(value) {
    this._videoStream = value;
  }

  get screenStream(): MediaStream | undefined | null {
    return this.sfuConsumerConnection?.consumerScreenStream;
  }

  get hasSFUConnection(): boolean {
    return (
      this.remoteConnectionType === MeetingServiceType.SFU ||
      this.localConnectionType === MeetingServiceType.SFU
    );
  }

  private _id: string;
  private _userId: string;
  private _nickname: string;
  private _memberType: MemberType;
  private _isScreenSharing: boolean;
  private _remoteConnectionType: MeetingServiceType;
  private _localConnectionType: MeetingServiceType;
  private _canScreenShare: boolean;
  private _produceVideoEnabled: boolean;
  private _produceAudioEnabled: boolean;
  private _produceVideoAllowed: boolean;
  private _produceAudioAllowed: boolean;
  private _volume = 1.0;
  private _p2pConsumerConnection!: P2PConsumer;
  private _sfuConsumerConnection!: SfuConsumer;
  private _videoStream: MediaStream | undefined | null;
  private _audioStream: MediaStream | undefined | null;

  private _eventEmitter: EventEmitter = new EventEmitter();

  get eventEmitter(): EventEmitter {
    return this._eventEmitter;
  }

  constructor(meetingMember: {
    _id: string;
    userId: string;
    memberType: MemberType;
    nickname: string;
    isScreenSharing: boolean;
    connectionType: MeetingServiceType;
    localConnectionType: MeetingServiceType;
    canScreenShare: boolean;
    produceVideoEnabled: boolean;
    produceVideoAllowed: boolean;
    produceAudioEnabled: boolean;
    produceAudioAllowed: boolean;
  }) {
    this._id = meetingMember._id;
    this._userId = meetingMember.userId;
    this._nickname = meetingMember.nickname;
    this._memberType = meetingMember.memberType;
    this._isScreenSharing = meetingMember.isScreenSharing;
    this._remoteConnectionType = meetingMember.connectionType;
    this._canScreenShare = meetingMember.canScreenShare;
    this._localConnectionType = meetingMember.localConnectionType;
    this._produceAudioAllowed = meetingMember.produceAudioAllowed;
    this._produceAudioEnabled = meetingMember.produceAudioEnabled;
    this._produceVideoAllowed = meetingMember.produceVideoAllowed;
    this._produceVideoEnabled = meetingMember.produceVideoEnabled;
    this.sfuConsumerConnection = new SfuConsumer();
    // this._eventEmitter.on('connectionTypeUpdate', (to: MeetingServiceType) => {
    //
    // });
  }

  //Functions
  /**
   * Used when the remote member is the one who changes the connection type
   * Updates the remote connection type and sets the audio and video stream accordingly
   * @param to
   */
  updateRemoteConnectionType(to: MeetingServiceType): void {
    console.warn('connection type changed to', to);
    console.warn(
      'video track available',
      this.sfuConsumerConnection.consumerVideoTrack,
      this.p2pConsumerConnection.remoteVideoTrack
    );
    console.warn('currentvideoTrack', this.videoStream?.getVideoTracks()[0]);
    console.warn('currentaudioTrack', this.audioStream?.getAudioTracks()[0]);
    switch (to) {
      case MeetingServiceType.SFU:
        if (
          this.sfuConsumerConnection.consumerVideo &&
          this.produceVideoEnabled
        ) {
          this.videoStream = new MediaStream([
            this.sfuConsumerConnection.consumerVideo.track,
          ]);
        }
        this.emitVideoStreamChange();
        if (
          this.sfuConsumerConnection.consumerAudio &&
          this.produceAudioEnabled
        ) {
          console.log('change audio stream');
          this.audioStream = new MediaStream([
            this.sfuConsumerConnection.consumerAudio.track,
          ]);
        }
        this.emitAudioStreamChange();
        break;
      case MeetingServiceType.MESH:
        if (
          this.p2pConsumerConnection.remoteVideoTrack &&
          this.produceVideoEnabled
        ) {
          this.videoStream = new MediaStream([
            this.p2pConsumerConnection.remoteVideoTrack,
          ]);
        }
        this.emitVideoStreamChange();
        if (
          this.p2pConsumerConnection.remoteAudioTrack &&
          this.produceAudioEnabled
        ) {
          this.audioStream = new MediaStream([
            this.p2pConsumerConnection.remoteAudioTrack,
          ]);
        }
        this.emitAudioStreamChange();
        break;
    }
    this.remoteConnectionType = to;
    // this._eventEmitter.emit('connectionTypeUpdate', to);
  }

  /**
   * Used when the local member is the one who changes the connection type
   * Updates the local connection type and sets the audio and video stream accordingly
   * @param to
   */
  updateLocalConnectionType(to: MeetingServiceType): void {
    console.warn('connection type changed to', to);
    console.warn(
      'video track available',
      this.sfuConsumerConnection.consumerVideoTrack,
      this.p2pConsumerConnection.remoteVideoTrack
    );
    console.warn('currentvideoTrack', this.videoStream?.getVideoTracks()[0]);
    console.warn('currentaudioTrack', this.audioStream?.getAudioTracks()[0]);
    switch (to) {
      case MeetingServiceType.SFU:
        if (
          this.sfuConsumerConnection.consumerVideo &&
          this.produceVideoEnabled
        ) {
          console.log('change video track sfu');
          this.videoStream = new MediaStream([
            this.sfuConsumerConnection.consumerVideo.track,
          ]);
        }
        this.emitVideoStreamChange();
        if (
          this.sfuConsumerConnection.consumerAudio &&
          this.produceAudioEnabled
        ) {
          const currenAudioTrack = this.audioStream?.getAudioTracks()[0];
          if (
            !(
              currenAudioTrack &&
              currenAudioTrack.id ===
                this.sfuConsumerConnection.consumerAudio.track.id
            )
          ) {
            this.audioStream = new MediaStream([
              this.sfuConsumerConnection.consumerAudio.track,
            ]);
          }

          console.log('change to sfu audiotrack');
        }
        this.emitAudioStreamChange();
        break;
      case MeetingServiceType.MESH:
        if (
          this.p2pConsumerConnection.remoteVideoTrack &&
          this.produceVideoEnabled
        ) {
          console.log('change video track p2p');
          this.videoStream = new MediaStream([
            this.p2pConsumerConnection.remoteVideoTrack,
          ]);
        }
        this.emitVideoStreamChange();
        if (
          this.p2pConsumerConnection.remoteAudioTrack &&
          this.produceAudioEnabled
        ) {
          console.log('change audio track p2p');
          this.audioStream = new MediaStream([
            this.p2pConsumerConnection.remoteAudioTrack,
          ]);
          console.log('change to rtc audio track');
        }
        this.emitAudioStreamChange();
        break;
    }
    this.localConnectionType = to;
  }

  emitAudioStreamChange() {
    this._eventEmitter.emit('audioStreamChange');
  }

  emitVideoStreamChange() {
    this._eventEmitter.emit('videoStreamChange');
  }
}
