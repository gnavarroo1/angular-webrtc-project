import { Consumer } from 'mediasoup-client/lib/Consumer';
import { AudioConsumerStats, VideoConsumerStats } from './defines';

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
  async getStats(defaultTimestamp: number): Promise<void> {
    const summary: Record<
      string,
      VideoConsumerStats | AudioConsumerStats | any
    > = {
      video: {
        packetsReceived: 0,
        packetsLost: 0,
        framesReceived: 0,
        bytesReceived: 0,
        framesDecoded: 0,
        pliCountInbound: 0,
        qpSumInbound: 0,
        firCountInbound: 0,
        nackCountInbound: 0,
        jitter: 0,
        timestamp: defaultTimestamp,
      },
      audio: {
        packetsReceived: 0,
        packetsLost: 0,
        bytesReceived: 0,
        nackCountInbound: 0,
        jitter: 0,
        timestamp: defaultTimestamp,
      },
    };

    const hasConsumerVideo = !!this.consumerVideo;
    const hasConsumerAudio = !!this.consumerAudio;
    let videoStats;
    let audioStats;
    if (hasConsumerVideo && hasConsumerAudio) {
      videoStats = await this.consumerVideo?.getStats();
      audioStats = await this.consumerAudio?.getStats();
    } else if (hasConsumerVideo) {
      videoStats = await this.consumerVideo?.getStats();
    } else if (hasConsumerAudio) {
      audioStats = await this.consumerAudio?.getStats();
    } else {
      this.statsSummary = summary;
      return;
    }

    if (videoStats) {
      videoStats.forEach((report) => {
        switch (report.type as RTCStatsType) {
          case 'media-source':
          case 'track':
            console.warn(report);
            break;
          case 'inbound-rtp':
            summary.video = {
              packetsReceived: report.packetsReceived,
              packetsLost: report.packetsLost,
              framesReceived: report.framesReceived,
              bytesReceived: report.bytesReceived,
              framesDecoded: report.framesDecoded,
              firCountInbound: report.firCount,
              pliCountInbound: report.pliCount,
              qpSumInbound: report.qpSum,
              nackCountInbound: report.nackCount,
              framesDropped: report.framesDropped,
              remoteFrameHeight: report.frameHeight,
              remoteFrameWidth: report.frameWidth,
              jitter: report.jitter,
              timestamp: defaultTimestamp,
            };
            break;
        }
      });
    } else {
      summary.video = {
        packetsReceived: 0,
        packetsLost: 0,
        framesReceived: 0,
        bytesReceived: 0,
        framesDecoded: 0,
        pliCountInbound: 0,
        qpSumInbound: 0,
        firCountInbound: 0,
        nackCountInbound: 0,
        jitter: 0,
        timestamp: defaultTimestamp,
      };
    }
    if (audioStats) {
      audioStats.forEach((report) => {
        // console.warn(report);
        switch (report.type as RTCStatsType) {
          case 'media-source':
          case 'track':
            console.warn(report);
            break;
          case 'inbound-rtp':
            summary.audio = {
              packetsReceived: report.packetsReceived,
              packetsLost: report.packetsLost,
              bytesReceived: report.bytesReceived,
              nackCountInbound: report.nackCount,
              jitter: report.jitter,
              timestamp: defaultTimestamp,
            };
            break;
        }
      });
    } else {
      summary.audio = {
        packetsReceived: 0,
        packetsLost: 0,
        bytesReceived: 0,
        nackCountInbound: 0,
        jitter: 0,
        timestamp: defaultTimestamp,
      };
    }
    console.warn(summary, this.consumerVideo?.kind, this.consumerAudio?.kind);
    this.statsSummary = summary;
    return;
  }
}
