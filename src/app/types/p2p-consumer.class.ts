export class P2PConsumer {
  get screenStream(): MediaStream {
    return this._screenStream;
  }
  set screenStream(value: MediaStream) {
    this._screenStream = value;
  }
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
  get screenRecvTransceiver(): RTCRtpTransceiver {
    return this._screenRecvTransceiver;
  }
  set screenRecvTransceiver(value: RTCRtpTransceiver) {
    this._screenRecvTransceiver = value;
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
  get remoteVideoTrack(): MediaStream {
    return this._remoteVideoTrack;
  }
  set remoteVideoTrack(value: MediaStream) {
    // const audioTracks = this.remoteStream.getAudioTracks();
    this._remoteVideoTrack = value;
  }
  get remoteAudioTrack(): MediaStream {
    return this._remoteAudioTrack;
  }
  set remoteAudioTrack(value: MediaStream) {
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
  private _remoteVideoTrack!: MediaStream;
  private _remoteAudioTrack!: MediaStream;
  private _screenStream!: MediaStream;
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
            console.warn(report.type, report);
            summary[report.type] = {
              bytesSent: report.bytesSent,
              bytesReceived: report.bytesReceived,
              packetsSent: report.packetsSent,
              packetsReceived: report.packetsReceived,
              timestamp: report.timestamp,
            };
            break;
          case 'remote-inbound-rtp':
            console.warn(report.type, report);
            summary[report.kind] = {
              ...summary[report.kind],
              send: {
                fractionLost: report.fractionLost,
                jitter: report.jitter,
                packetsLost: report.packetsLost,
                timestamp: report.timestamp,
              },
            };

            break;
          case 'inbound-rtp':
            console.warn(report.type, report);
            summary[report.mediaType] = {
              ...summary[report.mediaType],
              bytesReceived: report.bytesReceived,
            };
            break;
          case 'outbound-rtp':
            summary[report.kind] = {
              ...summary[report.kind],
              bytesSent: report.bytesSent,
              packetsSent: report.packetsSent,
              qualityLimitationReason: report.qualityLimitationReason,
              totalEncodedTime: report.totalEncodedTime,
              timestamp: report.timestamp,
            };
            if (report.kind === 'video') {
              summary[report.kind].firCount = report.firCount;
              summary[report.kind].pliCount = report.pliCount;
              summary[report.kind].qpSum = report.qpSum;
            }
            console.warn(report.type, report);
            break;
          case 'sender':
            console.warn(report.type, report);
            break;
          case 'receiver':
            console.warn(report.type, report);
            break;
        }
      });
      if (Object.keys(this.statsSummary).length == 0) {
        console.log(`there isn't stats summary`);
      } else {
        console.log(this.statsSummary.video);
        console.log(summary.video);
        if (this.statsSummary.video && summary.video) {
          const diff =
            (summary.video.timestamp - this.statsSummary.video.timestamp) /
            1000;
          const diffBytesSent =
            (summary.video.bytesSent - this.statsSummary.video.bytesSent) /
            (1024 * 1024);
          console.log('diff', diff, diffBytesSent);
          const outboundVideoBitrate = (8 * diffBytesSent) / diff;
          summary.video['outboundVideoBitrate'] = outboundVideoBitrate;
        }
      }
      this.statsSummary = summary;
      console.warn('summary', summary);
    });
    return;
  }
  onDestroy(): void {
    this.rtcPeerConnection.close();
    this.remoteVideoTrack.getVideoTracks().forEach((track) => {
      track.stop();
    });
    this.remoteAudioTrack.getAudioTracks().forEach((track) => {
      track.stop();
    });
    this.screenStream.getVideoTracks().forEach((track) => {
      track.stop();
    });
  }
}
