import {Injectable} from "@angular/core";
import {Socket} from "ngx-socket-io";
import {Observable, of, fromEvent} from "rxjs";

import {NGXLogger} from "ngx-logger";


@Injectable({
  providedIn: 'root'
})
export class WssService {

  constructor(private logger:NGXLogger, private socket: Socket ) {

  }

  onMediaVideoOrientationChange():Observable<any>{

    return this.socket.fromEvent('mediaVideoOrientationChange');
  }

  onMediaProduce():Observable<any>{
    return this.socket.fromEvent('mediaProduce');
  }
  onMediaReproduce():Observable<any>{
    return this.socket.fromEvent('mediaReproduce');
  }

  onMediaProducerPause(): Observable<any>{
    return this.socket.fromEvent('mediaProducerPause');
  }

  onMediaProducerResume(): Observable<any>{
    return this.socket.fromEvent('mediaProducerResume');
  }

  onMediaActiveSpeaker(): Observable<any>{
    return this.socket.fromEvent('mediaActiveSpeaker');
  }

  onMediaReconfigure():Observable<any>{
    return this.socket.fromEvent('mediaReconfigure');
  }

  onConnection(): Observable<unknown>{
    return this.socket.fromEvent('connect');
  }

  async requestMediaConfigure():Promise<any>{
      return this.socket.emit('mediaconfigure')
  }

  async requestMedia(payload: Record<string, any>):Promise<any>{
    // let result = await this.socket.emit('media',payload);
    // console.log("requestmedia",payload)
    return this.socket.emit('media', payload , (response: any) => {
      console.log('MEDIA RESPONSE', response)
    })

  }
  onRequestMedia():Observable<any>{
    return this.socket.fromEvent('media');
  }


}
