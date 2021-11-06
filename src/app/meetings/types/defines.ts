import {
  DtlsParameters,
  IceCandidate,
  IceParameters,
} from 'mediasoup-client/lib/Transport';
import {
  RtcpParameters,
  RtpCapabilities,
} from 'mediasoup-client/lib/RtpParameters';
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
  readonly jitter: number;
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
export enum MeetingServiceType {
  MESH = 'MESH',
  SFU = 'SFU',
  BOTH = 'BOTH',
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
export type TChatDto = {
  text: string;
  nickname: string;
  timestamp: string;
  meetingMemberId: string;
};
export type MeetingMemberDto = {
  _id?: string;
  userId: string;
  memberType: MemberType;
  nickname?: string;

  isScreenSharing: boolean;
  produceVideoEnabled?: boolean;
  produceAudioEnabled?: boolean;
  produceAudioAllowed?: boolean;
  produceVideoAllowed?: boolean;
  connectionType: MeetingServiceType;
  canScreenShare?: boolean;
  volume?: number;
  meetingId?: string;
};
export type IMeetingMemberDto = IMeetingMemberBase;

export interface IMeetingMemberBase {
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
}

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
export type Stats = { kind: TKind; user_id: string; stats: IPeerStat[] };
export interface IMemberIdentifier {
  id: string;
  kind: MemberType;
  isScreenSharing?: boolean;
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
export type SocketQueryParams = {
  meetingId: string;
  userId: string;
};
export type TCreateWebRtcTransportResponse = {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
};
export type TCreateWebRtcTransportRequest = {
  type: TPeer;
};
export type TConnectWebRtcTransportRequest = {
  dtlsParameters: DtlsParameters;
  type: TPeer;
};
export type TProduceRequest = {
  producerTransportId: string;
  kind: TKind;
  rtpParameters: RTCRtpParameters;
};
export type TTargetProducerRequest = {
  userId: string;
  kind: TKind;
  isGlobal: boolean;
};
export type TMediaKindRequest = {
  kind: TKind;
};
export type TConsumeRequest = {
  rtpCapabilities: RtpCapabilities;
  userId: string;
  kind: TKind;
};

//Stats Types
export type P2PVideoStats = {
  bytesSent?: number;
  bytesReceived?: number;
  packetsReceived?: number;
  packetsSent?: number;
  packetsLost?: number;
  nackCountInbound?: number;
  nackCountOutbound?: number;
  framesSent?: number;
  framesEncoded?: number;
  qpSumOutbound?: number;
  firCountOutbound?: number;
  pliCountOutbound?: number;
  framesReceived?: number;
  framesDecoded?: number;
  qpSumInbound?: number;
  firCountInbound?: number;
  pliCountInbound?: number;
  timestamp?: number;
  jitter?: number;
  qualityLimitationReason?: 'none' | 'cpu' | 'bandwidth' | 'other';
};
export type P2PAudioStats = {
  bytesSent?: number;
  bytesReceived?: number;
  packetsReceived?: number;
  packetsSent?: number;
  packetsLost?: number;
  nackCountInbound?: number;
  nackCountOutbound?: number;
  timestamp?: number;
  jitter?: number;
};

export type TransportStats = {
  bytesSent?: number;
  bytesReceived?: number;
  packetsSent?: number;
  packetsReceived?: number;
  timestamp?: number;
};

export type P2PStatsSnapshot = {
  transport?: TransportStats;
  video?: P2PVideoStats;
  audio?: P2PAudioStats;
};

export type VideoProducerStats = {
  bitrate?: number;
  nackCount: number;
  firCount?: number;
  pliCount?: number;
  jitter?: number;
  byteCount?: number;
  packetCount?: number;
  packetsLost?: number;
  timestamp: number;
};
export type AudioProducerStats = {
  bitrate?: number;
  nackCount?: number;
  packetCount?: number;
  packetsLost?: number;
  jitter?: number;
  byteCount?: number;
  timestamp: number;
};

export type ProducerStatsSnapshot = {
  transport?: TransportStats;
  video?: VideoProducerStats;
  audio?: AudioProducerStats;
};

export type VideoConsumerStats = {
  transport?: TransportStats;
  bytesReceived?: number;
  packetsReceived?: number;
  framesReceived?: number;
  framesDecoded?: number;
  packetsLost?: number;
  nackCountInbound?: number;
  qpSumInbound?: number;
  firCountInbound?: number;
  pliCountInbound?: number;
  timestamp?: number;
};
export type AudioConsumerStats = {
  transport?: TransportStats;
  packetsLost?: number;
  bytesReceived?: number;
  packetsReceived?: number;
  nackCountInbound?: number;
  timestamp?: number;
};

export type ConsumerStatsSnapshot = {
  transport?: TransportStats;
  video: Map<string, VideoConsumerStats>;
  audio: Map<string, AudioConsumerStats>;
};

export type SfuStatsSnapshot = {
  producer?: ProducerStatsSnapshot;
  consumer?: ConsumerStatsSnapshot;
};

export type CurrentSessionStats = {
  meetingId: string;
  meetingMemberId: string;
  p2pSnapshots: P2PStatsSnapshot[];
  sfuSnapshot?: SfuStatsSnapshot;
};
