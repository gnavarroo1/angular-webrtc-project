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
    const promises = [];
    const hasConsumerVideo = !!this.consumerVideo;
    const hasConsumerAudio = !!this.consumerAudio;
    if (hasConsumerVideo && hasConsumerAudio) {
      promises.push(
        this.consumerVideo?.getStats(),
        this.consumerAudio?.getStats()
      );
    } else if (hasConsumerVideo) {
      promises.push(this.consumerVideo?.getStats());
    } else if (hasConsumerAudio) {
      promises.push(this.consumerAudio?.getStats());
    } else {
      this.statsSummary = summary;
      return;
    }
    await Promise.all(promises)
      .then((stats) => {
        let videoStats;
        let audioStats;
        if (stats.length == 0) {
          return;
        } else if (stats.length == 1) {
          if (hasConsumerVideo) {
            videoStats = stats[0];
          } else if (hasConsumerAudio) {
            audioStats = stats[0];
          }
        } else {
          videoStats = stats[0];
          audioStats = stats[1];
        }

        if (videoStats) {
          videoStats.forEach((report) => {
            switch (report.type as RTCStatsType) {
              case 'inbound-rtp':
                summary.video = {
                  ...summary.video,
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
            ...summary.video,
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
            switch (report.type as RTCStatsType) {
              case 'inbound-rtp':
                summary.audio = {
                  ...summary.audio,
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
            ...summary.audio,
            packetsReceived: 0,
            packetsLost: 0,
            bytesReceived: 0,
            nackCountInbound: 0,
            jitter: 0,
            timestamp: defaultTimestamp,
          };
        }
      })
      .catch((err) => {
        console.error(err);
      });
    this.statsSummary = summary;
    return;
  }
}
