import * as mediasoupClient from 'mediasoup-client';
import { IDevice } from 'mediasoup-client/Device';
import { ITransport } from 'mediasoup-client/Transport';
import { IProducer } from 'mediasoup-client/Producer';
import { IConsumer } from 'mediasoup-client/Consumer';
import {WssService} from "./wss.service";
import {Device} from "mediasoup-client";
// import {RtpCapabilities} from "mediasoup-client/lib/RtpParameters";
// import { Producer, RtpParameters } from "mediasoup-client/lib/types";
import {ConsumableData, RouterRTPCapabilities, WssEventMediaResponse} from "../types/types";
import {TKind, TPeer, TState} from "../../../mediasoup-client/interfaces";
import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable} from "rxjs";


@Injectable()
export class MediasoupService {
  private mediasoupDevice: IDevice;

  private producerVideo!: IProducer;
  private producerAudio!: IProducer;

  private producerTransport!: ITransport;
  private consumerTransport!: ITransport;

   producerVideoStream!: MediaStream;
   producerAudioStream!: MediaStream;

   consumersVideo: Map<string, IConsumer> = new Map();
   consumersAudio: Map<string, IConsumer> = new Map();

   consumersVideoStream: Map<string, MediaStream> = new Map();
   consumersAudioStream: Map<string, MediaStream> = new Map();

   private isConnectionReady = new BehaviorSubject<boolean>(false);
  private skipConsume = false;
  constructor(private wssService: WssService){
    this.mediasoupDevice = new mediasoupClient.Device({});
    this.wssService.onConnection().subscribe(()=>{
      this.isConnectionReady.next(true);
      console.warn('SOCKET CONNECTED TO MEDIASOUP WSS SERVER');
      /**
       * When a remote peer starts its streaming
       */
      this.wssService.onMediaProduce().subscribe(async(data: { user_id: string; kind: TKind })=>{
        try {
          switch (data.kind) {
            case 'video':
              await this.consumerVideoStart(data.user_id);
              break;
            case 'audio':
              await this.consumerAudioStart(data.user_id);
              break;
          }
        } catch (error) {
          console.error(error.message, error.stack);
        }
      })

      /**
       * When any peer turns the camera
       */
      this.wssService.onMediaVideoOrientationChange().subscribe( async (data: any) => {
        console.log('mediaVideoOrientationChange', data);
      })

      /**
       * When the local peer needs to reconnect the stream
       */
      this.wssService.onMediaReproduce().subscribe( async (data: any) => {
        console.log("onMediaReproduce",data)
        try {
          switch (data.kind) {
            case 'audio':
              this.producerAudioStart();
              break;
            case 'video':
              this.producerVideoStart();
              break;
          }
        } catch (error) {
          console.error(error.message, error.stack);
        }
      })

      /**
       * When a remote peer pauses its stream
       */
      this.wssService.onMediaProducerPause().subscribe( async (data: any) => {
        console.log('mediaProducerPause', data);
      })

      /**
       * When a remote peer unpauses its stream
       */
      this.wssService.onMediaProducerResume().subscribe( async (data: any) => {
        console.log('mediaProducerResume', data);
      })

      /**
       * When someone is talking.
       */
      this.wssService.onMediaActiveSpeaker().subscribe( async (data: any) => {
        // console.log('mediaActiveSpeaker', data);
      })

      /**
       *  When the room was replaced by a worker and you want to reconnect mediasoup
       */
      this.wssService.onMediaReconfigure().subscribe( async (data: any) => {
        console.log('mediaReconfigure', data);
        try {
          await this.load(true);
          await this.producerAudioStart();
          await this.producerVideoStart();
        } catch (error) {
          console.error(error.message, error.stack);
        }
      })
    })
    this.wssService.onRequestMedia().subscribe((data)=>{
      this.handleMessage(data).then(()=>{
        console.log('Message handled', data.action);
      }).catch((err)=>{
        console.error('ERROR HANDLE MESSAGE', err.message , data)
      });
    })
  }

  public connectionReady():Observable<boolean>{
    return this.isConnectionReady.asObservable();
  }

