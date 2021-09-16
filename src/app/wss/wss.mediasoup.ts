import * as mediasoupClient from 'mediasoup-client';
import { WssService } from './wss.service';

import { TKind, TPeer, TState } from '../../../mediasoup-client/interfaces';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Transport } from 'mediasoup-client/lib/Transport';
import { Producer } from 'mediasoup-client/lib/Producer';
import { Consumer } from 'mediasoup-client/lib/Consumer';

import { IMemberIdentifier, WssEventMediaResponse } from '../../types/helper';
import { MemberType } from '../../types/enums';

// interface ITransport extends Transport {
//   id: string;
// }

@Injectable()
export class MediasoupService {
  get memberType(): MemberType {
    return this._memberType;
  }
  private mediasoupDevice;

  private producerVideo!: Producer;
  private producerVideoStream$ = new BehaviorSubject<MediaStream>(
    new MediaStream()
  );
  private producerAudio!: Producer;

  private producerTransport!: Transport;
  private consumerTransport!: Transport;

  public producerVideoStream!: MediaStream;
  public producerAudioStream!: MediaStream;

  public consumersVideo: Map<string, Consumer> = new Map<string, Consumer>();
  public consumersAudio: Map<string, Consumer> = new Map<string, Consumer>();

  public consumersVideoStream: Map<string, MediaStream> = new Map<
    string,
    MediaStream
  >();
  public consumersAudioStream: Map<string, MediaStream> = new Map<
    string,
    MediaStream
  >();
  private consumersStream: Map<string, MediaStream> = new Map<
    string,
    MediaStream
  >();

  private consumers: BehaviorSubject<Map<string, IMemberIdentifier>> =
    new BehaviorSubject<Map<string, IMemberIdentifier>>(
      new Map<string, IMemberIdentifier>()
    );

  private isConnectionReady = new BehaviorSubject<boolean>(false);
  private isAudioEnabled = new BehaviorSubject<boolean>(false);
  private isVideoEnabled = new BehaviorSubject<boolean>(false);
  private skipConsume = false;
  private skipProduce = false;
  private _memberType = MemberType.BOTH;
  constructor(private wssService: WssService) {
    this.mediasoupDevice = new mediasoupClient.Device({});
    this.wssService.onConnection().subscribe(() => {
      this.isConnectionReady.next(true);
      this.wssService.onMediaClientConnected().subscribe(async (data) => {
        // console.warn('consumer connected', data);
        if (data.id !== environment.user_id) {
          if (!this.consumers.getValue().has(data.id)) {
            console.warn(
              `ENVIO MI INFO A ${data.id}, recibi que era ${data.kind} y yo soy ${this._memberType}`
            );
            await this.wssService.requestHandshake({
              target: data.id,
              kind: this._memberType,
            });

            if (data.kind !== MemberType.CONSUMER)
              this.consumers.next(this.consumers.getValue().set(data.id, data));
          }
        }
      });
      this.wssService.onRequestMedia().subscribe((data) => {
        this.handleMessage(data)
          .then(() => {
            // console.warn('Message handled', data.action);
          })
          .catch((err) => {
            console.error('ERROR HANDLE MESSAGE', err.message, data);
          });
      });
      /**
       * When a remote peer enters the meeting
       */

      this.wssService.onMediaClientDisconnect().subscribe(async (data) => {
        const consumers = this.consumers.getValue();
        consumers.delete(data.id);
        this.consumers.next(consumers);
        this.consumersAudioStream.delete(data.id);
        this.consumersVideoStream.delete(data.id);
        this.consumersStream.delete(data.id);
        this.consumersAudio.delete(data.id);
        this.consumersVideo.delete(data.id);
      });

      this.wssService
        .onMediaProduce()
        .subscribe(async (data: { user_id: string; kind: TKind }) => {
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
        });

      /**
       * When any peer turns the camera
       */
      this.wssService
        .onMediaVideoOrientationChange()
        .subscribe(async (data: any) => {
          console.log('mediaVideoOrientationChange', data);
        });

      /**
       * When the local peer needs to reconnect the stream
       */
      this.wssService.onMediaReproduce().subscribe(async (data: any) => {
        // console.warn('onMediaReproduce', data);
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
      });

      /**
       * When a remote peer pauses its stream
       */
      this.wssService.onMediaProducerPause().subscribe(async (data: any) => {
        if (data.kind === 'audio') {
          const media = this.consumersAudio.get(data.user_id);
          if (media) {
            media.pause();
          }
        } else if (data.kind === 'video') {
          const media = this.consumersVideo.get(data.user_id);
          if (media) {
            media.pause();
          }
        }
      });

      /**
       * When a remote peer unpauses its stream
       */
      this.wssService.onMediaProducerResume().subscribe(async (data: any) => {
        console.log('mediaProducerResume', data);
        if (data.kind === 'audio') {
          const media = this.consumersAudio.get(data.user_id);
          if (media) {
            media.resume();
          }
        } else if (data.kind === 'video') {
          const media = this.consumersVideo.get(data.user_id);
          if (media) {
            media.resume();
          }
        }
      });

      /**
       * When someone is talking.
       */
      this.wssService.onMediaActiveSpeaker().subscribe(async (data: any) => {
        // console.log('mediaActiveSpeaker', data);
      });

      /**
       *  When the room was replaced by a worker and you want to reconnect mediasoup
       */
      this.wssService.onMediaReconfigure().subscribe(async (data: any) => {
        console.log('mediaReconfigure', data);
        try {
          await this.load(true);
          await this.producerAudioStart();
          await this.producerVideoStart();
        } catch (error) {
          console.error(error.message, error.stack);
        }
      });
    });
  }

