import { IPeerStat, TKind, TPeer } from '../../mediasoup-client/interfaces';
import { MemberType } from './enums';

export type RouterRTPCapabilities = {
  routerRtpCapabilities: RTCRtpCapabilities;
};
export type ConsumableData = {
  id: string;
  producerId: string;
  kind: TKind;
  rtpParameters: RTCRtpParameters;
};

export type StringArray = string[];
export type Stats = { kind: TKind; user_id: string; stats: IPeerStat[] };
export type WebRtcTransportResponse = {
  type: TPeer;
  params: {
    id: string;
    iceParameters: RTCIceParameters;
    iceCandidates: RTCIceCandidate[];
    dtlsParameters: object;
  };
};

export interface IMemberIdentifier {
  id: string;
  kind: MemberType;
}

export type WssEventMediaResponse = StringArray &
  RouterRTPCapabilities &
  ConsumableData &
  RTCIceParameters &
  Stats &
  WebRtcTransportResponse;
