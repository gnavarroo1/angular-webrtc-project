import {Injectable} from "@angular/core";


export class ConsumerP2P{

  get id(): string {
    return this._id;
  }

  get rtcPeerConnection(): RTCPeerConnection {
    return this._rtcPeerConnection;
  }
  get closed(): boolean{
    return this._closed;
  }

  get track(): MediaStreamTrack {
    return this._track;
  }
  set track(value: MediaStreamTrack) {
    this._track = value;
  }

  get paused(): boolean {
    return this._paused;
  }

  set paused(value: boolean) {
    this._paused = value;
  }
  // Closed flag.
  private _closed = false;

  private _id: string;
  private _rtcPeerConnection: RTCPeerConnection;
  private _paused!:boolean;
  private _track!: MediaStreamTrack;
  constructor({id, rtcPeerConnection} :{ id: string, rtcPeerConnection: RTCPeerConnection }) {
    this._id = id;
    this._rtcPeerConnection= rtcPeerConnection;
  }

  pause():void{
    if(this._closed){
      return;
    }
    this._paused = true;
    this._track.enabled = false;
  }
  resume():void{
    if(this._closed){
      return;
    }
    this._paused = false;
    this._track.enabled = true;
  }

  async getStats(): Promise<RTCStatsReport>{
    return await this._rtcPeerConnection.getStats();
  }


}



@Injectable()
export class P2pWebrtcService{

  private _producerAudioStream:MediaStream;
  private _producerVideoStream:MediaStream;

  private _consumersVideo:




}
