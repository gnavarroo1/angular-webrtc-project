import { Consumer } from 'mediasoup-client/lib/Consumer';

export class SfuConsumer {
  get consumerScreen(): Consumer | undefined {
    return this._consumerScreen;
  }
  set consumerScreen(value: Consumer | undefined) {
    this._consumerScreen = value;
  }
  get consumerAudio(): Consumer | undefined {
    return this._consumerAudio;
  }
  set consumerAudio(value: Consumer | undefined) {
    this._consumerAudio = value;
  }
  get consumerVideo(): Consumer | undefined {
    return this._consumerVideo;
  }
  set consumerVideo(value: Consumer | undefined) {
    this._consumerVideo = value;
  }
  private _consumerScreen: Consumer | undefined;
  private _consumerAudio: Consumer | undefined;
  private _consumerVideo: Consumer | undefined;
  private _consumerAudioTrack: MediaStreamTrack | undefined;
  private _consumerVideoTrack: MediaStreamTrack | undefined;
  private _consumerScreenStream: MediaStream | undefined;
  private _statsSummary: Record<string, any> = {};

  get consumerAudioTrack(): MediaStreamTrack | undefined {
    return this._consumerAudioTrack;
  }
  set consumerAudioTrack(value: MediaStreamTrack | undefined) {
    this._consumerAudioTrack = value;
  }
  get consumerVideoTrack(): MediaStreamTrack | undefined {
    return this._consumerVideoTrack;
  }
  set consumerVideoTrack(value: MediaStreamTrack | undefined) {
    this._consumerVideoTrack = value;
  }
  get consumerScreenStream(): MediaStream | undefined {
    return this._consumerScreenStream;
  }
  set consumerScreenStream(value: MediaStream | undefined) {
    this._consumerScreenStream = value;
  }
  get statsSummary(): Record<string, any> {
    return this._statsSummary;
  }
  set statsSummary(value: Record<string, any>) {
    this._statsSummary = value;
  }
  async getStats(): Promise<void> {
    const summary: Record<string, any> = {};
    if (this.consumerVideo) {
      await Promise.all([
        this.consumerVideo.getStats(),
        this.consumerAudio?.getStats(),
      ])
        .then((stats) => {
          const videoStats = stats[0];
          const audioStats = stats[1];
          if (videoStats) {
            videoStats.forEach((report) => {
              switch (report.type as RTCStatsType) {
                case 'inbound-rtp':
                  summary.video = {
                    ...summary[report.mediaType],
                    packetsReceived: report.packetsReceived,
                    packetsLost: report.packetsLost,
                    framesReceived: report.framesReceived,
                    bytesReceived: report.bytesReceived,
                    framesDecoded: report.framesDecoded,
                    pliCountInbound: report.pliCount,
                    qpSumInbound: report.qpSum,
                    firCountInbound: report.firCount,
                    nackCountInbound: report.nackCount,
                    jitter: report.jitter,
                    timestamp: report.timestamp,
                  };
                  break;
                case 'transport':
                  // console.warn('transport', report);
                  summary.video.transport = {
                    bytesSent: report.bytesSent,
                    bytesReceived: report.bytesReceived,
                    packetsSent: report.packetsSent,
                    packetsReceived: report.packetsReceived,
                    timestamp: report.timestamp,
                  };
                  break;
              }
            });
          }
          if (audioStats) {
            audioStats.forEach((report) => {
              switch (report.type as RTCStatsType) {
                case 'inbound-rtp':
                  summary.audio = {
                    ...summary[report.mediaType],
                    packetsReceived: report.packetsReceived,
                    packetsLost: report.packetsLost,
                    bytesReceived: report.bytesReceived,
                    nackCountInbound: report.nackCount,
                    jitter: report.jitter,
                    timestamp: report.timestamp,
                  };
                  break;
                case 'transport':
                  // console.warn('transport', report);
                  summary.audio.transport = {
                    bytesSent: report.bytesSent,
                    bytesReceived: report.bytesReceived,
                    packetsSent: report.packetsSent,
                    packetsReceived: report.packetsReceived,
                    timestamp: report.timestamp,
                  };
                  break;
              }
            });
          }
        })
        .catch((err) => {
          console.error(err);
        });
    }
    this.statsSummary = summary;

    return;
  }
}