  async handleMessage(data: {
    action: string,
    data: any,
    user_id?: string,
    type?: string,
    kind?: string
  }): Promise<void>{
    console.log(`handling ${data.action}`)
    switch (data.action) {
      case 'getRouterRtpCapabilities':
        console.log(data);
        if (!this.mediasoupDevice.loaded) {
          if (data)
            await this.mediasoupDevice.load(data.data);
        }
        await this.createProducerTransport();
        await this.createConsumerTransport();
        if (!this.skipConsume) {
          const audioProducerIds: string[] = await this.wssService.requestMedia({action: 'getAudioProducerIds'}) as string[];
          const videoProducerIds: string[] = await this.wssService.requestMedia({action: 'getVideoProducerIds'}) as string[];
        }
        this.producerVideoStart();
        this.producerAudioStart();
        break;
      case 'createWebRtcTransport':
        if(data.type === 'producer'){
          this.producerTransport = this.mediasoupDevice.createSendTransport(data.data.params);
          // 'connect' | 'produce' | 'producedata' | 'connectionstatechange'
          this.producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            await this.wssService.requestMedia( { action: 'connectWebRtcTransport', data: { dtlsParameters, type: 'producer' } })
              .then(callback)
              .catch(errback);
          });
          this.producerTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
            await this.wssService.requestMedia( {
              action: 'produce',
              data: {
                producerTransportId: this.producerTransport.id,
                kind,
                rtpParameters,
              },
            }).then(({ id }) => callback({ id }))
              .catch(errback);
          });
          this.producerTransport.on('connectionstatechange', async (state: TState) => {
            switch (state) {
              case 'connecting': break;
              case 'connected': break;
              case 'failed':
                this.producerTransport.close();
                break;
              default: break;
            }
          });
        }
        else if(data.type === 'consumer'){
          this.consumerTransport = this.mediasoupDevice.createRecvTransport(data.data.params);

          // 'connect' | 'connectionstatechange'
          this.consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            await this.wssService.requestMedia( { action: 'connectWebRtcTransport', data: { dtlsParameters, type: 'consumer' } })
              .then(callback)
              .catch(errback);
          });

          this.consumerTransport.on('connectionstatechange', async (state: TState) => {
            switch (state) {
              case 'connecting': break;
              case 'connected': break;
              case 'failed':
                this.consumerTransport.close();
                break;
              default: break;
            }
          });
        }else{
          console.log('createWebRtcTransport',data.data);
        }


        break;
      case 'connectWebRtcTransport':
        console.log('connectWebRtcTransport',data.data);
        break;
      case 'produce':
        console.log('produce',data.data);
        break;
      case 'consume':
        console.log('MESSAGE HANDLED consume',data)
        const consumer = await this.consumerTransport.consume(data.data);
        // 'trackended' | 'transportclose'
        consumer.on('transportclose', async () => {
          if(data.kind ==='video'){
              this.consumersVideoStream.delete(data.user_id!);
              this.consumersVideo.delete(data.user_id!);
          }else if(data.kind === 'audio'){
            this.consumersAudioStream.delete(data.user_id!);
            this.consumersAudio.delete(data.user_id!);
          }
        });

        if(data.kind ==='video'){
          this.consumersVideo.set(data.user_id!, consumer);

          const stream = new MediaStream();

          stream.addTrack(consumer.track);

          this.consumersVideoStream.set(data.user_id!, stream);
        }else if(data.kind === 'audio'){
          this.consumersAudio.set(data.user_id!, consumer);
          const stream = new MediaStream();
          stream.addTrack(consumer.track);
          this.consumersAudioStream.set(data.user_id!, stream);
        }

        break;
      case 'restartIce':
        switch (data.type) {
          case 'producer':
            await this.producerTransport.restartIce({ iceParameters: data.data });
            break;
          case 'consumer':
            await this.consumerTransport.restartIce({ iceParameters: data.data });
            break;
        }
        break;
      case 'requestConsumerKeyFrame':
        console.log('requestConsumerKeyFrame',data.data)
        break;
      case 'getTransportStats':
        console.log('getTransportStats',data.data)
        break;
      case 'getProducerStats':
        console.log('getProducerStats',data.data)
        break;
      case 'getConsumerStats':
        console.log('getConsumerStats',data.data)
        break;
      case 'getAudioProducerIds':
        data.data.forEach(async (id: string) => {
          await this.consumerAudioStart(id);
        });
        break;
      case 'getVideoProducerIds':
        data.data.forEach(async (id: string) => {
          await this.consumerVideoStart(id);
        });
        break;
      case 'producerClose':
        console.log('producerClose',data.data)
        break;
      case 'producerPause':
        console.log('producerPause',data.data)
        break;
      case 'producerResume':
        console.log('producerResume',data.data)

        break;
      case 'allProducerClose':
        console.log('allProducerClose',data.data)
        break;
      case 'allProducerPause':
        console.log('allProducerPause',data.data)
        break;
      case 'allProducerResume':
        console.log('allProducerResume',data.data)
        break;
    }
  }


  public initCommunication(){
    this.load();
  }


  /**
   * Change the mediasoup worker in the room
   */
   async reConfigureMedia() {
    try {
      await this.wssService.requestMediaConfigure();
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Get message
   */



  /**
   * Connect to mediasoup
   * @param skipConsume do not accept streams from already connected
   */
   async load(skipConsume: boolean = false): Promise<void> {
     this.skipConsume = skipConsume;
    try {
      await this.wssService.requestMedia({ action: 'getRouterRtpCapabilities' });
      // const data: RouterRTPCapabilities
      //   = await this.wssService.requestMedia({ action: 'getRouterRtpCapabilities' });
      // if (data.action === 'getRouterRtpCapabilities') {
      //   if (!this.mediasoupDevice.loaded) {
      //
      //     if (data)
      //       await this.mediasoupDevice.load(data);
      //   }
      //
      //   await this.createProducerTransport();
      //   await this.createConsumerTransport();
      //
      //   if (!skipConsume) {
      //     const audioProducerIds: string[] = await this.wssService.requestMedia({action: 'getAudioProducerIds'}) as string[];
      //
      //     audioProducerIds.forEach(async (id) => {
      //       await this.consumerAudioStart(id);
      //     });
      //
      //     const videoProducerIds: string[] = await this.wssService.requestMedia({action: 'getVideoProducerIds'}) as string[];
      //
      //     videoProducerIds.forEach(async (id) => {
      //       await this.consumerVideoStart(id);
      //     });
      //   }
      // }
      // const t = this.wssService.onMedia().subscribe(async(data)=>{
      //
      // })
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Disconnect from mediasoup
   */
   async close(): Promise<void> {
    try {
      await this.producerVideoClose();
      await this.producerAudioClose();
      if (this.producerTransport && !this.producerTransport.closed) {
        this.producerTransport.close();
      }

      if (this.consumerTransport && !this.consumerTransport.closed) {
        this.consumerTransport.close();
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Create a transport to transmit your stream
   */
  private async createProducerTransport(): Promise<void> {
    try {
      const data: {
        type: TPeer, params: { id: string; iceParameters: RTCIceParameters; iceCandidates: RTCIceCandidate[]; dtlsParameters: object }
      } = await this.wssService.requestMedia({ action: 'createWebRtcTransport', data: { type: 'producer' } });

      // this.producerTransport = this.mediasoupDevice.createSendTransport(data.params);
      //
      // // 'connect' | 'produce' | 'producedata' | 'connectionstatechange'
      // this.producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      //   await this.wssService.requestMedia( { action: 'connectWebRtcTransport', data: { dtlsParameters, type: 'producer' } })
      //     .then(callback)
      //     .catch(errback);
      // });
      //
      // this.producerTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
      //   await this.wssService.requestMedia( {
      //     action: 'produce',
      //     data: {
      //       producerTransportId: this.producerTransport.id,
      //       kind,
      //       rtpParameters,
      //     },
      //   }).then(({ id }) => callback({ id }))
      //     .catch(errback);
      // });
      //
      // this.producerTransport.on('connectionstatechange', async (state: TState) => {
      //   switch (state) {
      //     case 'connecting': break;
      //     case 'connected': break;
      //     case 'failed':
      //       this.producerTransport.close();
      //       break;
      //     default: break;
      //   }
      // });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Create transport for receiving streams from other users
   */
  private async createConsumerTransport(): Promise<void> {
    try {
      const data: {
        type: TPeer, params: { id: string; iceParameters: RTCIceParameters; iceCandidates: RTCIceCandidate[]; dtlsParameters: object }
      } = await this.wssService.requestMedia({ action: 'createWebRtcTransport', data: { type: 'consumer'} });

      // this.consumerTransport = this.mediasoupDevice.createRecvTransport(data.params);
      //
      // // 'connect' | 'connectionstatechange'
      // this.consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      //   await this.wssService.requestMedia( { action: 'connectWebRtcTransport', data: { dtlsParameters, type: 'consumer' } })
      //     .then(callback)
      //     .catch(errback);
      // });
      //
      // this.consumerTransport.on('connectionstatechange', async (state: TState) => {
      //   switch (state) {
      //     case 'connecting': break;
      //     case 'connected': break;
      //     case 'failed':
      //       this.consumerTransport.close();
      //       break;
      //     default: break;
      //   }
      // });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Start sending your video stream
   */
   async producerVideoStart(): Promise<void> {
    try {
      if (this.mediasoupDevice.canProduce('video')) {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 200, height: 150 } });
        const videoTrack = videoStream.getVideoTracks()[0];

        if (videoTrack) {
          if (this.producerTransport && !this.producerTransport.closed) {
            this.producerVideo = await this.producerTransport.produce({ track: videoTrack });
          }

          // 'trackended' | 'transportclose'
          // this.producerVideo.on('transportclose', () => {});
        }
        this.producerVideoStream = videoStream;
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Pause your video stream
   */
   async producerVideoPause(): Promise<void> {
    try {
      if (this.producerVideo && !this.producerVideo.paused) {
        this.producerVideo.pause();
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Unpause the transfer of your video stream
   */
   async producerVideoResume(): Promise<void> {
    try {
      if (this.producerVideo && this.producerVideo.paused && !this.producerVideo.closed) {
        this.producerVideo.resume();
      } else if (this.producerVideo && this.producerVideo.closed) {
        await this.producerVideoStart();
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Stop the transmission of your video stream (for re-transmission, you need to recreate the producer)
   */
   async producerVideoClose(): Promise<void> {
    try {
      if (this.producerVideo && !this.producerVideo.closed) {
        this.producerVideo.close();
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Start broadcasting your audio stream
   */
   async producerAudioStart(): Promise<void> {
    try {
      if (this.mediasoupDevice.canProduce('audio')) {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = audioStream.getAudioTracks()[0];

        if (audioTrack) {
          if (this.producerTransport && !this.producerTransport.closed) {
            this.producerAudio = await this.producerTransport.produce({ track: audioTrack });
          }

          // 'trackended' | 'transportclose'
          // this.producerAudio.on('transportclose', () => {});
        }

        this.producerAudioStream = audioStream;
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Pause your audio stream
   */
   async producerAudioPause(): Promise<void> {
    try {
      if (this.producerAudio && !this.producerAudio.paused) {
        this.producerAudio.pause();
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Unpause the transmission of your audio stream
   */
   async producerAudioResume(): Promise<void> {
    try {
      if (this.producerAudio && this.producerAudio.paused && !this.producerAudio.closed) {
        this.producerAudio.resume();
      } else if (this.producerAudio && this.producerAudio.closed) {
        await this.producerAudioStart();
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Stop the transmission of your audio stream (for re-transmission, you need to recreate the producer)
   */
   async producerAudioClose(): Promise<void> {
    try {
      if (this.producerAudio && !this.producerAudio.closed) {
        this.producerAudio.close();
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Pauses the user stream
   */
   async targetProducerPause(data: { user_id: string, kind: TKind }) {
    try {
      await this.wssService.requestMedia( { action: 'producerPause', data });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Unpause user stream
   * @param data user_id and stream type
   */
   async targetProducerResume(data: { user_id: string, kind: TKind }) {
    try {
      await this.wssService.requestMedia( { action: 'producerResume', data });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Stop the user's stream (to resume the broadcast, this user will have to recreate the producer)
   * @param data user_id and stream type
   */
   async targetProducerClose(data: { user_id: string, kind: TKind }) {
    try {
      await this.wssService.requestMedia( { action: 'producerClose', data });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Pause the stream of all users
   * @param data stream type
   */
   async allProducerPause(data: { kind: TKind }) {
    try {
      await this.wssService.requestMedia( { action: 'allProducerPause', data });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Unpause the stream of all users
   * @param data stream type
   */
   async allProducerResume(data: { kind: TKind }) {
    try {
      await this.wssService.requestMedia( { action: 'allProducerResume', data });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Stop the stream of all users (in order to resume the transmission, these users will have to recreate the producer)
   * @param data stream type
   */
   async allProducerClose(data: { kind: TKind }) {
    try {
      await this.wssService.requestMedia( { action: 'allProducerClose', data });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Accept video stream from another user
   * @param user_id user_id from the user who transmits the video stream
   */
  private async consumerVideoStart(user_id: string): Promise<void> {
    try {
      const { rtpCapabilities } = this.mediasoupDevice;

      const consumeData: {
        id: string;
        producerId: string;
        kind: TKind;
        rtpParameters: RTCRtpParameters;
      } = await this.wssService.requestMedia({
        action: 'consume',
        data: { rtpCapabilities, user_id, kind: 'video' },
      });

      // const consumer = await this.consumerTransport.consume(consumeData);
      //
      // // 'trackended' | 'transportclose'
      // consumer.on('transportclose', () => {
      //   this.consumersVideoStream.delete(user_id);
      //   this.consumersVideo.delete(user_id);
      // });
      //
      // this.consumersVideo.set(user_id, consumer);
      //
      // const stream = new MediaStream();
      //
      // stream.addTrack(consumer.track);
      //
      // this.consumersVideoStream.set(user_id, stream);
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Accept audio stream from another user
   * @param user_id user_id from the user who transmits the audio
   */
  private async consumerAudioStart(user_id: string): Promise<void> {
    try {
      const { rtpCapabilities } = this.mediasoupDevice;

      const consumeData: ConsumableData = await this.wssService.requestMedia({
        action: 'consume',
        data: { rtpCapabilities, user_id, kind: 'audio' },
      });

      // const consumer = await this.consumerTransport.consume(consumeData);
      //
      // // 'trackended' | 'transportclose'
      // consumer.on('transportclose', async () => {
      //   this.consumersAudioStream.delete(user_id);
      //   this.consumersAudio.delete(user_id);
      // });
      //
      // this.consumersAudio.set(user_id, consumer);
      //
      // const stream = new MediaStream();
      //
      // stream.addTrack(consumer.track);
      //
      // this.consumersAudioStream.set(user_id, stream);
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Restart connection
   * @param type type of transport
   */
   async restartIce(type: TPeer): Promise<void> {
    try {
      const iceParameters: RTCIceParameters = await this.wssService.requestMedia({
        action: 'restartIce',
        data: {
          type,
        },
      });
      //
      // switch (type) {
      //   case 'producer':
      //     await this.producerTransport.restartIce({ iceParameters });
      //     break;
      //   case 'consumer':
      //     await this.consumerTransport.restartIce({ iceParameters });
      //     break;
      // }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Get transport stats
   * @param type type of transport
   */
   async getTransportStats(type: TPeer): Promise<WssEventMediaResponse | void> {
    try {
      return await this.wssService.requestMedia( {
        action: 'getTransportStats',
        data: {
          type,
        },
      });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Get information about the stream that the user is transmitting
   * @param kind stream type
   * @param user_id unique user identifier
   */
   async getProducerStats(kind: TKind, user_id: string): Promise<WssEventMediaResponse | void> {
    try {
      return await this.wssService.requestMedia( {
        action: 'getProducerStats',
        data: {
          kind,
          user_id,
        },
      });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Get info about the stream that receives current_user from another user
   * @param kind stream type
   * @param user_id unique user identifier
   */
   async getConsumerStats(kind: TKind, user_id: string): Promise<WssEventMediaResponse| void> {
    try {
      return await this.wssService.requestMedia( {
        action: 'getConsumerStats',
        data: {
          kind,
          user_id,
        },
      });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Get a keyframe from the user whose stream is being received.
   * Video only
   * @param user_id unique user identifier
   */
   async requestConsumerKeyFrame(user_id: string): Promise<WssEventMediaResponse | void> {
    try {
      return await this.wssService.requestMedia( {
        action: 'requestConsumerKeyFrame',
        data: {
          user_id,
        },
      });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }
}
