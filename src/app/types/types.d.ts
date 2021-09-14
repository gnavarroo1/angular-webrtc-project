import {RtpCapabilities} from "mediasoup-client/lib/RtpParameters";
import {IPeerStat, ITransportStat, TKind, TPeer} from "../../../mediasoup-client/interfaces";

export type RouterRTPCapabilities = {
  routerRtpCapabilities: RTCRtpCapabilities
}
export type ConsumableData = {
  id: string;
  producerId: string;
  kind: TKind;
  rtpParameters: RTCRtpParameters;
}

export type StringArray = string[];
export type TransportStats = { type: TPeer, stats: ITransportStat[] }
export type Stats = { kind: TKind, user_id: string; stats: IPeerStat[] };
export type WebRtcTransportResponse = {
  type: TPeer, params: { id: string; iceParameters: RTCIceParameters; iceCandidates: RTCIceCandidate[]; dtlsParameters: object }
}

export type WssEventMediaResponse = StringArray & RouterRTPCapabilities & ConsumableData & RTCIceParameters & Stats & WebRtcTransportResponse

