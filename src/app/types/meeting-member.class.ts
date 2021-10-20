import { MeetingServiceType, MemberType } from './defines';
import { P2PConsumer } from './p2p-consumer.class';
import { SfuConsumer } from './sfu-consumer.class';
import { EventEmitter } from '@angular/core';
export class MeetingMember {
  get id(): string {
    return this._id;
  }

  set id(value: string) {
    this._id = value;
  }

  get sessionUserId(): string {
    return this._sessionUserId;
  }

  set sessionUserId(value: string) {
    this._sessionUserId = value;
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

  get connectionType(): MeetingServiceType {
    return this._connectionType;
  }

  set connectionType(value: MeetingServiceType) {
    this._connectionType = value;
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
  private _id: string;
  private _sessionUserId: string;
  private _userId: string;
  private _nickname: string;
  private _memberType: MemberType;
  private _isScreenSharing: boolean;
  private _connectionType: MeetingServiceType;
  private _canScreenShare: boolean;
  private _produceVideoEnabled: boolean;
  private _produceAudioEnabled: boolean;
  private _produceVideoAllowed: boolean;
  private _produceAudioAllowed: boolean;
  private _volume = 1.0;
  private _p2pConsumerConnection!: P2PConsumer;
  private _sfuConsumerConnection!: SfuConsumer;
  private _videoStream: MediaStream | undefined | null;
  constructor(meetingMember: {
    _id: string;
    userId: string;
    sessionUserId: string;
    memberType: MemberType;
    nickname: string;
    isScreenSharing: boolean;
    connectionType: MeetingServiceType;
    canScreenShare: boolean;
    produceVideoEnabled: boolean;
    produceVideoAllowed: boolean;
    produceAudioEnabled: boolean;
    produceAudioAllowed: boolean;
  }) {
    this._id = meetingMember._id;
    this._sessionUserId = meetingMember.sessionUserId;
    this._userId = meetingMember.userId;
    this._nickname = meetingMember.nickname;
    this._memberType = meetingMember.memberType;
    this._isScreenSharing = meetingMember.isScreenSharing;
    this._connectionType = meetingMember.connectionType;
    this._canScreenShare = meetingMember.canScreenShare;
    this._produceAudioAllowed = meetingMember.produceAudioAllowed;
    this._produceAudioEnabled = meetingMember.produceAudioEnabled;
    this._produceVideoAllowed = meetingMember.produceVideoAllowed;
    this._produceVideoEnabled = meetingMember.produceVideoEnabled;
    this.sfuConsumerConnection = new SfuConsumer();
  }
  get videoStream(): MediaStream | undefined | null {
    return this._videoStream;
  }
  set videoStream(value) {
    console.log(Date.now());
    this._videoStream = value;
  }

  get meshVideoStream(): MediaStream | undefined | null {
    return this.p2pConsumerConnection?.remoteVideoTrack;
  }

  get sfuVideoStream(): MediaStream | undefined | null {
    return this.sfuConsumerConnection?.consumerVideoStream;
  }

  get audioStream(): MediaStream | undefined | null {
    switch (this.connectionType) {
      case MeetingServiceType.SFU:
        return this.sfuConsumerConnection?.consumerAudioStream;
      case MeetingServiceType.MESH:
        return this.p2pConsumerConnection?.remoteAudioTrack;
    }
    return null;
  }
  get screenStream(): MediaStream | undefined | null {
    switch (this.connectionType) {
      case MeetingServiceType.SFU:
        return this.sfuConsumerConnection?.consumerScreenStream;
      case MeetingServiceType.MESH:
        return this.p2pConsumerConnection?.screenStream;
    }
    return null;
  }

  get hasSFUConnection(): boolean {
    return this.connectionType === MeetingServiceType.SFU;
  }
}