  async joinRoom(memberType: MemberType): Promise<void> {
    console.warn('MEMBER TYPE', memberType);
    this._memberType = memberType;
    if (memberType === MemberType.CONSUMER) {
      this.skipProduce = true;
    }
    await this.wssService.joinRoom({ kind: memberType });
  }

  getConsumersMedia() {
    return {
      video: this.consumersVideoStream,
      audio: this.consumersAudioStream,
    };
  }
  getConsumers(): Observable<any> {
    return this.consumers.asObservable();
  }

  public onConnectionReady(): Observable<boolean> {
    return this.isConnectionReady.asObservable();
  }

  public onAudioEnabled(): Observable<boolean> {
    return this.isAudioEnabled.asObservable();
  }
  public onVideoEnabled(): Observable<boolean> {
    return this.isVideoEnabled.asObservable();
  }
  async handleMessage(data: {
    action: string;
    data: any;
    user_id?: string;
    type?: string;
    kind?: string;
  }): Promise<void> {
    // console.log(`handling ${data.action}`);
    switch (data.action) {
      case 'getRouterRtpCapabilities':
        console.log(data);
        if (!this.mediasoupDevice.loaded) {
          if (data) await this.mediasoupDevice.load(data.data);
        }
        await this.createProducerTransport();
        await this.createConsumerTransport();
        if (!this.skipConsume) {
          const a = await this.wssService.requestMedia({
            action: 'getAudioProducerIds',
          });
          const v = await this.wssService.requestMedia({
            action: 'getVideoProducerIds',
          });
        }
        // this.producerVideoStart();
        // this.producerAudioStart();
        break;
      case 'createWebRtcTransport':
        if (data.type === 'producer') {
          this.producerTransport = this.mediasoupDevice.createSendTransport(
            data.data.params
          );
          // 'connect' | 'produce' | 'producedata' | 'connectionstatechange'
          this.producerTransport.on(
            'connect',
            async ({ dtlsParameters }, callback, errback) => {
              try {
                await this.wssService.requestMedia({
                  action: 'connectWebRtcTransport',
                  data: { dtlsParameters, type: 'producer' },
                });
                callback();
              } catch (e) {
                errback(e);
              }
            }
          );
          this.producerTransport.on(
            'produce',
            async ({ kind, rtpParameters }, callback, errback) => {
              await this.wssService
                .requestMedia({
                  action: 'produce',
                  data: {
                    producerTransportId: this.producerTransport.id,
                    kind,
                    rtpParameters,
                  },
                })
                .then(callback)
                .catch(errback);
            }
          );
          this.producerTransport.on(
            'connectionstatechange',
            async (state: TState) => {
              switch (state) {
                case 'connecting':
                  console.log('subscribing...');
                  break;
                case 'connected':
                  console.log('subscribed');
                  break;
                case 'failed':
                  this.producerTransport.close();
                  break;
                default:
                  break;
              }
            }
          );
        } else if (data.type === 'consumer') {
          this.consumerTransport = this.mediasoupDevice.createRecvTransport(
            data.data.params
          );

          // 'connect' | 'connectionstatechange'
          this.consumerTransport.on(
            'connect',
            async ({ dtlsParameters }, callback, errback) => {
              await this.wssService
                .requestMedia({
                  action: 'connectWebRtcTransport',
                  data: { dtlsParameters, type: 'consumer' },
                })
                .then(callback)
                .catch(errback);
            }
          );

          this.consumerTransport.on(
            'connectionstatechange',
            async (state: TState) => {
              switch (state) {
                case 'connecting':
                  break;
                case 'connected':
                  break;
                case 'failed':
                  this.consumerTransport.close();
                  break;
                default:
                  break;
              }
            }
          );
        } else {
          console.log('createWebRtcTransport', data.data);
        }

        break;
      case 'connectWebRtcTransport':
        console.log('connectWebRtcTransport', data.data);
        break;
      case 'produce':
        console.log('produce', data.data);
        break;
      case 'consume':
        {
          // console.log('MESSAGE HANDLED consume', data);

          const consumer: Consumer = await this.consumerTransport.consume(
            data.data
          );
          // 'trackended' | 'transportclose'
          consumer.on('transportclose', async () => {
            console.warn(`CONSUMERS ${data.user_id} ${data.kind} closed`);
            if (data.kind === 'video') {
              this.consumersVideoStream.delete(data.user_id!);
              this.consumersVideo.delete(data.user_id!);
            } else if (data.kind === 'audio') {
              this.consumersAudioStream.delete(data.user_id!);
              this.consumersAudio.delete(data.user_id!);
            }
          });
          const { track } = consumer;
          const stream = new MediaStream([track]);
          if (data.kind === 'video') {
            this.consumersVideo.set(data.user_id!, consumer);
            this.consumersVideoStream.set(data.user_id!, stream);
          } else if (data.kind === 'audio') {
            this.consumersAudio.set(data.user_id!, consumer);
            this.consumersAudioStream.set(
              data.user_id!,
              new MediaStream([track])
            );
          }
        }
        break;
      case 'restartIce':
        switch (data.type) {
          case 'producer':
            await this.producerTransport.restartIce({
              iceParameters: data.data,
            });
            break;
          case 'consumer':
            await this.consumerTransport.restartIce({
              iceParameters: data.data,
            });
            break;
        }
        break;
      case 'requestConsumerKeyFrame':
        console.log('requestConsumerKeyFrame', data.data);
        break;
      case 'getTransportStats':
        console.log('getTransportStats', data.data);
        break;
      case 'getProducerStats':
        console.log('getProducerStats', data.data);
        break;
      case 'getConsumerStats':
        console.log('getConsumerStats', data.data);
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
        console.log('producerClose', data.data);
        break;
      case 'producerPause':
        console.log('producerPause', data.data);
        break;
      case 'producerResume':
        console.log('producerResume', data.data);

        break;
      case 'allProducerClose':
        console.log('allProducerClose', data.data);
        break;
      case 'allProducerPause':
        console.log('allProducerPause', data.data);
        break;
      case 'allProducerResume':
        console.log('allProducerResume', data.data);
        break;
    }
  }

