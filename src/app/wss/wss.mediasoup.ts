import * as mediasoupClient from 'mediasoup-client';
import { WssService } from './mediasoup-connection/wss.service';

import {
  IMemberIdentifier,
  MeetingMemberDto,
  MemberType,
  TKind,
  TPeer,
  TState,
} from '../meetings/types/defines';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { IceParameters, Transport } from 'mediasoup-client/lib/Transport';
import { Producer } from 'mediasoup-client/lib/Producer';
import { Consumer } from 'mediasoup-client/lib/Consumer';
import deviceInfo from '../core/helpers/deviceInfo.helper';
import { NGXLogger } from 'ngx-logger';

const PC_PROPRIETARY_CONSTRAINTS = {
  optional: [{ googDscp: true }],
};

@Injectable()
export class MediasoupService {
  wssService!: WssService;
  constructor(private logger: NGXLogger) {
    this.mediasoupDevice = new mediasoupClient.Device({});
  }

  public initWssService(): void {
    this.wssService = new WssService(this.logger);
    this.wssService.setSocket(this.sessionId, this.userId);
    this.wssService.onConnection().subscribe(async () => {
      this.isConnectionReady.next(true);
      this.wssService.socket.on(
        'request',
        async (
          request: any,
          resolve: () => void,
          reject: (msg: any) => void
        ) => {
          switch (request.method) {
            case 'newConsumer': {
              if (this.skipConsume) {
                reject({
                  msg: 'not consuming',
                });
              }
              // eslint-disable-next-line no-useless-catch
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
                const peer = this.consumers.get(peerId);
                if (peer) {
                  this.logger.error('APPDATA', appData);
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

                  switch (appData.mediaTag) {
                    case 'screen-media':
                      console.log(consumer.kind);
                      this.consumersScreen.set(peerId, consumer);
                      break;
                    case 'audio':
                      this.consumersAudio.set(peerId, consumer);
                      break;
                    case 'video':
                      this.consumersVideo.set(peerId, consumer);
                      break;
                  }
                  consumer.on('transportclose', () => {
                    //console.warn('transportclose', peerId);
                    switch (appData.mediaTag) {
                      case 'screen-media':
                        peer.isScreenSharing = true;
                        this.consumersScreen.delete(peerId);
                        break;
                      case 'audio':
                        this.consumersAudio.delete(peerId);
                        break;
                      case 'video':
                        this.consumersVideo.delete(peerId);
                        break;
                    }
                  });
                  consumer.on('trackended', () => {
                    //console.warn('transportended');
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

                  if (appData.mediaTag === 'video' && this.audioOnly) {
                    this.pauseConsumer(consumer);
                  }
                  if (appData.mediaTag === 'screen-media') {
                    this.consumersScreenStream.set(
                      peerId,
                      new MediaStream([consumer.track])
                    );
                    peer.isScreenSharing = true;
                  }
                } else {
                  reject({
                    error: 'Peer not found',
                  });
                }
              } catch (e) {
                reject({
                  error: e,
                });
              }
            }
          }
        }
      );

      /**
       * When a remote peer enters the meeting
       */
      this.wssService.onMediaClientConnected().subscribe(async (data) => {
        console.warn('consumer connected', data);
        if (data.id !== this.userId) {
          if (!this.consumers.has(data.id)) {
            await this.wssService.requestHandshake({
              target: data.id,
              kind: this._memberType,
            });
            if (data.kind !== MemberType.CONSUMER) {
              this.consumers.set(data.id, {
                ...data,
                volume: data.volume ? data.volume : 1,
              });
              this.consumer$.next(this.consumers);
            }
            if (this.consumerTransport) {
              if (data.isScreenSharing) {
                this.consumerScreenMediaStart(data.id);
              }
              this.consumerVideoStart(data.id);
              this.consumerAudioStart(data.id);
            }
          }
        }
      });

      /**
       * When a remote peer leaves the meeting
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
        .onProducerMediaDeviceToggle()
        .subscribe(async (payload: any) => {
          console.log(payload);
          switch (payload.kind) {
            case 'audio': {
              break;
            }
            case 'video': {
              const consumer = this.consumersVideo.get(payload.sender);
              if (payload.action === 'pause') {
                consumer?.pause();
              } else {
                consumer?.resume();
              }
              break;
            }
          }
        });

      this.wssService
        .onMediaProduce()
        .subscribe(async (data: { userId: string; kind: TKind }) => {
          try {
            //console.warn(`SE OBTUVO ${data.kind} DE ${data.userId}`);
            switch (data.kind) {
              case 'video':
                await this.consumerVideoStart(data.userId);
                break;
              case 'audio':
                await this.consumerAudioStart(data.userId);
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
        console.warn('onMediaReproduce', data);
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
        console.log('mediaProducerResume', data);
        let media;
        const consumer = this.consumers.get(data.userId);
        if (data.mediaTag === 'audio') {
          media = this.consumersAudio.get(data.userId);
        } else if (data.mediaTag === 'video') {
          media = this.consumersVideo.get(data.userId);
        }
        if (media) {
          media.pause();
          if (consumer) {
            switch (data.mediaTag) {
              case 'video':
                if (data.isGlobal) {
                  consumer.globalVideoEnabled = false;
                }
                consumer.producerVideoEnabled = false;
                break;
              case 'audio':
                if (data.isGlobal) {
                  consumer.globalAudioEnabled = false;
                }
                consumer.producerAudioEnabled = false;
                break;
            }
          }
        }
      });

      /**
       * When a remote peer unpauses its stream
       */
      this.wssService.onMediaProducerResume().subscribe(async (data: any) => {
        console.log('mediaProducerResume', data);
        let media;
        const consumer = this.consumers.get(data.userId);
        if (data.mediaTag === 'audio') {
          media = this.consumersAudio.get(data.userId);
        } else if (data.mediaTag === 'video') {
          media = this.consumersVideo.get(data.userId);
        }
        console.log(media?.paused);
        if (media) {
          media.resume();
          if (consumer) {
            switch (data.mediaTag) {
              case 'video':
                if (data.isGlobal) {
                  consumer.globalVideoEnabled = true;
                }
                consumer.producerVideoEnabled = true;
                break;
              case 'audio':
                if (data.isGlobal) {
                  consumer.globalAudioEnabled = true;
                }
                consumer.producerAudioEnabled = true;
                break;
            }
          }
        } else {
          switch (data.mediaTag) {
            case 'audio':
              this.consumerAudioStart(data.userId);
              break;
            case 'video':
              this.consumerVideoStart(data.userId);
              break;
          }
        }
      });
      this.wssService.onMediaProducerClose().subscribe(async (data: any) => {
        console.log('mediaProducerClose', data);
        let media;
        const consumer = this.consumers.get(data.userId);
        if (consumer) {
          switch (data.mediaTag) {
            case 'screen-media':
              media = this.consumersScreen.get(data.userId);
              break;
            case 'video':
              media = this.consumersVideo.get(data.userId);
              break;
            case 'audio':
              media = this.consumersAudio.get(data.userId);
              break;
          }
          if (media) {
            media.close();
          }
          switch (data.mediaTag) {
            case 'screen-media':
              this.consumersScreen.delete(data.userId);
              this.consumersScreenStream.delete(data.userId);
              break;
            case 'video':
              this.consumersVideo.delete(data.userId);
              this.consumersVideoStream.delete(data.userId);
              break;
            case 'audio':
              this.consumersAudio.delete(data.userId);
              this.consumersAudioStream.delete(data.userId);
              break;
          }
          consumer.isScreenSharing = false;
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

  get memberType(): MemberType {
    return this._memberType;
  }
  requestTimeout = 20000;
  private readonly PC_PROPRIETARY_CONSTRAINTS = {
    optional: [{ googDscp: true }],
  };
  videoAspectRatio = 1.77;
  private readonly device = deviceInfo();
  private mediasoupDevice;

  public producerScreenMedia: Producer | undefined;
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
  public consumersScreen: Map<string, Consumer> = new Map<string, Consumer>();
  public consumersAudio: Map<string, Consumer> = new Map<string, Consumer>();
  private consumersScreenStream: Map<string, MediaStream> = new Map<
    string,
    MediaStream
  >();
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
  private _userId!: string;
  private _sessionId!: string;
  private isStarted = false;
  get userId(): string {
    return this._userId;
  }

  set userId(value: string) {
    this._userId = value;
  }
  get sessionId(): string {
    return this._sessionId;
  }

  set sessionId(value: string) {
    this._sessionId = value;
  }

  // public initSocket(meetingId: string, userId: string) {
  //   this.wssService.setSocket(meetingId, userId);
  // }

  async joinRoom(meetingMember: MeetingMemberDto): Promise<void> {
    //console.warn('joining room', memberType);
    const resAddClient = await this.wssService.messageWithCallback(
      'addClient',
      {
        kind: meetingMember.memberType,
      }
    );
    const data = await this.wssService.requestMedia({
      action: 'getRouterRtpCapabilities',
    });
    const routerRtpCapabilities = data.routerRtpCapabilities;
    //console.warn('DATA', routerRtpCapabilities);
    if (!this.mediasoupDevice.loaded) {
      routerRtpCapabilities.headerExtensions =
        routerRtpCapabilities.headerExtensions.filter(
          (ext: any) => ext.uri !== 'urn:3gpp:video-orientation'
        );
      //console.warn('SETTING RTPCAPABILITIES');
      await this.mediasoupDevice.load({ routerRtpCapabilities });
    }
    {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = stream.getAudioTracks()[0];

      audioTrack.enabled = false;

      setTimeout(() => audioTrack.stop(), 120000);
    }
    if (meetingMember.memberType === MemberType.CONSUMER) {
      this.skipProduce = true;
    }

    if (meetingMember.memberType !== MemberType.CONSUMER) {
      await this.createProducerTransport();
    }
    await this.createConsumerTransport();
    const kind =
      meetingMember.memberType === MemberType.BOTH ||
      meetingMember.memberType === MemberType.PRODUCER
        ? 'producer'
        : 'consumer';
    const res = await this.wssService
      .messageWithCallback('joinRoom', {
        kind: kind,
        rtpCapabilities: this.mediasoupDevice.rtpCapabilities,
        producerCapabilities: {
          producerAudioEnabled: meetingMember.produceAudioEnabled,
          producerVideoEnabled: meetingMember.produceVideoEnabled,
          globalAudioEnabled: meetingMember.produceAudioAllowed,
          globalVideoEnabled: meetingMember.produceVideoAllowed,
        },
      })
      .then(await this.handleJoinedPeers)
      .catch((err) => {
        console.error(err.message, err.stack);
      });

    //console.warn('MEMBER TYPE', memberType);
    this._memberType = meetingMember.memberType!;
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
    //console.warn('CONSUMERS', this.consumers);
    for (const peersInfoElement of res.peersInfo) {
      console.error('IMember', peersInfoElement);
      this.consumers.set(peersInfoElement.id, {
        ...(peersInfoElement as IMemberIdentifier),
        volume: 1,
      });
      if (!this.skipConsume) {
        if (peersInfoElement.isScreenSharing) {
          this.consumerScreenMediaStart(peersInfoElement.id);
        }
        this.consumerVideoStart(peersInfoElement.id);
        this.consumerAudioStart(peersInfoElement.id);
        // await this.setAudioProducersIds();
        // await this.setVideoProducerIds();
      }
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
    //console.warn('LOADING');
    this.skipConsume = !skipConsume;
    try {
      const data = await this.wssService.requestMedia(
        // this._userId,
        // this._sessionId,
        {
          action: 'getRouterRtpCapabilities',
        }
      );
      const routerRtpCapabilities = data.routerRtpCapabilities;
      //console.warn('DATA', routerRtpCapabilities);
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
      this.wssService.socket.ioSocket.close();
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
          //console.warn('ON TRANSPORT CONNECT', dtlsParameters);
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
              // this._userId, this._sessionId,
              {
                action: 'produce',
                data: {
                  producerTransportId: this.producerTransport.id,
                  kind,
                  rtpParameters,
                  appData: {
                    ...appData,
                  },
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
              // this._userId, this._sessionId,
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
          //console.warn('CONNECTION STATE CHANGE', state);
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
    //console.warn('ATTEMPT TO CREATE TRANSPORT');
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
        //console.warn('CONSUMER TRANSPORT STATE', state);
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
      const { framerate } = environment.mediasoupClient.configuration;

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
              appData: {
                mediaTag: 'video',
                userId: this.userId,
              },
            });
            this.producerVideo.on('transportclose', () => {
              console.log('VIDEO PRODUCER TRANSPORT CLOSE');
            });
          }
        }
        this.producerVideoStream = videoStream;
        if (started) {
          this.producerVideo.pause();
          this.targetProducerPause({
            userId: this.userId,
            kind: 'video',
            isGlobal: false,
          });
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
  async producerVideoPause(userId: string): Promise<void> {
    if (this.skipProduce) {
      return;
    }
    try {
      if (this.producerVideo && !this.producerVideo.paused) {
        await this.wssService.messageWithCallback('toggleDevice', {
          kind: 'video',
          action: 'pause',
        });
        this.producerVideo.pause();
        await this.targetProducerPause({
          userId: userId,
          kind: 'video',
          isGlobal: false,
        });
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Unpause the transfer of your video stream
   */
  async producerVideoResume(userId: string): Promise<void> {
    if (this.skipProduce) {
      return;
    }
    if (
      this.producerVideo &&
      this.producerVideo.paused &&
      !this.producerVideo.closed
    ) {
      console.info('RESUMIENDO');
      await this.targetProducerResume({
        userId: userId,
        kind: 'video',
        isGlobal: false,
      });
      this.producerVideo.resume();
      await this.wssService.messageWithCallback('toggleDevice', {
        kind: 'video',
        action: 'resume',
      });
    } else if (!this.producerVideo || this.producerVideo.closed) {
      console.info('INICIANDO');
      // if (!this.skipConsume) {
      //   await this.setVideoProducerIds();
      // }
      await this.producerVideoStart();
      await this.wssService.messageWithCallback('toggleDevice', {
        kind: 'video',
        action: 'resume',
      });
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
              appData: {
                mediaTag: 'audio',
                userId: this.userId,
              },
            });
            this.producerAudio.on('transportclose', () => {
              //DO SOMETHING
            });
          }
        }

        this.producerAudioStream = audioStream;
        if (started) {
          this.producerAudio.pause();
          this.targetProducerPause({
            userId: this.userId,
            kind: 'audio',
            isGlobal: false,
          });
        }
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Pause your audio stream
   */
  async producerAudioPause(userId: string): Promise<void> {
    try {
      if (this.producerAudio && !this.producerAudio.paused) {
        await this.targetProducerPause({
          userId: userId,
          kind: 'audio',
          isGlobal: false,
        });
        this.producerAudio.pause();
        await this.wssService.messageWithCallback('toggleDevice', {
          kind: 'audio',
          action: 'pause',
        });
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Unpause the transmission of your audio stream
   */
  async producerAudioResume(userId: string): Promise<void> {
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
        await this.targetProducerResume({
          userId: userId,
          kind: 'audio',
          isGlobal: false,
        });

        this.producerAudio.resume();
        await this.wssService.messageWithCallback('toggleDevice', {
          kind: 'audio',
          action: 'resume',
        });
      } else if (!this.producerAudio || this.producerAudio.closed) {
        // if (!this.skipConsume) {
        //   await this.setAudioProducersIds();
        // }
        await this.producerAudioStart();
        await this.wssService.messageWithCallback('toggleDevice', {
          kind: 'audio',
          action: 'resume',
        });
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
  async targetProducerPause(data: {
    userId: string;
    kind: TKind;
    isGlobal: boolean;
  }) {
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
   * @param data userId and stream type
   */
  async targetProducerResume(data: {
    userId: string;
    kind: TKind;
    isGlobal: boolean;
  }) {
    try {
      await this.wssService.requestMedia({
        action: 'producerResume',
        data,
      });
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Stop the user's stream (to resume the broadcast, this user will have to recreate the producer)
   * @param data userId and stream type
   */
  async targetProducerClose(data: {
    userId: string;
    kind: TKind;
    isScreenMedia: boolean;
  }) {
    try {
      await this.wssService.requestMedia({
        action: 'producerClose',
        data,
      });
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
      await this.wssService.requestMedia(
        // this._userId, this._sessionId,
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
  async allProducerResume(data: { kind: TKind }) {
    try {
      await this.wssService.requestMedia(
        // this._userId, this._sessionId,
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
  async allProducerClose(data: { kind: TKind }) {
    try {
      await this.wssService.requestMedia(
        // this._userId, this._sessionId,
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
        // this._userId, this._sessionId,
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
   * @param userId unique user identifier
   */
  async getProducerStats(kind: TKind, userId: string): Promise<any | void> {
    try {
      await this.wssService.requestMedia(
        // this._userId, this._sessionId,
        {
          action: 'getProducerStats',
          data: {
            kind,
            userId,
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
   * @param userId unique user identifier
   */
  async getConsumerStats(kind: TKind, userId: string): Promise<any | void> {
    try {
      await this.wssService.requestMedia(
        // this._userId, this._sessionId,
        {
          action: 'getConsumerStats',
          data: {
            kind,
            userId,
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
   * @param userId unique user identifier
   */
  async requestConsumerKeyFrame(userId: string): Promise<any | void> {
    try {
      await this.wssService.requestMedia(
        // this._userId, this._sessionId,
        {
          action: 'requestConsumerKeyFrame',
          data: {
            userId,
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
    const peer = this.consumers.get(id);
    let stream;
    if (peer) {
      if (peer.isScreenSharing) {
        stream = this.consumersScreenStream.get(id);
      } else {
        stream = this.consumersVideoStream.get(id);
      }
    }
    return stream;
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

  public globalToggleMedia(userId: string, kind: TKind) {
    const consumer = this.consumers.get(userId);
    let flag;
    if (consumer) {
      //console.warn(flag ? 'DESACTIVANDO' : 'ACTIVANDO', kind);
      switch (kind) {
        case 'video':
          flag = consumer.globalVideoEnabled;
          consumer.globalVideoEnabled = !consumer.globalVideoEnabled;
          break;
        case 'audio':
          flag = consumer.globalAudioEnabled;
          consumer.globalAudioEnabled = !consumer.globalAudioEnabled;
          break;
      }
      //console.warn(flag ? 'DESACTIVANDO' : 'ACTIVANDO', kind);
      if (flag) {
        this.targetProducerPause({
          userId: userId,
          kind: kind,
          isGlobal: true,
        });
      } else {
        this.targetProducerResume({
          userId: userId,
          kind: kind,
          isGlobal: true,
        });
      }
    }
  }

  public async startScreenShare(stream: MediaStream): Promise<void> {
    // if (!this.producerTransport) {
    //   this.createProducerTransport();
    // }

    const producer = await this.producerTransport.produce({
      track: stream.getVideoTracks()[0],
      appData: { mediaTag: 'screen-media', userId: this.userId },
    });

    console.log('SCREEN PRODUCER', producer);

    this.producerScreenMedia = producer;
    if (this.producerScreenMedia.track) {
      this.producerScreenMedia.track.onended = async () => {
        console.warn('SCREEN SHARING ENDED');
        await this.producerScreenMedia!.pause();
        await this.targetProducerClose({
          userId: this.userId,
          kind: 'video',
          isScreenMedia: true,
        });
        await this.producerScreenMedia!.close();
        // this.producerScreenMedia = undefined;
      };
    }
  }

  /**
   * Accept screen media stream from another user
   * @param userId userId from the user who transmits the video stream
   */
  private async consumerScreenMediaStart(userId: string): Promise<void> {
    const user = this.consumers.get(userId);
    if (user) {
      const { rtpCapabilities } = this.mediasoupDevice;
      const consumeData = await this.wssService.requestMedia({
        action: 'consume',
        data: {
          rtpCapabilities,
          userId,
          kind: 'video',
          appData: {
            mediaTag: 'screen-media',
          },
        },
      });

      const { id, producerId, kind, rtpParameters, producerPaused } =
        consumeData;
      const consumer: Consumer = await this.consumerTransport.consume({
        id,
        kind,
        rtpParameters,
        producerId,
      });

      consumer.on('transportclose', async () => {
        this.consumersScreen.delete(userId!);
        this.consumersScreenStream.delete(userId);
      });
      consumer.on('trackended', (val) => {
        console.log('screen track ended');
        if (user) {
          this.consumersScreen.delete(user.id);
          this.consumersScreenStream.delete(user.id);
        }
      });
      this.consumersScreen.set(userId, consumer);
      const { track } = consumer;
      const stream = new MediaStream([track]);
      this.consumersScreenStream.set(userId, stream);
      user.isScreenSharing = true;
    }
  }

  /**
   * Accept video stream from another user
   * @param userId userId from the user who transmits the video stream
   */
  private async consumerVideoStart(userId: string): Promise<void> {
    try {
      const { rtpCapabilities } = this.mediasoupDevice;
      const consumeData = await this.wssService.requestMedia({
        action: 'consume',
        data: {
          rtpCapabilities,
          userId,
          kind: 'video',
          appData: {
            mediaTag: 'video',
          },
        },
      });

      const { id, producerId, kind, rtpParameters, producerPaused } =
        consumeData;
      const consumer: Consumer = await this.consumerTransport.consume({
        id,
        kind,
        rtpParameters,
        producerId,
      });
      const user = this.consumers.get(userId);
      if (user) {
        user.producerVideoEnabled = !producerPaused;
      }
      // 'trackended' | 'transportclose'
      consumer.on('transportclose', async () => {
        this.consumersVideoStream.delete(userId!);
        this.consumersVideo.delete(userId!);
        if (user) {
          user.producerVideoEnabled = false;
          // this.consumers.set(userId, user);
          // this.consumer$.next(this.consumers);
        }
      });
      consumer.on('trackended', (val) => {
        console.warn('transportended', val);

        if (user) {
          user.producerVideoEnabled = false;
          // this.consumers.set(userId, user);
          // this.consumer$.next(this.consumers);
        }
      });
      const encodings = consumer.rtpParameters.encodings;
      if (encodings) {
        const { spatialLayers, temporalLayers } =
          mediasoupClient.parseScalabilityMode(encodings[0].scalabilityMode);
      }

      this.consumersVideo.set(userId, consumer);
      const { track } = consumer;
      const stream = new MediaStream([track]);
      this.consumersVideoStream.set(userId, stream);
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  /**
   * Accept audio stream from another user
   * @param userId userId from the user who transmits the audio
   */
  private async consumerAudioStart(userId: string): Promise<void> {
    // return;
    try {
      console.warn(`Request to consume ${userId} audio stream`);
      const { rtpCapabilities } = this.mediasoupDevice;
      const consumeData = await this.wssService.requestMedia({
        action: 'consume',
        data: {
          rtpCapabilities,
          userId,
          kind: 'audio',
          appData: {
            mediaTag: 'audio',
          },
        },
      });
      const { id, producerId, kind, rtpParameters, producerPaused } =
        consumeData;
      const consumer: Consumer = await this.consumerTransport.consume({
        id,
        kind,
        rtpParameters,
        producerId,
      });
      const user = this.consumers.get(userId);
      if (user) {
        user.producerAudioEnabled = !producerPaused;
        // this.consumers.set(userId, user);
        // this.consumer$.next(this.consumers);
      }
      consumer.on('transportclose', async () => {
        //console.warn(`Producer ${userId} audio stream transport closed`);
        if (user) {
          user.producerAudioEnabled = false;
          // this.consumers.set(userId, user);
          // this.consumer$.next(this.consumers);
        }
        this.consumersAudioStream.delete(userId);
        this.consumersAudio.delete(userId);
      });
      consumer.on('trackended', (val) => {
        user!.producerAudioEnabled = false;
        //console.warn('transportended', val);
        if (user) {
          user.producerAudioEnabled = false;
          // this.consumers.set(userId, user);
          // this.consumer$.next(this.consumers);
        }
      });
      this.consumersAudio.set(userId, consumer);
      console.info('Agregado consumer a consumers audio', this.consumersAudio);
      const { track } = consumer;
      const stream = new MediaStream([track]);
      this.consumersAudioStream.set(userId, stream);
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }

  public getConsumerByKey(key: string): IMemberIdentifier | undefined {
    return this.consumers.get(key);
  }

  public isConsumerScreenSharing(key: string): boolean {
    return !!this.consumers.get(key);
  }
}
