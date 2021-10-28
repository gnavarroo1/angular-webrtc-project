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
      const stats = await this.consumerVideo.getStats();
      stats.forEach((report) => {
        switch (report.type as RTCStatsType) {
          case 'inbound-rtp':
            // console.warn(report.type, report);
            summary.video = {
              ...summary[report.mediaType],
              bytesReceived: report.bytesReceived,
              framesDecoded: report.framesDecoded,
              frameHeight: report.frameHeight,
              frameWidth: report.frameWidth,
              jitter: report.jitter,
              timestamp: report.timestamp,
            };
            break;
          case 'track':
            // console.warn(report.type, report);
            break;
        }
      });
    }
    if (this.consumerAudio) {
      const stats = await this.consumerAudio.getStats();
      stats.forEach((report) => {
        switch (report.type as RTCStatsType) {
          case 'inbound-rtp':
            summary.video = {
              ...summary[report.mediaType],
              bytesReceived: report.bytesReceived,
              jitter: report.jitter,
              timestamp: report.timestamp,
            };
            break;
          case 'track':
            // console.warn(report.type, report);
            break;
        }
      });
    }
    if (Object.keys(this.statsSummary).length > 0) {
      if (this.statsSummary.video && summary.video) {
        //dif time in seconds
        const diff =
          (summary.video.timestamp - this.statsSummary.video.timestamp) / 1000;
        let diffBytesReceived = 0;
        let framesDecodedPerSecond = 0;
        if (
          this.statsSummary.video.bytesReceived &&
          summary.video.bytesReceived
        ) {
          diffBytesReceived =
            summary.video.bytesReceived - this.statsSummary.video.bytesReceived;
        }
        if (this.statsSummary.video.framesDecoded) {
          framesDecodedPerSecond =
            (summary.video.framesDecoded -
              this.statsSummary.video.framesDecoded) /
            diff;
        }
        summary.video['bitrateVideoReceived'] = (8 * diffBytesReceived) / diff;
        summary.video['framesDecodedPerSecond'] = framesDecodedPerSecond;
      }
      if (this.statsSummary.audio && summary.audio) {
        //dif time in seconds
        const diff =
          (summary.audio.timestamp - this.statsSummary.audio.timestamp) / 1000;
        let diffBytesReceived = 0;
        if (
          this.statsSummary.audio.bytesReceived &&
          summary.audio.bytesReceived
        ) {
          diffBytesReceived =
            summary.audio.bytesReceived - this.statsSummary.audio.bytesReceived;
        }
        summary.video['bitrateAudioReceived'] = (8 * diffBytesReceived) / diff;
      }
    }
    this.statsSummary = summary;
    return;
  }
}
