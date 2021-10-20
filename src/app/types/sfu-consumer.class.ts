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
  private _consumerAudioStream: MediaStream | undefined;
  private _consumerVideoStream: MediaStream | undefined;
  private _consumerScreenStream: MediaStream | undefined;
  private _videoReady = false;

  get videoReady(): boolean {
    return this._videoReady;
  }

  set videoReady(value: boolean) {
    this._videoReady = value;
  }

  get consumerAudioStream(): MediaStream | undefined {
    return this._consumerAudioStream;
  }
  set consumerAudioStream(value: MediaStream | undefined) {
    this._consumerAudioStream = value;
  }
  get consumerVideoStream(): MediaStream | undefined {
    return this._consumerVideoStream;
  }
  set consumerVideoStream(value: MediaStream | undefined) {
    this._consumerVideoStream = value;
  }
  get consumerScreenStream(): MediaStream | undefined {
    return this._consumerScreenStream;
  }
  set consumerScreenStream(value: MediaStream | undefined) {
    this._consumerScreenStream = value;
  }
}
