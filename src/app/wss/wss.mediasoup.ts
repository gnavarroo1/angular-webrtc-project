import * as mediasoupClient from 'mediasoup-client';
import { WssService } from './wss.service';

import {
  IMemberIdentifier,
  TKind,
  TPeer,
  TState,
  WebRtcTransportResponse,
  MemberType,
} from '../meetings/types/defines';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { IceParameters, Transport } from 'mediasoup-client/lib/Transport';
import { Producer } from 'mediasoup-client/lib/Producer';
import { Consumer, ConsumerOptions } from 'mediasoup-client/lib/Consumer';
import { stat } from 'fs';
import { endianness } from 'os';
import deviceInfo from '../core/helpers/deviceInfo.helper';
const PC_PROPRIETARY_CONSTRAINTS = {
  optional: [{ googDscp: true }],
};
@Injectable()
export class MediasoupService {
  get memberType(): MemberType {
    return this._memberType;
  }
  requestTimeout = 20000;
  private readonly PC_PROPRIETARY_CONSTRAINTS = {
    optional: [{ googDscp: true }],
  };
  videoAspectRatio = 1.77;
  // lastN = 4;
  // mobileLastN = 1;
  // VIDEO_CONSTRAINS = {
  //   low: {
  //     width: { ideal: 320 },
  //     aspectRatio: this.videoAspectRatio,
  //   },
  //   medium: {
  //     width: { ideal: 640 },
  //     aspectRatio: this.videoAspectRatio,
  //   },
  //   high: {
  //     width: { ideal: 1280 },
  //     aspectRatio: this.videoAspectRatio,
  //   },
  //   veryhigh: {
  //     width: { ideal: 1920 },
  //     aspectRatio: this.videoAspectRatio,
  //   },
  //   ultra: {
  //     width: { ideal: 3840 },
  //     aspectRatio: this.videoAspectRatio,
  //   },
  // };
  private readonly device = deviceInfo();
  private mediasoupDevice;

  private producerVideo!: Producer;
  private producerVideoStream$ = new BehaviorSubject<MediaStream>(
    new MediaStream()
  );
  private producerAudio!: Producer;
  private audioOnly = false;
  public producerTransport!: Transport;
  public consumerTransport!: Transport;

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
  public consumers: Map<string, IMemberIdentifier> = new Map<
    string,
    IMemberIdentifier
  >();

  public consumer$: BehaviorSubject<Map<string, IMemberIdentifier>> =
    new BehaviorSubject<Map<string, IMemberIdentifier>>(
      new Map<string, IMemberIdentifier>()
    );

  private isConnectionReady = new BehaviorSubject<boolean>(false);
  private isAudioEnabled = new BehaviorSubject<boolean>(false);
  private isVideoEnabled = new BehaviorSubject<boolean>(false);
  private skipConsume = false;
  private skipProduce = false;
  private _memberType = MemberType.BOTH;
  private apiMediasoup =
    environment.mediaSoupApiUrl + 'websocket/message-connection-handler';
  private _user_id!: string;
  private _session_id!: string;
  private isStarted = false;
  get user_id(): string {
    return this._user_id;
  }

  set user_id(value: string) {
    this._user_id = value;
  }
  get session_id(): string {
    return this._session_id;
  }

  set session_id(value: string) {
    this._session_id = value;
  }

