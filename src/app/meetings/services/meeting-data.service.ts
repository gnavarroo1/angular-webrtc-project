import { Injectable } from '@angular/core';
import {
  MeetingMemberDto,
  MeetingServiceType,
  TChatDto,
} from '../types/defines';

@Injectable({ providedIn: 'root' })
export class MeetingDataService {
  private _meetingMember!: MeetingMemberDto;
  private _meetingMembers: Map<string, MeetingMemberDto> = new Map<
    string,
    MeetingMemberDto
  >();
  private _meetingViewers: Map<string, MeetingMemberDto> = new Map<
    string,
    MeetingMemberDto
  >();
  private _meetingId!: string;
  private _meetingServiceType!: MeetingServiceType;
  private _localStream: MediaStream | undefined;
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
    return this._meetingServiceType;
  }

  set meetingServiceType(value: MeetingServiceType) {
    this._meetingServiceType = value;
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

  get meetingMembers(): Map<string, MeetingMemberDto> {
    return this._meetingMembers;
  }

  set meetingMembers(value: Map<string, MeetingMemberDto>) {
    this._meetingMembers = value;
  }
  get meetingViewers(): Map<string, MeetingMemberDto> {
    return this._meetingViewers;
  }

  set meetingViewers(value: Map<string, MeetingMemberDto>) {
    this._meetingViewers = value;
  }
}
