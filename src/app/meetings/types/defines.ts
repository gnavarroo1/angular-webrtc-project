import { DtlsParameters } from 'mediasoup-client/lib/Transport';

export interface IOfferPayload {
  id: string;
  meetingId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface IIceSelectedTuple {
  readonly localIp: string;
  readonly localPort: number;
  readonly protocol: 'udp' | 'tcp';
  readonly remoteIp: string;
  readonly remotePort: number;
}

export interface ITransportStat {
  readonly availableIncomingBitrate: number;
  readonly bytesReceived: number;
  readonly bytesSent: number;
  readonly dtlsState: TState;
  readonly iceRole: 'controlled';
  readonly iceSelectedTuple: IIceSelectedTuple;
  readonly iceState: TState;
  readonly maxIncomingBitrate: number;
  readonly recvBitrate: number;
  readonly sctpState: TState;
  readonly sendBitrate: number;
  readonly timestamp: number;
  readonly transportId: string; // uuid
  readonly type: 'webrtc-transport';
}

export interface IPeerStat {
  readonly bitrate: number;
  readonly byteCount: number;
  readonly firCount: number;
  readonly fractionLost: number;
  readonly kind: TKind;
  readonly mimeType: string;
  readonly nackCount: number;
  readonly nackPacketCount: number;
  readonly packetCount: number;
  readonly packetsDiscarded: number;
  readonly packetsLost: number;
  readonly packetsRepaired: number;
  readonly packetsRetransmitted: number;
  readonly pliCount: number;
  readonly roundTripTime: number;
  readonly rtxSsrc: number;
  readonly score: number; // RTP stream score (from 0 to 10) representing the transmission quality.
  readonly ssrc: number;
  readonly timestamp: number;
  readonly type: 'outbound-rtp' | 'inbound-rtp';
}

export type TState = 'new' | 'connecting' | 'connected' | 'failed' | 'closed';
export type TPeer = 'producer' | 'consumer';
export type TKind = 'video' | 'audio';

export type MeetingDto = {
  isActive: boolean;
  isBroadcasting: boolean;
  meetingCreatorId: string;
  _id: string;
  activeMembers?: any;
};
export type MeetingMemberDto = {
  _id?: string;
  sessionUserId: string;
  userId: string;
  isGuest: boolean;
  nickname?: string;
  memberType?: MemberType;
  meetingId?: string;
  produceAudioAllowed?: boolean;
  produceVideoAllowed?: boolean;
  produceAudioEnabled?: boolean;
  produceVideoEnabled?: boolean;
  isScreenSharing?: boolean;
};

export enum MemberType {
  BOTH = 'BOTH',
  PRODUCER = 'PRODUCER',
  CONSUMER = 'CONSUMER',
}

export type RouterRTPCapabilities = {
  routerRtpCapabilities: RTCRtpCapabilities;
};
export type ConsumableData = {
  id: string;
  producerId: string;
  kind: TKind;
  rtpParameters: RTCRtpParameters;
};

export type Stats = { kind: TKind; userId: string; stats: IPeerStat[] };
export interface IMemberIdentifier {
  id: string;
  kind: MemberType;
  volume: number;
  producerAudioEnabled?: boolean;
  producerVideoEnabled?: boolean;
  globalAudioEnabled?: boolean;
  globalVideoEnabled?: boolean;
  isScreenSharing: boolean;
}
export type WebRtcTransportResponse = {
  type: TPeer;
  params: {
    id: string;
    iceParameters: RTCIceParameters;
    iceCandidates: RTCIceCandidate[];
    dtlsParameters: DtlsParameters;
  };
};

export class MeetingMember {
  private _peerConnections: Map<string, RTCPeerConnection> = new Map<
    string,
    RTCPeerConnection
  >();
}