  constructor(private wssService: WssService) {
    this.mediasoupDevice = new mediasoupClient.Device({});

    this.wssService.onConnection().subscribe(async () => {
      this.isConnectionReady.next(true);
      this.wssService.socket.on(
        'request',
        async (
          request: any,
          resolve: () => void,
          reject: (number: number, msg: string) => void
        ) => {
          switch (request.method) {
            case 'newConsumer': {
              console.error('request', request);
              if (this.skipConsume) {
                reject(403, 'Not consuming');
              }
              try {
                const {
                  peerId,
                  producerId,
                  id,
                  kind,
                  rtpParameters,
                  type,
                  appData,
                  producerPaused,
                } = request.data;

                const consumer = await this.consumerTransport.consume({
                  id,
                  producerId,
                  kind,
                  rtpParameters,
                  appData: {
                    ...appData,
                    peerId,
                  },
                });

                switch (kind) {
                  case 'audio':
                    this.consumersAudio.set(peerId, consumer);

                    break;
                  case 'video':
                    this.consumersVideo.set(peerId, consumer);
                    break;
                }
                consumer.on('transportclose', () => {
                  switch (kind) {
                    case 'audio':
                      this.consumersAudio.delete(peerId);
                      break;
                    case 'video':
                      this.consumersVideo.delete(peerId);
                      break;
                  }
                });

                if (consumer.rtpParameters.encodings) {
                  const { spatialLayers, temporalLayers } =
                    mediasoupClient.parseScalabilityMode(
                      consumer.rtpParameters.encodings[0].scalabilityMode
                    );
                }
                resolve();

                if (consumer.kind === 'audio') {
                  const stream = new MediaStream();
                  stream.addTrack(consumer.track);
                  if (!stream.getAudioTracks()[0]) {
                    throw new Error(
                      'request.newConsumer | given stream has no audio track'
                    );
                  }
                }

                if (consumer.kind === 'video' && this.audioOnly) {
                  this.pauseConsumer(consumer);
                }
              } catch (e) {
                throw e;
              }
            }
          }
        }
      );
      this.wssService.onMediaClientConnected().subscribe(async (data) => {
        console.warn('consumer connected', data);
        if (data.id !== environment.user_id) {
          if (!this.consumers.has(data.id)) {
            await this.wssService.requestHandshake({
              target: data.id,
              kind: this._memberType,
            });
            if (data.kind !== MemberType.CONSUMER) {
              this.consumers.set(data.id, data);
              this.consumer$.next(this.consumers);
            }
            if (this.consumerTransport) {
              this.consumerVideoStart(data.id);
              this.consumerAudioStart(data.id);
            }
          }
        }
      });

      /**
       * When a remote peer enters the meeting
       */
      this.wssService.onMediaClientDisconnect().subscribe(async (data) => {
        this.consumers.delete(data.id);
        this.consumer$.next(this.consumers);
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
            console.warn(`SE OBTUVO ${data.kind} DE ${data.user_id}`);
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
          } else {
            await this.consumerAudioStart(data.user_id);
          }
        } else if (data.kind === 'video') {
          const media = this.consumersVideo.get(data.user_id);
          if (media) {
            media.resume();
          } else {
            await this.consumerVideoStart(data.user_id);
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
    console.warn('joining room', memberType);
    const resAddClient = await this.wssService.messageWithCallback(
      'addClient',
      {
        kind: memberType,
      }
    );
    console.log(resAddClient);
    const data = await this.wssService.requestMedia({
      action: 'getRouterRtpCapabilities',
    });
    const routerRtpCapabilities = data.routerRtpCapabilities;
    console.warn('DATA', routerRtpCapabilities);
    if (!this.mediasoupDevice.loaded) {
      routerRtpCapabilities.headerExtensions =
        routerRtpCapabilities.headerExtensions.filter(
          (ext: any) => ext.uri !== 'urn:3gpp:video-orientation'
        );
      console.warn('SETTING RTPCAPABILITIES');
      await this.mediasoupDevice.load({ routerRtpCapabilities });
    }
    {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = stream.getAudioTracks()[0];

      audioTrack.enabled = false;

      setTimeout(() => audioTrack.stop(), 120000);
    }
    if (memberType === MemberType.CONSUMER) {
      this.skipProduce = true;
    }

    await this.createProducerTransport();
    await this.createConsumerTransport();

    const res = await this.wssService
      .messageWithCallback('joinRoom', {
        kind: memberType,
        rtpCapabilities: this.mediasoupDevice.rtpCapabilities,
      })
      .then(await this.handleJoinedPeers)
      .catch((err) => {
        console.error(err.message, err.stack);
      });

    console.warn('MEMBER TYPE', memberType);
    this._memberType = memberType;
    if (!this.skipProduce) {
      await this.producerAudioStart(true);
      await this.producerVideoStart(true);
    }

    console.log(res);
  }

  handleJoinedPeers = async (res: {
    id: string;
    peersInfo: IMemberIdentifier[];
  }) => {
    console.warn('CONSUMERS', this.consumers);
    for (const peersInfoElement of res.peersInfo) {
      console.error('IMember', peersInfoElement);
      this.consumers.set(
        peersInfoElement.id,
        peersInfoElement as IMemberIdentifier
      );
      // if (this.consumerTransport) {
      //   this.consumerVideoStart(peersInfoElement.id);
      //   this.consumerAudioStart(peersInfoElement.id);
      // }
    }
    if (!this.skipConsume) {
      await this.setAudioProducersIds();
      await this.setVideoProducerIds();
    }
    this.consumer$.next(this.consumers);
  };

  //
  // getConsumersMedia() {
  //   return {
  //     video: this.consumersVideoStream,
  //     audio: this.consumersAudioStream,
  //   };
  // }
  getConsumers(): Observable<any> {
    return this.consumer$.asObservable();
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

  async initCommunication(): Promise<void> {
    // await this.load();
    if (!this.skipProduce) {
      await this.producerAudioStart(true);
      await this.producerVideoStart(true);
    }
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
    console.warn('LOADING');
    this.skipConsume = !skipConsume;
    try {
      const data = await this.wssService.requestMedia(
        // this._user_id,
        // this._session_id,
        {
          action: 'getRouterRtpCapabilities',
        }
      );
      const routerRtpCapabilities = data.routerRtpCapabilities;
      console.warn('DATA', routerRtpCapabilities);
      if (!this.mediasoupDevice.loaded) {
        routerRtpCapabilities.headerExtensions =
          routerRtpCapabilities.headerExtensions.filter(
            (ext: any) => ext.uri !== 'urn:3gpp:video-orientation'
          );
        await this.mediasoupDevice.load({ routerRtpCapabilities });
      }
      await this.createProducerTransport();
      await this.createConsumerTransport();
      if (!this.skipConsume) {
        await this.setAudioProducersIds();
        await this.setVideoProducerIds();
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }
  async setAudioProducersIds() {
    const audioProducersIds: string[] = await this.wssService.requestMedia({
      action: 'getAudioProducerIds',
    });
    audioProducersIds.forEach(async (id: string) => {
      await this.consumerAudioStart(id);
    });
  }

  async setVideoProducerIds() {
    const videoProducersIds: string[] = await this.wssService.requestMedia({
      action: 'getVideoProducerIds',
    });
    videoProducersIds.forEach(async (id: string) => {
      await this.consumerVideoStart(id);
    });
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
      const data = await this.wssService.requestMedia({
        action: 'createWebRtcTransport',
        data: { type: 'producer' },
      });
      console.log(data.params);
      const { id, iceParameters, iceCandidates, dtlsParameters } = data;
      this.producerTransport = this.mediasoupDevice.createSendTransport({
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters,
        iceServers: [],
        proprietaryConstraints: this.PC_PROPRIETARY_CONSTRAINTS,
      });
      console.log('PRODUCER TRANSPORT', this.producerTransport);
      // 'connect' | 'produce' | 'producedata' | 'connectionstatechange'
      this.producerTransport.on(
        'connect',
        async ({ dtlsParameters }, callback, errback) => {
          console.warn('ON TRANSPORT CONNECT', dtlsParameters);
          try {
            const res = await this.wssService.requestMedia({
              action: 'connectWebRtcTransport',
              data: { dtlsParameters, type: 'producer' },
            });
            console.log('RESPONSE ON TRANSPORT CONNECT', res);
            callback();
          } catch (error) {
            errback(error);
          }
        }
      );
      this.producerTransport.on(
        'produce',
        async ({ kind, rtpParameters, appData }, callback, errback) => {
          await this.wssService
            .requestMedia(
              // this._user_id, this._session_id,
              {
                action: 'produce',
                data: {
                  producerTransportId: this.producerTransport.id,
                  kind,
                  rtpParameters,
                },
              }
            )
            .then(callback)
            .catch(errback);
        }
      );

      this.producerTransport.on(
        'connectionstatechange',
        async (state: TState) => {
          switch (state) {
            case 'connecting':
              break;
            case 'connected':
              break;
            case 'failed':
              this.producerTransport.close();
              break;
            default:
              break;
          }
        }
      );
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }
  /**
   * Create transport for receiving streams from other users
   */
  private async createConsumerTransport(): Promise<void> {
    if (this.skipConsume) {
      return;
    }
    try {
      const data = await this.wssService.requestMedia({
        action: 'createWebRtcTransport',
        data: { type: 'consumer' },
      });
      this.consumerTransport = this.mediasoupDevice.createRecvTransport(data);

      // 'connect' | 'connectionstatechange'
      this.consumerTransport.on(
        'connect',
        async ({ dtlsParameters }, callback, errback) => {
          await this.wssService
            .requestMedia(
              // this._user_id, this._session_id,
              {
                action: 'connectWebRtcTransport',
                data: {
                  dtlsParameters,
                  transportId: this.consumerTransport.id,
                  type: 'consumer',
                },
              }
            )
            .then(callback)
            .catch(errback);
        }
      );

      this.consumerTransport.on(
        'connectionstatechange',
        async (state: TState) => {
          console.warn('CONNECTION STATE CHANGE', state);
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
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  private async createTransport(): Promise<void> {
    console.warn('ATTEMPT TO CREATE TRANSPORT');
    const { rtpCapabilities } = this.mediasoupDevice;
    const iceTransportPolicy =
      this.device.flag === 'firefox' &&
      environment.mediasoupClient.configuration.iceServers
        ? 'relay'
        : undefined;
    if (!this.skipProduce) {
      const transportInfo = await this.wssService.requestMedia({
        action: 'createWebRtcTransport',
        data: {
          type: 'producer',
        },
      });
      const { id, iceParameters, iceCandidates, dtlsParameters } =
        transportInfo;

      this.producerTransport = this.mediasoupDevice.createSendTransport({
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters,
        // iceServers: environment.mediasoupClient.configuration.iceServers,
        // iceTransportPolicy: iceTransportPolicy,
        proprietaryConstraints: PC_PROPRIETARY_CONSTRAINTS,
      });
      this.producerTransport.on(
        'connect',
        ({ dtlsParameters }, callback, errback) => {
          this.wssService
            .requestMedia({
              action: 'connectWebRtcTransport',
              data: {
                dtlsParameters,
                type: 'producer',
              },
            })
            .then(callback)
            .catch(errback);
        }
      );
      this.producerTransport.on(
        'produce',
        async ({ kind, rtpParameters, appData }, callback, errback) => {
          await this.wssService
            .requestMedia({
              action: 'produce',
              data: {
                producerTransportId: this.producerTransport.id,
                kind,
                rtpParameters,
              },
            })
            .then(({ id }) => callback({ id }))
            .catch(errback);
        }
      );
      this.producerTransport.on(
        'connectionstatechange',
        async (state: TState) => {
          console.log('PRODUCER TRANSPORT STATE', state);
          switch (state) {
            case 'connecting':
              break;
            case 'connected':
              break;
            case 'failed':
              this.producerTransport.close();
              break;
            default:
              break;
          }
        }
      );
    }
    const transportInfo = await this.wssService.requestMedia({
      action: 'createWebRtcTransport',
      data: {
        type: 'consumer',
      },
    });
    const { id, iceParameters, iceCandidates, dtlsParameters } = transportInfo;
    this.consumerTransport = this.mediasoupDevice.createRecvTransport({
      id,
      iceParameters,
      iceCandidates,
      dtlsParameters,
      iceServers: environment.mediasoupClient.configuration.iceServers,
      iceTransportPolicy: iceTransportPolicy,
    });

    this.consumerTransport.on(
      'connect',
      ({ dtlsParameters, callback, errback }) => {
        this.wssService
          .requestMedia({
            action: 'connectWebRtcTransport',
            data: {
              dtlsParameters,
              type: 'consumer',
            },
          })
          .then(callback)
          .catch(errback);
      }
    );
    this.consumerTransport.on(
      'connectionstatechange',
      async (state: TState) => {
        console.warn('CONSUMER TRANSPORT STATE', state);
        switch (state) {
          case 'new':
            break;
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
  }

  /**
   * Start sending your video stream
   */
  async producerVideoStart(started = false): Promise<void> {
    if (this.skipProduce) {
      return;
    }

    if (this.mediasoupDevice.canProduce('video')) {
      const { resolution, framerate } =
        environment.mediasoupClient.configuration;

      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: this.videoAspectRatio,
            frameRate: framerate,
          },
        });

        const videoTrack = videoStream.getVideoTracks()[0];

        if (videoTrack) {
          if (this.producerTransport && !this.producerTransport.closed) {
            this.producerVideo = await this.producerTransport.produce({
              track: videoTrack,
              encodings:
                environment.mediasoupClient.configuration
                  .camVideoSimulcastEncodings,
              codecOptions: {
                videoGoogleStartBitrate: 1000,
              },
            });
            this.producerVideo.on('transportclose', () => {
              console.log('VIDEO PRODUCER TRANSPORT CLOSE');
            });
          }
          // 'trackended' | 'transportclose'
        }
        this.producerVideoStream = videoStream;
        if (started) {
          this.producerVideo.pause();
        }
        this.producerVideoStream$.next(this.producerVideoStream);
      } catch (e) {
        console.error(e.name, e.message);
      }
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
      // if (!this.skipConsume) {
      //   await this.setVideoProducerIds();
      // }
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
  async producerAudioStart(started = false): Promise<void> {
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
        }

        this.producerAudioStream = audioStream;
        if (started) {
          this.producerAudio.pause();
        }
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
        // if (!this.skipConsume) {
        //   await this.setAudioProducersIds();
        // }
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
  async targetProducerPause(data: { user_id: string; type: TKind }) {
    try {
      await this.wssService.requestMedia({
        action: 'producerPause',
        data,
      });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Unpause user stream
   * @param data user_id and stream type
   */
  async targetProducerResume(data: { user_id: string; type: TKind }) {
    try {
      await this.wssService.requestMedia(
        // this._user_id, this._session_id,
        {
          action: 'producerResume',
          data,
        }
      );
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Stop the user's stream (to resume the broadcast, this user will have to recreate the producer)
   * @param data user_id and stream type
   */
  async targetProducerClose(data: { user_id: string; type: TKind }) {
    try {
      await this.wssService.requestMedia(
        // this._user_id, this._session_id,
        {
          action: 'producerClose',
          data,
        }
      );
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Pause the stream of all users
   * @param data stream type
   */
  async allProducerPause(data: { type: TKind }) {
    try {
      await this.wssService.requestMedia(
        // this._user_id, this._session_id,
        {
          action: 'allProducerPause',
          data,
        }
      );
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Unpause the stream of all users
   * @param data stream type
   */
  async allProducerResume(data: { type: TKind }) {
    try {
      await this.wssService.requestMedia(
        // this._user_id, this._session_id,
        {
          action: 'allProducerResume',
          data,
        }
      );
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Stop the stream of all users (in order to resume the transmission, these users will have to recreate the producer)
   * @param data stream type
   */
  async allProducerClose(data: { type: TKind }) {
    try {
      await this.wssService.requestMedia(
        // this._user_id, this._session_id,
        {
          action: 'allProducerClose',
          data,
        }
      );
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
      const consumeData = await this.wssService.requestMedia({
        action: 'consume',
        data: { rtpCapabilities, user_id, kind: 'video' },
      });
      const consumer: Consumer = await this.consumerTransport.consume(
        consumeData
      );

      // 'trackended' | 'transportclose'
      consumer.on('transportclose', async () => {
        this.consumersVideoStream.delete(user_id!);
        this.consumersVideo.delete(user_id!);
      });

      const encodings = consumer.rtpParameters.encodings;
      if (encodings) {
        const { spatialLayers, temporalLayers } =
          mediasoupClient.parseScalabilityMode(encodings[0].scalabilityMode);
        console.warn('SPATIAL LAYERS', spatialLayers);
        console.warn('TEMPORAL LAYERS', temporalLayers);
      }

      this.consumersVideo.set(user_id, consumer);
      const { track } = consumer;
      const stream = new MediaStream([track]);
      this.consumersVideoStream.set(user_id, stream);
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
      console.warn(`Request to consume ${user_id} audio stream`);
      const { rtpCapabilities } = this.mediasoupDevice;

      const consumeData = await this.wssService.requestMedia({
        action: 'consume',
        data: { rtpCapabilities, user_id, kind: 'audio' },
      });
      console.warn(
        `Generating consumer to ${user_id} audio stream`,
        consumeData
      );
      const { id, producerId, kind, rtpParameters } = consumeData;
      const consumer: Consumer = await this.consumerTransport.consume({
        id,
        kind,
        rtpParameters,
        producerId,
      });

      // 'trackended' | 'transportclose'
      consumer.on('transportclose', async () => {
        console.warn(`Producer ${user_id} audio stream transport closed`);
        this.consumersAudioStream.delete(user_id);
        this.consumersAudio.delete(user_id);
      });

      this.consumersAudio.set(user_id, consumer);
      console.info('Agregado consumer a consumers audio', this.consumersAudio);
      const { track } = consumer;
      const stream = new MediaStream([track]);
      this.consumersAudioStream.set(user_id, stream);
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  async addConsumer(
    producerUserId: string,
    consumerOptions: ConsumerOptions
  ): Promise<void> {
    console.error('addConsumer', producerUserId, consumerOptions);
    const consumer = await this.consumerTransport.consume(consumerOptions);
    consumer.on('transportclose', async () => {
      if (!this.removeConsumerByKind(producerUserId, consumerOptions.kind)) {
        //todo throw error?
      }
    });
    //
    if (
      !this.addConsumerByKind(consumer, producerUserId, consumerOptions.kind)
    ) {
      //todo throw error?
    }
    if (consumerOptions.kind === 'audio') {
      const stream = new MediaStream();
      stream.addTrack(consumer.track);
      if (!stream.getAudioTracks()[0])
        throw new Error(
          'request.newConsumer | given stream has no audio track'
        );
    }
    console.error('addconsumer - return consumer', consumer);
  }
  private removeConsumerByKind(
    producerUserId: string,
    kind: 'video' | 'audio' | undefined
  ): boolean {
    if (kind === 'audio') {
      this.consumersAudioStream.delete(producerUserId);
      this.consumersAudio.delete(producerUserId);
    } else if (kind === 'video') {
      this.consumersVideoStream.delete(producerUserId);
      this.consumersVideo.delete(producerUserId);
    } else {
      return false;
    }
    return true;
  }
  private addConsumerByKind(
    consumer: Consumer,
    producerUserId: string,
    kind: 'video' | 'audio' | undefined
  ) {
    const { track } = consumer;
    const stream = new MediaStream([track]);
    if (kind === 'audio') {
      this.consumersAudioStream.set(producerUserId, stream);
      this.consumersAudio.set(producerUserId, consumer);
    } else if (kind === 'video') {
      this.consumersVideoStream.set(producerUserId, stream);
      this.consumersVideo.set(producerUserId, consumer);
    } else {
      return false;
    }
    return true;
  }

  /**
   * Restart connection
   * @param type type of transport
   */
  async restartIce(type: TPeer): Promise<void> {
    try {
      const iceParameters: IceParameters = await this.wssService.requestMedia({
        action: 'restartIce',
        data: {
          type,
        },
      });
      switch (type) {
        case 'producer':
          await this.producerTransport.restartIce({ iceParameters });
          break;
        case 'consumer':
          await this.consumerTransport.restartIce({ iceParameters });
          break;
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Get transport stats
   * @param type type of transport
   */
  async getTransportStats(type: TPeer): Promise<any | void> {
    try {
      await this.wssService.requestMedia(
        // this._user_id, this._session_id,
        {
          action: 'getTransportStats',
          data: {
            type,
          },
        }
      );
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Get information about the stream that the user is transmitting
   * @param kind stream type
   * @param user_id unique user identifier
   */
  async getProducerStats(kind: TKind, user_id: string): Promise<any | void> {
    try {
      await this.wssService.requestMedia(
        // this._user_id, this._session_id,
        {
          action: 'getProducerStats',
          data: {
            kind,
            user_id,
          },
        }
      );
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Get info about the stream that receives current_user from another user
   * @param kind stream type
   * @param user_id unique user identifier
   */
  async getConsumerStats(kind: TKind, user_id: string): Promise<any | void> {
    try {
      await this.wssService.requestMedia(
        // this._user_id, this._session_id,
        {
          action: 'getConsumerStats',
          data: {
            kind,
            user_id,
          },
        }
      );
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Get a keyframe from the user whose stream is being received.
   * Video only
   * @param user_id unique user identifier
   */
  async requestConsumerKeyFrame(user_id: string): Promise<any | void> {
    try {
      await this.wssService.requestMedia(
        // this._user_id, this._session_id,
        {
          action: 'requestConsumerKeyFrame',
          data: {
            user_id,
          },
        }
      );
    } catch (error) {
      console.error(error.message, error.stack);
    }
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

  async pauseConsumer(consumer: Consumer) {
    if (consumer.paused) {
      return;
    }
    try {
      await this.wssService.messageWithCallback('pauseConsumer', {
        appData: consumer.appData,
        kind: consumer.kind,
      });
      consumer.pause();
    } catch (e) {
      //Todo notification
      console.error(e.name, `Error pausing Consumer ${e}`);
    }
  }

  async resumeConsumer(consumer: Consumer) {
    if (!consumer.paused) {
      return;
    }
    try {
      await this.wssService.messageWithCallback('resumeConsumer', {
        appData: consumer.appData,
        kind: consumer.kind,
      });
      consumer.resume();
    } catch (e) {
      //Todo notification
      console.error(e.name, `Error resuming Consumer ${e}`);
    }
  }
}
