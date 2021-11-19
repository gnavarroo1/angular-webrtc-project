import { P2PAudioStats, P2PVideoStats } from './defines';

export class P2PConsumer {
  get socketId(): string {
    return this._socketId;
  }
  set socketId(value: string) {
    this._socketId = value;
  }
  get screenSendTransceiver(): RTCRtpTransceiver {
    return this._screenSendTransceiver;
  }
  set screenSendTransceiver(value: RTCRtpTransceiver) {
    this._screenSendTransceiver = value;
  }
  get noiseRecvTransceiver(): RTCRtpTransceiver {
    return this._noiseRecvTransceiver;
  }
  set noiseRecvTransceiver(value: RTCRtpTransceiver) {
    this._noiseRecvTransceiver = value;
  }
  get videoRecvTransceiver(): RTCRtpTransceiver {
    return this._videoRecvTransceiver;
  }
  set videoRecvTransceiver(value: RTCRtpTransceiver) {
    this._videoRecvTransceiver = value;
  }
  get noiseSendTransceiver(): RTCRtpTransceiver {
    return this._noiseSendTransceiver;
  }
  set noiseSendTransceiver(value: RTCRtpTransceiver) {
    this._noiseSendTransceiver = value;
  }
  get videoSendTransceiver(): RTCRtpTransceiver {
    return this._videoSendTransceiver;
  }
  set videoSendTransceiver(value: RTCRtpTransceiver) {
    this._videoSendTransceiver = value;
  }
  get remoteVideoTrack(): MediaStreamTrack {
    return this._remoteVideoTrack;
  }
  set remoteVideoTrack(value: MediaStreamTrack) {
    // const audioTracks = this.remoteStream.getAudioTracks();
    this._remoteVideoTrack = value;
  }
  get remoteAudioTrack(): MediaStreamTrack {
    return this._remoteAudioTrack;
  }
  set remoteAudioTrack(value: MediaStreamTrack) {
    this._remoteAudioTrack = value;
  }
  get id(): string {
    return this._id;
  }
  get rtcPeerConnection(): RTCPeerConnection {
    return this._rtcPeerConnection;
  }
  get closed(): boolean {
    return this._closed;
  }
  set closed(value: boolean) {
    this._closed = value;
  }
  get polite(): boolean {
    return this._polite;
  }
  set polite(value: boolean) {
    this._polite = value;
  }

  get ignoreOffer(): boolean {
    return this._ignoreOffer;
  }
  set ignoreOffer(value: boolean) {
    this._ignoreOffer = value;
  }
  get makingOffer(): boolean {
    return this._makingOffer;
  }
  set makingOffer(value: boolean) {
    this._makingOffer = value;
  }

  get answerPending(): boolean {
    return this._answerPending;
  }

  set answerPending(value: boolean) {
    this._answerPending = value;
  }

  // Closed flag.
  private _closed = false;
  private _ignoreOffer = false;
  private _makingOffer = false;
  private _id: string;
  private _rtcPeerConnection: RTCPeerConnection;

  private _noiseSendTransceiver!: RTCRtpTransceiver;
  private _videoSendTransceiver!: RTCRtpTransceiver;
  private _screenSendTransceiver!: RTCRtpTransceiver;
  private _noiseRecvTransceiver!: RTCRtpTransceiver;
  private _videoRecvTransceiver!: RTCRtpTransceiver;
  private _socketId: string;
  private _remoteVideoTrack!: MediaStreamTrack;
  private _remoteAudioTrack!: MediaStreamTrack;

  private _answerPending = false;
  private _polite: boolean;

  private _statsSummary: Record<string, any> = {};

  get statsSummary(): Record<string, any> {
    return this._statsSummary;
  }
  set statsSummary(value: Record<string, any>) {
    this._statsSummary = value;
  }
  constructor({
    id,
    socketId,
    rtcPeerConnection,
    isPolite,
  }: {
    id: string;
    socketId: string;
    rtcPeerConnection: RTCPeerConnection;
    isPolite: boolean;
  }) {
    this._id = id;
    this._socketId = socketId;
    this._rtcPeerConnection = rtcPeerConnection;
    this._polite = isPolite;
  }
  async getStats(defaultTimestamp: number): Promise<void> {
    if (this.rtcPeerConnection.connectionState === 'closed') {
      return;
    }
    const stats = await this.rtcPeerConnection.getStats();
    const summary: Record<string, any> = {};
    const defaultBaseStats = {
      bytesSent: 0,
      bytesReceived: 0,
      nackCountOutbound: 0,
      nackCountInbound: 0,
      packetsLost: 0,
      packetsSent: 0,
      packetsReceived: 0,
      jitter: 0,
      timestamp: defaultTimestamp,
    };

    stats.forEach((report) => {
      switch (report.type) {
        case 'transport':
          summary[report.type] = {
            bytesSent: report.bytesSent,
            bytesReceived: report.bytesReceived,
            packetsSent: report.packetsSent,
            packetsReceived: report.packetsReceived,
            timestamp: defaultTimestamp,
          };
          break;
        case 'inbound-rtp':
          if (report.mediaType === 'video') {
            summary[report.mediaType] = {
              ...summary[report.mediaType],
              remoteFrameHeight: report.frameHeight,
              remoteFrameWidth: report.frameWidth,
              framesReceived: report.framesReceived,
              framesDecoded: report.framesDecoded,
              framesDropped: report.framesDropped,
              pliCountInbound: report.pliCount,
              qpSumInbound: report.qpSum,
              firCountInbound: report.firCount,
            };
          }
          summary[report.mediaType] = {
            ...summary[report.mediaType],
            packetsReceived: report.packetsReceived,
            packetsLost: report.packetsLost,
            bytesReceived: report.bytesReceived,
            jitter: report.jitter,
            timestamp: defaultTimestamp,
            nackCountInbound: report.nackCount,
          };
          break;
        case 'outbound-rtp':
          summary[report.kind] = {
            ...summary[report.kind],
            bytesSent: report.bytesSent,
            packetsSent: report.packetsSent,
            nackCountOutbound: report.nackCount,
            timestamp: defaultTimestamp,
          };
          if (report.kind === 'video') {
            summary[report.kind] = {
              ...summary[report.kind],
              qualityLimitationReason: report.qualityLimitationReason,
              pliCountOutbound: report.pliCount,
              qpSumOutbound: report.qpSum,
              firCountOutbound: report.firCount,
              framesSent: report.framesSent,
              framesEncoded: report.framesEncoded,
              localFrameHeight: report.frameHeight,
              localFrameWidth: report.frameWidth,
            };
          }
          break;
      }
    });

    if (!summary.audio) {
      summary.audio = defaultBaseStats;
    }
    if (!summary.video) {
      summary.video = {
        ...defaultBaseStats,
        firCountInbound: 0,
        firCountOutbound: 0,
        framesDecoded: 0,
        framesEncoded: 0,
        framesReceived: 0,
        framesSent: 0,
        pliCountInbound: 0,
        pliCountOutbound: 0,
        qpSumInbound: 0,
        qpSumOutbound: 0,
        qualityLimitationReason: 'none',
      };
    }
    this.statsSummary = summary;

    return;
  }
  onDestroy(): void {
    this.rtcPeerConnection.close();
    if (this.remoteVideoTrack && this.remoteVideoTrack.readyState !== 'ended') {
      this.remoteVideoTrack.stop();
    }
    if (this.remoteAudioTrack && this.remoteVideoTrack.readyState !== 'ended') {
      this.remoteAudioTrack.stop();
    }
  }
}