  async initCommunication(): Promise<void> {
    await this.load();
  }

  /**
   * Change the mediasoup worker in the room
   */
  async reConfigureMedia() {
    try {
      this.wssService.requestMediaConfigure();
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Connect to mediasoup
   * @param skipConsume do not accept streams from already connected
   */
  async load(skipConsume = false): Promise<void> {
    this.skipConsume = !skipConsume;
    try {
      const result = await this.wssService.requestMedia({
        action: 'getRouterRtpCapabilities',
      });
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
    if (this.skipProduce) {
      return;
    }
    try {
      const value = await this.wssService.requestMedia({
        action: 'createWebRtcTransport',
        data: { type: 'producer' },
      });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Create transport for receiving streams from other users
   */
  private async createConsumerTransport(): Promise<void> {
    try {
      await this.wssService.requestMedia({
        action: 'createWebRtcTransport',
        data: { type: 'consumer' },
      });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Start sending your video stream
   */
  async producerVideoStart(): Promise<void> {
    if (this.skipProduce) {
      return;
    }

    if (this.mediasoupDevice.canProduce('video')) {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 200, height: 150 },
      });

      const videoTrack = videoStream.getVideoTracks()[0];

      if (videoTrack) {
        if (this.producerTransport && !this.producerTransport.closed) {
          this.producerVideo = await this.producerTransport.produce({
            track: videoTrack,
            encodings: environment.camVideoSimulcastEncodings,
            codecOptions: {
              videoGoogleStartBitrate: 1000,
            },
          });
        }
        // 'trackended' | 'transportclose'
        // this.producerVideo.on('transportclose', () => {});
      }
      this.producerVideoStream = videoStream;
      this.producerVideoStream$.next(this.producerVideoStream);
    }
  }

  /**
   * Pause your video stream
   */
  async producerVideoPause(user_id: string): Promise<void> {
    if (this.skipProduce) {
      return;
    }
    try {
      if (this.producerVideo && !this.producerVideo.paused) {
        // this.targetProducerPause({ user_id: user_id, kind: 'video' });
        this.producerVideo.pause();
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Unpause the transfer of your video stream
   */
  async producerVideoResume(user_id: string): Promise<void> {
    if (this.skipProduce) {
      return;
    }
    if (
      this.producerVideo &&
      this.producerVideo.paused &&
      !this.producerVideo.closed
    ) {
      console.info('RESUMIENDO');
      // this.targetProducerResume({ user_id: user_id, kind: 'video' });
      this.producerVideo.resume();
    } else if (!this.producerVideo || this.producerVideo.closed) {
      console.info('INICIANDO');
      if (!this.skipConsume) {
        await this.wssService.requestMedia({ action: 'getVideoProducerIds' });
      }
      await this.producerVideoStart();
    }

    // } catch (error) {
    //   console.error(error.message, error.stack);
    // }
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
      if (this.skipProduce) {
        return;
      }
      if (this.mediasoupDevice.canProduce('audio')) {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const audioTrack = audioStream.getAudioTracks()[0];

        if (audioTrack) {
          if (this.producerTransport && !this.producerTransport.closed) {
            this.producerAudio = await this.producerTransport.produce({
              track: audioTrack,
            });
            this.producerAudio.on('transportclose', () => {
              //DO SOMETHING
            });
          }

          // 'trackended' | 'transportclose'
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
  async producerAudioPause(user_id: string): Promise<void> {
    try {
      if (this.producerAudio && !this.producerAudio.paused) {
        // await this.targetProducerPause({ user_id: user_id, kind: 'audio' });
        this.producerAudio.pause();
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Unpause the transmission of your audio stream
   */
  async producerAudioResume(user_id: string): Promise<void> {
    console.log(
      this.producerAudio &&
        this.producerAudio.paused &&
        !this.producerAudio.closed
    );
    try {
      if (
        this.producerAudio &&
        this.producerAudio.paused &&
        !this.producerAudio.closed
      ) {
        // await this.targetProducerResume({ user_id: user_id, kind: 'audio' });
        this.producerAudio.resume();
      } else if (!this.producerAudio || this.producerAudio.closed) {
        if (!this.skipConsume) {
          await this.wssService.requestMedia({ action: 'getAudioProducerIds' });
        }
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
  async targetProducerPause(data: { user_id: string; kind: TKind }) {
    try {
      await this.wssService.requestMedia({ action: 'producerPause', data });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Unpause user stream
   * @param data user_id and stream type
   */
  async targetProducerResume(data: { user_id: string; kind: TKind }) {
    try {
      await this.wssService.requestMedia({ action: 'producerResume', data });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Stop the user's stream (to resume the broadcast, this user will have to recreate the producer)
   * @param data user_id and stream type
   */
  async targetProducerClose(data: { user_id: string; kind: TKind }) {
    try {
      await this.wssService.requestMedia({ action: 'producerClose', data });
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
      await this.wssService.requestMedia({ action: 'allProducerPause', data });
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
      await this.wssService.requestMedia({ action: 'allProducerResume', data });
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
      await this.wssService.requestMedia({ action: 'allProducerClose', data });
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
      await this.wssService.requestMedia({
        action: 'consume',
        data: { rtpCapabilities, user_id, kind: 'video' },
      });
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

      await this.wssService.requestMedia({
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
      const iceParameters: RTCIceParameters =
        await this.wssService.requestMedia({
          action: 'restartIce',
          data: {
            type,
          },
        });
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
      await this.wssService.requestMedia({
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
  async getProducerStats(
    kind: TKind,
    user_id: string
  ): Promise<WssEventMediaResponse | void> {
    try {
      await this.wssService.requestMedia({
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
  async getConsumerStats(
    kind: TKind,
    user_id: string
  ): Promise<WssEventMediaResponse | void> {
    try {
      await this.wssService.requestMedia({
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
  async requestConsumerKeyFrame(
    user_id: string
  ): Promise<WssEventMediaResponse | void> {
    try {
      await this.wssService.requestMedia({
        action: 'requestConsumerKeyFrame',
        data: {
          user_id,
        },
      });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  private camEncodings() {
    return environment.camVideoSimulcastEncodings;
  }

  public getStream(): MediaStream {
    return this.producerVideoStream;
  }

  public getMemberVideoStream(id: string): MediaStream | undefined {
    return this.consumersVideoStream.get(id);
  }
  public getMemberAudioStream(id: string): MediaStream {
    return <MediaStream>this.consumersAudioStream.get(id);
  }
}
