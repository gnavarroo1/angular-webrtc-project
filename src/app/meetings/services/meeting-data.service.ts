import { Injectable } from '@angular/core';
import {
  MeetingMemberDto,
  MeetingServiceType,
  TChatDto,
} from '../types/defines';
import { MeetingMember } from '../types/meeting-member.class';

@Injectable({ providedIn: 'root' })
export class MeetingDataService {
  private _meetingMember!: MeetingMemberDto;
  private _meetingMembers: Map<string, MeetingMember> = new Map<
    string,
    MeetingMember
  >();
  private _meetingViewers: Map<string, MeetingMember> = new Map<
    string,
    MeetingMember
  >();
  private _meetingId!: string;
  private _meetingServiceType!: MeetingServiceType;
  private _localStream: MediaStream | undefined;
  private _screenStream: MediaStream | null | undefined;
  private _extFile = false;
  get extFile(): boolean {
    return this._extFile;
  }

  set extFile(value: boolean) {
    this._extFile = value;
  }

  get screenStream(): MediaStream | null | undefined {
    return this._screenStream;
  }

  set screenStream(value: MediaStream | null | undefined) {
    this._screenStream = value;
  }

  private _isMeetingCreator!: boolean;
  private _messages: TChatDto[] = [];

  get messages(): TChatDto[] {
    return this._messages;
  }

  set messages(value: TChatDto[]) {
    this._messages = value;
  }

  get meetingId(): string {
    return this._meetingId;
  }

  set meetingId(value: string) {
    this._meetingId = value;
  }

  get meetingServiceType(): MeetingServiceType {
    return this.meetingMember.connectionType;
  }

  set meetingServiceType(value: MeetingServiceType) {
    this.meetingMember.connectionType = value;
  }

  get localStream(): MediaStream | undefined {
    return this._localStream;
  }

  set localStream(value: MediaStream | undefined) {
    this._localStream = value;
  }

  get isMeetingCreator(): boolean {
    return this._isMeetingCreator;
  }

  set isMeetingCreator(value: boolean) {
    this._isMeetingCreator = value;
  }

  get meetingMember(): MeetingMemberDto {
    return this._meetingMember;
  }

  set meetingMember(value: MeetingMemberDto) {
    this._meetingMember = value;
  }

  get meetingMembers(): Map<string, MeetingMember> {
    return this._meetingMembers;
  }

  set meetingMembers(value: Map<string, MeetingMember>) {
    this._meetingMembers = value;
  }
  get meetingViewers(): Map<string, MeetingMember> {
    return this._meetingViewers;
  }

  set meetingViewers(value: Map<string, MeetingMember>) {
    this._meetingViewers = value;
  }
  get hasSFUFullConnection(): boolean {
    return this.meetingServiceType === MeetingServiceType.SFU;
  }
  get hasOneSFUConnection(): boolean {
    let flag = false;
    this.meetingMembers.forEach((member) => {
      if (member.remoteConnectionType === MeetingServiceType.SFU) {
        flag = true;
        return;
      }
    });
    return flag || this.hasSFUFullConnection;
  }
}
