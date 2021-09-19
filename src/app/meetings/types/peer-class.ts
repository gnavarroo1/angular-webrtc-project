import { environment } from '../../../environments/environment';
import { IOfferPayload } from './defines';

export class Peer {
  // get stream(): MediaStream {
  //   return this._stream;
  // }
  // set stream(stream) {
  //   this._stream = stream;
  // }

  get isVideoEnabled(): boolean {
    return this._isVideoEnabled;
  }

  set isVideoEnabled(value: boolean) {
    this._isVideoEnabled = value;
  }

  get isAudioEnabled(): boolean {
    return this._isAudioEnabled;
  }

  set isAudioEnabled(value: boolean) {
    this._isAudioEnabled = value;
  }

  private _rtcPeerConnection: RTCPeerConnection = new RTCPeerConnection(
    environment.rtcConfiguration
  );
  private _isVideoEnabled = true;
  private _isAudioEnabled = true;

  private _remoteStream!: MediaStream;

  constructor(private readonly signalingServer: any) {}

  /**
   *
   * @param stream Local stream
   */
  addTracks(stream: MediaStream) {
    stream.getTracks().forEach((track) => {
      this._rtcPeerConnection.addTrack(track, stream);
    });
  }

  /**
   *
   * @param id Current peer id
   * @param meetingId Current meeting session id
   * @param callback Emits offer to the signaling channel
   */
  async offer(
    id: string,
    meetingId: string,
    callback: (payload: IOfferPayload) => void
  ) {
    this._rtcPeerConnection
      .createOffer()
      .then((offer) => {
        this._rtcPeerConnection
          .setLocalDescription(offer)
          .then(() => {
            callback({
              id: id,
              meetingId: meetingId,
              sdp: offer,
            });
          })
          .catch((err) => {
            console.error('setLocalDescriptionError', err.message);
          });
      })
      .catch((err) => {
        console.error('createOfferError', err.message);
      });
  }
}
