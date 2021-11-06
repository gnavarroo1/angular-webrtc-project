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
  get connected(): boolean {
    return this._connected;
  }
  set connected(value: boolean) {
    this._connected = value;
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
  get videoReady(): boolean {
    return this._videoReady;
  }
  set videoReady(value: boolean) {
    this._videoReady = value;
  }
  // Closed flag.
  private _closed = false;
  private _ignoreOffer = false;
  private _makingOffer = false;
  private _id: string;
  private _rtcPeerConnection: RTCPeerConnection;
  private _connected = false;
  private _polite: boolean;
  private _noiseSendTransceiver!: RTCRtpTransceiver;
  private _videoSendTransceiver!: RTCRtpTransceiver;
  private _screenSendTransceiver!: RTCRtpTransceiver;
  private _noiseRecvTransceiver!: RTCRtpTransceiver;
  private _videoRecvTransceiver!: RTCRtpTransceiver;
  private _screenRecvTransceiver!: RTCRtpTransceiver;
  private _socketId: string;
  private _remoteVideoTrack!: MediaStreamTrack;
  private _remoteAudioTrack!: MediaStreamTrack;
  private _videoReady = false;
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
  async getStats(): Promise<void> {
    if (this.rtcPeerConnection.signalingState === 'closed') {
      return;
    }
    await this.rtcPeerConnection.getStats().then((stats) => {
      const summary: Record<string, any> = {};
      stats.forEach((report) => {
        switch (report.type as RTCStatsType) {
          case 'transport':
            // console.warn(report.type, report);
            summary[report.type] = {
              bytesSent: report.bytesSent,
              bytesReceived: report.bytesReceived,
              packetsSent: report.packetsSent,
              packetsReceived: report.packetsReceived,
              timestamp: report.timestamp,
            };
            break;
          case 'inbound-rtp':
            // console.warn(report.type, report);
            if (report.mediaType === 'video') {
              summary[report.mediaType] = {
                ...summary[report.mediaType],
                framesReceived: report.framesReceived,
                framesDecoded: report.framesDecoded,
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
              timestamp: report.timestamp,
              nackCountInbound: report.nackCount,
            };
            break;
          case 'outbound-rtp':
            // console.warn(report.type, report);
            summary[report.kind] = {
              ...summary[report.kind],
              bytesSent: report.bytesSent,
              packetsSent: report.packetsSent,
              nackCountOutbound: report.nackCount,
              timestamp: report.timestamp,
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
              };
            }
            break;
        }
      });

      // if (Object.keys(this.statsSummary).length > 0) {
      //   if (this.statsSummary.video && summary.video) {
      //     const diff =
      //       (summary.video.timestamp - this.statsSummary.video.timestamp) /
      //       1000;
      //
      //     let framesDecodedPerSecond = 0;
      //     let framesEncodedPerSecond = 0;
      //     let diffBytesSent = 0;
      //     let diffBytesReceived = 0;
      //
      //     if (this.statsSummary.video.framesEncoded) {
      //       framesEncodedPerSecond =
      //         (summary.video.framesEncoded -
      //           this.statsSummary.video.framesEncoded) /
      //         diff;
      //     }
      //     if (this.statsSummary.video.framesDecoded) {
      //       framesDecodedPerSecond =
      //         (summary.video.framesDecoded -
      //           this.statsSummary.video.framesDecoded) /
      //         diff;
      //     }
      //     if (this.statsSummary.video.bytesSent && summary.video.bytesSent) {
      //       diffBytesSent =
      //         summary.video.bytesSent - this.statsSummary.video.bytesSent;
      //     }
      //     if (
      //       this.statsSummary.video.bytesReceived &&
      //       summary.video.bytesReceived
      //     ) {
      //       diffBytesReceived =
      //         summary.video.bytesReceived -
      //         this.statsSummary.video.bytesReceived;
      //     }
      //
      //     const outboundVideoBitrate = (8 * diffBytesSent) / diff;
      //     const inboundVideoBitrate = (8 * diffBytesReceived) / diff;
      //
      //     // console.log('bitrate', outboundVideoBitrate, 'kbps');
      //     summary.video['bitrateOutboundVideo'] = outboundVideoBitrate;
      //     summary.video['bitrateInboundVideo'] = inboundVideoBitrate;
      //     summary.video['framesEncodedPerSecond'] = framesEncodedPerSecond;
      //     summary.video['framesDecodedPerSecond'] = framesDecodedPerSecond;
      //   }
      //   if (this.statsSummary.transport && summary.transport) {
      //     const diffSeconds =
      //       (summary.transport.timestamp -
      //         this.statsSummary.transport.timestamp) /
      //       1000;
      //     let bytesSentBitrate = 0;
      //     let bytesReceivedBitrate = 0;
      //     if (
      //       this.statsSummary.transport.bytesReceived &&
      //       summary.transport.bytesReceived
      //     ) {
      //       bytesReceivedBitrate =
      //         (8 *
      //           (summary.transport.bytesReceived -
      //             this.statsSummary.transport.bytesReceived)) /
      //         diffSeconds;
      //     }
      //     if (
      //       this.statsSummary.transport.bytesSent &&
      //       summary.transport.bytesSent
      //     ) {
      //       bytesSentBitrate =
      //         (8 *
      //           (summary.transport.bytesSent -
      //             this.statsSummary.transport.bytesSent)) /
      //         diffSeconds;
      //     }
      //
      //     summary.transport['bitrateSent'] = bytesSentBitrate;
      //     summary.transport['bitrateReceived'] = bytesReceivedBitrate;
      //   }
      // }

      this.statsSummary = summary;
      // console.warn('summary', summary);
    });
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
