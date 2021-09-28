import { Injectable } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import {
  IMemberIdentifier,
  SocketQueryParams,
  TConnectWebRtcTransportRequest,
  TConsumeRequest,
  TCreateWebRtcTransportRequest,
  TCreateWebRtcTransportResponse,
  TMediaKindRequest,
  TProduceRequest,
  TTargetProducerRequest,
} from '../../types/defines';
import { Socket } from 'ngx-socket-io';
import { environment } from '../../../../environments/environment';
import { RtpCapabilities } from 'mediasoup-client/lib/RtpParameters';

import { ConsumerOptions } from 'mediasoup-client/lib/Consumer';

@Injectable({
  providedIn: 'root',
})
export class MediasoupWssService {
  private _socket!: Socket;
  get socket(): Socket {
    return this._socket;
  }
  public setSocket(socketQueryParams: SocketQueryParams): void {
    this._socket = new Socket({
      url: environment.mediasoupServer.wssUrl,
      options: {
        query: {
          meetingId: socketQueryParams.meetingId,
          userId: socketQueryParams.userId,
        },
      },
    });
  }
  constructor() {}

  async joinRoom(payload: any): Promise<void> {
    await this.socket.emit('joinRoom', payload);
  }

  async messageWithCallback<TRequest, TResponse>(
    event: string,
    payload?: TRequest
  ): Promise<TResponse> {
    return new Promise<TResponse>((resolve, reject) => {
      try {
        //console.warn(`Emit event ${event}:`);
        this._socket.emit(event, payload, (response: TResponse) => {
          resolve(response);
        });
      } catch (e) {
        console.log(`error emitting event: ${event}, error: ${e.message}`);
        reject(e.message);
      }
    });
  }

  async getRouterRtpCapabilities(): Promise<RtpCapabilities> {
    return new Promise<RtpCapabilities>((resolve, reject) => {
      this.messageWithCallback<void, RtpCapabilities>(
        'getRouterRtpCapabilities'
      )
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
  async createWebRtcTransport(
    createWebRtcTransportRequest: TCreateWebRtcTransportRequest
  ): Promise<TCreateWebRtcTransportResponse> {
    return new Promise<TCreateWebRtcTransportResponse>((resolve, reject) => {
      this.messageWithCallback<
        TCreateWebRtcTransportRequest,
        TCreateWebRtcTransportResponse
      >('createWebRtcTransport', createWebRtcTransportRequest)
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
  async connectWebRtcTransport(
    connectWebRtcTransportRequest: TConnectWebRtcTransportRequest
  ): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.messageWithCallback<TConnectWebRtcTransportRequest, any>(
        'connectWebRtcTransport',
        connectWebRtcTransportRequest
      )
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  async produce(produceRequest: TProduceRequest): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.messageWithCallback<TProduceRequest, any>('produce', produceRequest)
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
  async producerPause(
    targetProducerRequest: TTargetProducerRequest
  ): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.messageWithCallback<TTargetProducerRequest, any>(
        'producerPause',
        targetProducerRequest
      )
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
  async producerResume(
    targetProducerRequest: TTargetProducerRequest
  ): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.messageWithCallback<TTargetProducerRequest, any>(
        'producerResume',
        targetProducerRequest
      )
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
  async producerClose(
    targetProducerRequest: TTargetProducerRequest
  ): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.messageWithCallback<TTargetProducerRequest, any>(
        'producerClose',
        targetProducerRequest
      )
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  async allProducerPause(mediaKindRequest: TMediaKindRequest): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.messageWithCallback<TMediaKindRequest, any>(
        'allProducerPause',
        mediaKindRequest
      )
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
  async allProducerResume(mediaKindRequest: TMediaKindRequest): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.messageWithCallback<TMediaKindRequest, any>(
        'allProducerResume',
        mediaKindRequest
      )
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
  async allProducerClose(mediaKindRequest: TMediaKindRequest): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.messageWithCallback<TMediaKindRequest, any>(
        'allProducerClose',
        mediaKindRequest
      )
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  async consume(consumeRequest: TConsumeRequest): Promise<ConsumerOptions> {
    return new Promise<any>((resolve, reject) => {
      this.messageWithCallback<TConsumeRequest, ConsumerOptions>(
        'consume',
        consumeRequest
      )
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  async requestMedia(payload: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      try {
        //console.warn(`Emit event ${payload.action}:`);
        this._socket.emit('media', payload, (response: any) => {
          console.log(
            `success emitting event: media, ACK from server: ${payload.action}`
          );
          //console.warn(`Response from ${payload.action}:`, response);
          resolve(response);
        });
      } catch (e) {
        console.log(`error emitting event: ${event}, error: ${e.message}`);
        reject(e.message);
      }
    });
  }

  //EVENTS
  onMediaClientConnected(): Observable<any> {
    return this.socket.fromEvent('mediaClientConnected');
  }
  onMediaClientDisconnect(): Observable<IMemberIdentifier> {
    return this.socket.fromEvent('mediaClientDisconnect');
  }
  onMediaVideoOrientationChange(): Observable<any> {
    return this.socket.fromEvent('mediaVideoOrientationChange');
  }
  onMediaProduce(): Observable<any> {
    return this.socket.fromEvent('mediaProduce');
  }
  onMediaReproduce(): Observable<any> {
    return this.socket.fromEvent('mediaReproduce');
  }
  onMediaProducerPause(): Observable<any> {
    return this.socket.fromEvent('mediaProducerPause');
  }
  onMediaProducerResume(): Observable<any> {
    return this.socket.fromEvent('mediaProducerResume');
  }
  onMediaActiveSpeaker(): Observable<any> {
    return this.socket.fromEvent('mediaActiveSpeaker');
  }
  onMediaReconfigure(): Observable<any> {
    return this.socket.fromEvent('mediaReconfigure');
  }
  onConnection(): Observable<any> {
    return this.socket.fromEvent('connect');
  }
  onRequestMedia(): Observable<any> {
    return this.socket.fromEvent('media');
  }
}
