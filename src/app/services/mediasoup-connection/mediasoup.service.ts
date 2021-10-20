import * as mediasoupClient from 'mediasoup-client';
import { Device } from 'mediasoup-client';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { WssService } from './wss.service';
import {
  IMemberIdentifier,
  MeetingMemberDto,
  MeetingServiceType,
  MemberType,
  TPeer,
  TState,
} from '../../types/defines';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { NGXLogger } from 'ngx-logger';
import { Transport } from 'mediasoup-client/lib/Transport';
import { Consumer } from 'mediasoup-client/lib/Consumer';
import { TKind } from '../../types/defines';
import { Producer } from 'mediasoup-client/lib/Producer';
import { MeetingDataService } from '../meeting-data.service';
import { SfuConsumer } from '../../types/sfu-consumer.class';

@Injectable()
export class SfuWebrtcService {
  get producerScreenMedia(): Producer | undefined {
    return this._producerScreenMedia;
  }
  set producerScreenMedia(value: Producer | undefined) {
    this._producerScreenMedia = value;
  }

  get producerVideo(): Producer | undefined {
    return this._producerVideo;
  }
  set producerVideo(value: Producer | undefined) {
    this._producerVideo = value;
  }

  get producerAudio(): Producer | undefined {
    return this._producerAudio;
  }
  set producerAudio(value: Producer | undefined) {
    this._producerAudio = value;
  }

  get skipProduce(): boolean {
    return this._skipProduce;
  }
  set skipProduce(value: boolean) {
    this._skipProduce = value;
  }

  get audioOnly(): boolean {
    return this._audioOnly;
  }
  set audioOnly(value: boolean) {
    this._audioOnly = value;
  }

  get consumers(): Map<string, SfuConsumer> {
    return this._consumers;
  }
  set consumers(value: Map<string, SfuConsumer>) {
    this._consumers = value;
  }

  get wssService(): WssService {
    return this._wssService;
  }
  set wssService(value: WssService) {
    this._wssService = value;
  }

  get skipConsume(): boolean {
    return this._skipConsume;
  }
  set skipConsume(value: boolean) {
    this._skipConsume = value;
  }

  get localStream(): MediaStream | undefined {
    return this.meetingDataService.localStream;
  }
  get localMeetingMember(): MeetingMemberDto {
    return this.meetingDataService.meetingMember;
  }

  get consumerTransport(): Transport {
    return this._consumerTransport;
  }
  set consumerTransport(value: Transport) {
    this._consumerTransport = value;
  }
  get producerTransport(): Transport {
    return this._producerTransport;
  }
  set producerTransport(value: Transport) {
    this._producerTransport = value;
  }

  private _isConnectionReady = new BehaviorSubject<boolean>(false);
  private _localMeetingMember!: MeetingMemberDto;
  private _localStream!: MediaStream;
  private _wssService!: WssService;
  private _consumerTransport!: Transport;
  private _producerTransport!: Transport;
  private _skipConsume = false;
  private _skipProduce = false;
  private _consumers: Map<string, SfuConsumer> = new Map<string, SfuConsumer>();
  private _audioOnly = false;
  private mediasoupDevice: Device;
  private subscriptions: Subscription[] = [];
  private readonly PC_PROPRIETARY_CONSTRAINTS = {
    optional: [{ googDscp: true }],
  };
  private _producerScreenMedia: Producer | undefined;
  private _producerVideo: Producer | undefined;
  private _producerAudio: Producer | undefined;
  private _statsSummary: Record<string, any> = {};

  get statsSummary(): Record<string, any> {
    return this._statsSummary;
  }
  set statsSummary(value: Record<string, any>) {
    this._statsSummary = value;
  }
  initWssService(): void {
    this.wssService = new WssService(this.logger);
    this.wssService.setSocket(
      this.meetingDataService.meetingId,
      this.localMeetingMember._id!
    );
    const onConnection$ = this.wssService.onConnection().subscribe(async () => {
      this._isConnectionReady.next(true);
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
                reject({ msg: 'not consuming' });
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
                const peer = this.meetingDataService.meetingMembers.get(peerId);
                if (!peer) {
                  console.error('error', ' peer not initialized');
                  return;
                }
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
                    peer.sfuConsumerConnection.consumerScreen = consumer;
                    break;
                  case 'audio':
                    peer.sfuConsumerConnection.consumerAudio = consumer;
                    break;
                  case 'video':
                    peer.sfuConsumerConnection.consumerVideo = consumer;
                    break;
                }
                consumer.on('transportclose', () => {
                  //console.warn('transportclose', peerId);
                  consumer.close();
                  if (peer) {
                    switch (appData.mediaTag) {
                      case 'screen-media':
                        peer.sfuConsumerConnection.consumerScreen = undefined;
                        break;
                      case 'audio':
                        peer.sfuConsumerConnection.consumerAudio = undefined;
                        break;
                      case 'video':
                        peer.sfuConsumerConnection.consumerVideo = undefined;
                        break;
                    }
                  }
                });
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
                  if (!(peer && peer.produceVideoEnabled))
                    this.pauseConsumer(consumer);
                }
                if (appData.mediaTag === 'screen-media') {
                  peer.sfuConsumerConnection.consumerScreenStream =
                    new MediaStream([consumer.track]);
                }
              } catch (e) {
                reject({
                  error: e,
                });
              }
              break;
            }
          }
        }
      );
      /**
       * When a remote peer joins the meeting
       */
      const onMediaClientConnected$ = this.wssService
        .onMediaClientConnected()
        .subscribe(async (data) => {
          if (data.id !== this.localMeetingMember._id) {
            await this.wssService.requestHandshake({
              target: data.id,
              kind: this.localMeetingMember.memberType,
            });
            const consumer = this.consumers.get(data.id);
            if (!consumer) {
              this.consumers.set(data.id, new SfuConsumer());
            }
            if (data.kind === 'consumer') {
              if (data.isScreenSharing) {
                this.consumerScreenMediaStart(data.id);
              }
              if (data.produceAudioEnabled && data.produceAudioAllowed) {
                this.consumerAudioStart(data.id);
              }
              if (data.produceVideoEnabled && data.produceVideoAllowed) {
                this.consumerVideoStart(data.id);
              }
            }
          }
        });

      /**
       * When a remote peer leaves the meeting
       */
      const onMediaClientDisconnect$ = this.wssService
        .onMediaClientDisconnect()
        .subscribe(async (data) => {
          const consumer = this.consumers.get(data.id);
          if (consumer) {
            if (consumer.consumerVideo) {
              consumer.consumerVideo.close();
            }
            if (consumer.consumerAudio) {
              consumer.consumerAudio.close();
            }
            if (consumer.consumerScreen) {
              consumer.consumerScreen.close();
            }
            this.consumers.delete(data.id);
          }
        });
      /**
       * When a remote peer that is streaming video or audio enable or disable its media feed
       */
      const onProducerMediaDeviceToggle$ = this.wssService
        .onProducerMediaDeviceToggle()
        .subscribe(async (payload: any) => {
          const consumer = this.consumers.get(payload.sender);
          if (consumer) {
            switch (payload.kind as TKind) {
              case 'audio':
                if (payload.action === 'pause' && consumer.consumerAudio) {
                  consumer.consumerAudio.pause();
                } else if (
                  payload.action === 'resume' &&
                  consumer.consumerAudio
                ) {
                  consumer.consumerAudio.resume();
                }
                break;
              case 'video':
                if (payload.action === 'pause' && consumer.consumerVideo) {
                  consumer.consumerVideo.pause();
                } else if (
                  payload.action === 'resume' &&
                  consumer.consumerVideo
                ) {
                  consumer.consumerVideo.resume();
                }
                break;
            }
          }
        });

      /**
       *  When a remote peer starts to produce media
       */
      const onMediaProduce$ = this.wssService
        .onMediaProduce()
        .subscribe(async (data: { userId: string; kind: TKind }) => {
          const member = this.meetingDataService.meetingMembers.get(
            data.userId
          );
          if (member) {
            if (
              this.meetingDataService.hasSFUFullConnection ||
              member.hasSFUConnection
            ) {
              switch (data.kind) {
                case 'audio':
                  await this.consumerAudioStart(data.userId);
                  break;
                case 'video':
                  await this.consumerVideoStart(data.userId);
                  break;
              }
            }
          }
        });

      /**
       * When the local peer needs to reconnect the stream
       */
      const onMediaReproduce$ = this.wssService
        .onMediaReproduce()
        .subscribe(async (data: any) => {
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
      const onMediaProducerPause$ = this.wssService
        .onMediaProducerPause()
        .subscribe(async (data: any) => {
          console.log('mediaProducerResume', data);
          const consumer = this.consumers.get(data.userId);
          if (consumer) {
            let media;
            switch (data.mediaTag as TKind) {
              case 'video':
                media = consumer.consumerVideo;
                break;
              case 'audio':
                media = consumer.consumerVideo;
                break;
            }
            if (media) {
              media.pause();
            }
          }
        });
      /**
       * When a remote peer unpauses its stream
       */
      const onMediaProducerResume$ = this.wssService
        .onMediaProducerResume()
        .subscribe(async (data: any) => {
          console.log('mediaProducerResume', data);
          const consumer = this.consumers.get(data.userId);
          let media;
          if (consumer) {
            switch (data.mediaTag as TKind) {
              case 'video':
                media = consumer.consumerVideo;
                break;
              case 'audio':
                media = consumer.consumerAudio;
                break;
            }
            if (media) {
              media.resume();
            }
          }
        });
      /**
       * When a remote peer closes its stream
       */
      const onMediaProducerClose$ = this.wssService
        .onMediaProducerClose()
        .subscribe(async (data: any) => {
          console.log('mediaProducerClose', data);
          let media;
          const consumer = this.consumers.get(data.userId);
          if (consumer) {
            switch (data.mediaTag) {
              case 'screen-media':
                media = consumer.consumerScreen;
                break;
              case 'video':
                media = consumer.consumerVideo;
                break;
              case 'audio':
                media = consumer.consumerAudio;
                break;
            }
            if (media) {
              media.close();
              switch (data.mediaTag) {
                case 'screen-media':
                  consumer.consumerScreen = undefined;
                  break;
                case 'video':
                  consumer.consumerVideo = undefined;
                  break;
                case 'audio':
                  consumer.consumerAudio = undefined;
                  break;
              }
            }
          }
        });
      /**
       *  When the room was replaced by a worker and you want to reconnect mediasoup
       */
      const onMediaReconfigure$ = this.wssService
        .onMediaReconfigure()
        .subscribe(async (data: any) => {
          console.log('mediaReconfigure', data);
          try {
            await this.load(true);
            await this.producerAudioStart();
            await this.producerVideoStart();
          } catch (error) {
            console.error(error.message, error.stack);
          }
        });

      this.subscriptions.push(
        onMediaClientConnected$,
        onMediaClientDisconnect$,
        onMediaProduce$,
        onProducerMediaDeviceToggle$,
        onMediaReproduce$,
        onMediaProducerPause$,
        onMediaProducerResume$,
        onMediaProducerClose$,
        onMediaReconfigure$
      );
    });
    this.subscriptions.push(onConnection$);
  }
  constructor(
    private logger: NGXLogger,
    private meetingDataService: MeetingDataService
  ) {
    this.mediasoupDevice = new mediasoupClient.Device({});
  }

  async joinRoom(
    meetingMember: MeetingMemberDto,
    skipConsume: boolean
  ): Promise<void> {
    this.skipConsume = skipConsume;
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
    // if (!this.skipConsume) {
    //   const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    //   const audioTrack = stream.getAudioTracks()[0];
    //   audioTrack.enabled = false;
    //   setTimeout(() => audioTrack.stop(), 120000);
    // }
    if (meetingMember.memberType === MemberType.CONSUMER) {
      this.skipProduce = true;
    } else {
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
  }

  async initMediaProduction(): Promise<void> {
    Promise.all([this.producerAudioStart(), this.producerVideoStart()]);
  }

  handleJoinedPeers = async (res: {
    id: string;
    peersInfo: IMemberIdentifier[];
  }) => {
    console.warn('CONSUMERS', res.peersInfo);
    for (const peersInfoElement of res.peersInfo) {
      console.error('IMember', peersInfoElement);
      // this.consumers.set(peersInfoElement.id, new SfuConsumer());
      const member = this.meetingDataService.meetingMembers.get(
        peersInfoElement.id
      );
      if (!this.skipConsume && member) {
        if (peersInfoElement.isScreenSharing) {
          this.consumerScreenMediaStart(peersInfoElement.id);
        }
        this.consumerVideoStart(peersInfoElement.id);
        this.consumerAudioStart(peersInfoElement.id);
      }
    }
  };

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
  async load(skipConsume = false) {
    this.skipConsume = !skipConsume;
    try {
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
  public onConnectionReady(): Observable<boolean> {
    return this._isConnectionReady.asObservable();
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
      const { id, iceParameters, iceCandidates, dtlsParameters } = data;
      this.producerTransport = this.mediasoupDevice.createSendTransport({
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters,
        iceServers: [],
        proprietaryConstraints: this.PC_PROPRIETARY_CONSTRAINTS,
      });
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
            .requestMedia({
              action: 'connectWebRtcTransport',
              data: {
                dtlsParameters,
                transportId: this.consumerTransport.id,
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

  /**
   * Start sending your audio stream
   */
  private async producerAudioStart(): Promise<void> {
    if (this.skipProduce) {
      return;
    }
    if (this.mediasoupDevice.canProduce('audio')) {
      if (this.localStream) {
        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const audioTrack = audioTracks[0];
          if (this.producerTransport && !this.producerTransport.closed) {
            this._producerAudio = await this.producerTransport.produce({
              track: audioTrack,
              disableTrackOnPause:
                this.localMeetingMember.connectionType !==
                MeetingServiceType.MESH,
              zeroRtpOnPause: true,
              stopTracks: false,
              appData: {
                mediaTag: 'audio',
                userId: this.localMeetingMember._id!,
              },
            });
            this._producerAudio.on('transportclose', () => {
              console.warn('Audio transport closed');
            });
            if (this.localMeetingMember.produceAudioEnabled) {
              this._producerAudio.pause();
              this.targetProducerPause({
                kind: 'audio',
                userId: this.localMeetingMember._id!,
                isGlobal: false,
              });
            }
          }
        }
      }
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
    if (
      !this.meetingDataService.meetingMember.produceAudioEnabled &&
      !this.meetingDataService.meetingMember.produceAudioAllowed
    ) {
      return;
    }
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
  private async producerAudioClose(): Promise<void> {
    try {
      if (this.producerAudio && !this.producerAudio.closed) {
        this.producerAudio.close();
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }
  /**
   * Start sending your video stream
   */
  private async producerVideoStart(): Promise<void> {
    if (
      this.skipProduce &&
      !this.meetingDataService.meetingMember.produceVideoEnabled
    ) {
      return;
    }
    console.warn('producer video start');
    if (this.mediasoupDevice.canProduce('video')) {
      if (this.localStream) {
        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length > 0) {
          const videoTrack = videoTracks[0];
          if (this.producerTransport && !this.producerTransport.closed) {
            if (this.producerVideo && !this.producerVideo.closed) {
              if (this.meetingDataService.meetingMember.produceVideoEnabled) {
                await this.producerVideoResume(
                  this.meetingDataService.meetingMember._id!
                );
              }
              return;
            }

            this.producerVideo = await this.producerTransport.produce({
              track: videoTrack,
              disableTrackOnPause:
                this.localMeetingMember.connectionType !==
                MeetingServiceType.MESH,
              zeroRtpOnPause: true,
              stopTracks: false,
              encodings:
                environment.mediasoupClient.configuration
                  .camVideoSimulcastEncodings,
              codecOptions: {
                videoGoogleStartBitrate: 1000,
              },
              appData: {
                mediaTag: 'video',
                userId: this.localMeetingMember._id!,
              },
            });
            this.producerVideo.on('transportclose', () => {
              console.warn('Video transport closed');
            });
            if (!this.localMeetingMember.produceVideoEnabled) {
              console.warn('paused producer');
              this.producerVideo.pause();
              this.targetProducerPause({
                kind: 'video',
                userId: this.localMeetingMember._id!,
                isGlobal: false,
              });
            } else {
              this.getStats();
            }
          }
        }
      }
    }
  }

  /**
   * Pause your video stream
   */
  async producerVideoPause(userId: string): Promise<void> {
    if (this.skipProduce || !this.meetingDataService.hasOneSFUConnection) {
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
    console.log('here too');
    if (this.skipProduce || !this.meetingDataService.hasOneSFUConnection) {
      return;
    }
    if (
      this.producerVideo &&
      this.producerVideo.paused &&
      !this.producerVideo.closed
    ) {
      if (this.localStream) {
        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length > 0) {
          this.producerVideo.replaceTrack({ track: videoTracks[0] });
        }
      }
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
      this.getStats();
    } else if (!this.producerVideo || this.producerVideo.closed) {
      await this.producerVideoStart();
      await this.wssService.messageWithCallback('toggleDevice', {
        kind: 'video',
        action: 'resume',
      });
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
   * Pauses the user stream
   */
  private async targetProducerPause(data: {
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
  private async targetProducerResume(data: {
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
  private async targetProducerClose(data: {
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

  /**
   * Start receiving remote peer screen stream
   * @param meetingMemberId  type string, id from the user who transmits the display video stream
   * @private
   */
  private async consumerScreenMediaStart(meetingMemberId: string) {
    const member = this.consumers.get(meetingMemberId);
    if (member) {
      try {
        const { rtpCapabilities } = this.mediasoupDevice;
        const consumeData = await this.wssService.requestMedia({
          action: 'consume',
          data: {
            rtpCapabilities,
            userId: meetingMemberId,
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
          if (member.consumerScreen && !member.consumerScreen.closed) {
            member.consumerScreen.close();
          }
          member.consumerScreenStream = undefined;
          member.consumerScreen = undefined;
        });
        consumer.on('trackended', () => {
          console.warn(
            'trackended',
            `consumer ${consumer.appData.mediaTag} for member ${meetingMemberId}`
          );
          member.consumerScreenStream = undefined;
        });
        if (!(member.consumerScreen && !member.consumerScreen.closed)) {
          member.consumerScreen = consumer;
          const { track } = consumer;
          const meetingMember =
            this.meetingDataService.meetingMembers.get(meetingMemberId);
          // if (meetingMember) {
          //   meetingMember.screenStream = new MediaStream([track]);
          // }
          member.consumerScreenStream = new MediaStream([track]);
        }
      } catch (e) {
        console.error(e.message, e.stack);
      }
    }
  }

  /**
   * Start receiving remote peer video stream
   * @param meetingMemberId type string, id from the user who transmits the video stream
   * @private
   */
  async consumerVideoStart(meetingMemberId: string) {
    try {
      console.warn('consumervideostart');
      const { rtpCapabilities } = this.mediasoupDevice;
      const consumeData = await this.wssService.requestMedia({
        action: 'consume',
        data: {
          rtpCapabilities,
          userId: meetingMemberId,
          kind: 'video',
          appData: {
            mediaTag: 'video',
          },
        },
      });
      const { id, producerId, kind, rtpParameters, producerPaused, appData } =
        consumeData;
      const consumer: Consumer = await this.consumerTransport.consume({
        id,
        kind,
        rtpParameters,
        producerId,
      });
      const member =
        this.meetingDataService.meetingMembers.get(meetingMemberId);
      console.warn('consumer video start', member);
      if (member) {
        consumer.on('transportclose', async () => {
          //console.warn(`Producer ${userId} audio stream transport closed`);
          if (member) {
            member.sfuConsumerConnection.consumerVideo = undefined;
          }
        });
        consumer.on('trackended', () => {
          console.warn(
            'trackended',
            `consumer ${consumer.kind} for member ${meetingMemberId}`
          );
        });
        consumer.on('close', () => {
          console.warn(
            'close',
            `consumer ${consumer.kind} for member ${meetingMemberId}`
          );
        });

        if (
          !(
            member.sfuConsumerConnection.consumerVideo &&
            !member.sfuConsumerConnection.consumerVideo.closed
          )
        ) {
          member.sfuConsumerConnection.consumerVideo = consumer;
        }
        const { track } = consumer;
        console.log('consume video start', track);

        member.sfuConsumerConnection.consumerVideoStream = new MediaStream([
          track,
        ]);

        console.warn('set member videostream');
        member.videoStream = member.sfuConsumerConnection.consumerVideoStream;
        member.sfuConsumerConnection.videoReady = true;
        if (member.p2pConsumerConnection) {
          member.p2pConsumerConnection.videoReady = false;
          member.p2pConsumerConnection.closed = true;
          member.p2pConsumerConnection.remoteVideoTrack
            .getTracks()
            .forEach((track) => {
              track.stop();
            });
          member.p2pConsumerConnection.rtcPeerConnection.close();
        }

        member.connectionType = MeetingServiceType.SFU;
      }
    } catch (e) {
      console.error(e.message, e.stack);
    }
  }
  /**
   * Start receiving remote peer audio stream.
   * @param meetingMemberId type string, id from the user who transmits the video stream
   * @private
   */
  async consumerAudioStart(meetingMemberId: string) {
    try {
      const { rtpCapabilities } = this.mediasoupDevice;
      const consumeData = await this.wssService.requestMedia({
        action: 'consume',
        data: {
          rtpCapabilities,
          userId: meetingMemberId,
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
      const member = this.consumers.get(meetingMemberId);
      consumer.on('transportclose', async () => {
        //console.warn(`Producer ${userId} audio stream transport closed`);
        if (member) {
          if (member.consumerAudio && !member.consumerAudio.closed) {
            member.consumerAudio.close();
          }
          member.consumerAudio = undefined;
        }
      });
      consumer.on('trackended', () => {
        console.warn(
          'trackended',
          `consumer ${consumer.kind} for member ${meetingMemberId}`
        );
      });
      if (member) {
        if (!(member.consumerAudio && !member.consumerAudio.closed)) {
          member.consumerAudio = consumer;
        }
        const { track } = consumer;
        const meetingMember =
          this.meetingDataService.meetingMembers.get(meetingMemberId);
        // if (meetingMember) {
        //   meetingMember.audioStream = new MediaStream([track]);
        // }
        member.consumerAudioStream = new MediaStream([track]);
      }
    } catch (e) {
      console.error(e.message, e.stack);
    }
  }

  /**
   * Pauses the given consumer stream
   * @param consumer Consumer type
   * @private
   */
  private async pauseConsumer(consumer: Consumer) {
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
      console.error(e.name, `Error pausing Consumer ${e}`);
    }
  }
  /**
   * Resumes the given consumer stream
   * @param consumer Consumer type
   * @private
   */
  private async resumeConsumer(consumer: Consumer) {
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
      console.error(e.name, `Error resuming Consumer ${e}`);
    }
  }

  /**
   * Closes the given consumer stream. For re enable transmission, you need to recreate the consumer.
   * @param consumer Consumer type
   * @private
   */
  private async closeConsumer(consumer: Consumer) {
    if (!consumer.closed) {
      return;
    }
    try {
      await this.wssService.messageWithCallback('closeConsumer', {
        appData: consumer.appData,
        kind: consumer.kind,
      });
      consumer.close();
    } catch (e) {
      console.error(e.name, `Error resuming Consumer ${e}`);
    }
  }

  /**
   * Enable or disable media transmission, audio or video, on the server side.
   * @param meetingMemberId string, id of the meeting member to whom the action will be performed
   * @param kind type TKind, audio or video
   */
  public globalToggleMedia(meetingMemberId: string, kind: TKind) {
    const consumer = this.consumers.get(meetingMemberId);
    const meetingMember =
      this.meetingDataService.meetingMembers.get(meetingMemberId);
    let flag;
    if (consumer && meetingMember) {
      //console.warn(flag ? 'DESACTIVANDO' : 'ACTIVANDO', kind);
      switch (kind) {
        case 'video':
          flag = meetingMember.produceVideoAllowed;
          break;
        case 'audio':
          flag = meetingMember.produceAudioAllowed;
          break;
      }
      if (flag) {
        this.targetProducerPause({
          userId: meetingMemberId,
          kind: kind,
          isGlobal: true,
        });
      } else {
        this.targetProducerResume({
          userId: meetingMemberId,
          kind: kind,
          isGlobal: true,
        });
      }
    }
  }

  /**
   * Starts screen transmition to the SFU server
   * @param stream
   */
  public async startScreenShare(stream: MediaStream): Promise<void> {
    // if (!this.producerTransport) {
    //   this.createProducerTransport();
    // }
    const producer = await this.producerTransport.produce({
      track: stream.getVideoTracks()[0],
      appData: {
        mediaTag: 'screen-media',
        userId: this.meetingDataService.meetingMember._id!,
      },
    });
    this.producerScreenMedia = producer;
    if (this.producerScreenMedia.track) {
      this.producerScreenMedia.track.onended = async () => {
        console.warn('SCREEN SHARING ENDED');
        await this.producerScreenMedia!.pause();
        await this.targetProducerClose({
          userId: this.meetingDataService.meetingMember._id!,
          kind: 'video',
          isScreenMedia: true,
        });
        await this.producerScreenMedia!.close();
      };
    }
  }
  onDestroy(): void {
    this.leaveSfuSession();
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
    this.subscriptions = [];
  }
  // setMeetingMemberVideoStream(meetingMemberId: string) {
  //   const meetingMember =
  //     this.meetingDataService.meetingMembers.get(meetingMemberId);
  //
  //   const consumer = this.consumers.get(meetingMemberId);
  //   if (meetingMember && consumer) {
  //     console.log('timestamp', Date.now());
  //     meetingMember.videoStream = consumer.consumerVideoStream;
  //   }
  // }
  // setMeetingMemberAudioStream(meetingMemberId: string) {
  //   const meetingMember =
  //     this.meetingDataService.meetingMembers.get(meetingMemberId);
  //   const consumer = this.consumers.get(meetingMemberId);
  //   if (meetingMember && consumer) {
  //     console.log('timestamp', Date.now());
  //     meetingMember.videoStream = consumer.consumerAudioStream;
  //   }
  // }
  async leaveSfuSession() {
    // this.consumers.forEach((consumer) => {
    //   consumer.consumerVideo?.close();
    //   consumer.consumerAudio?.close();
    //   consumer.consumerScreen?.close();
    //   consumer.consumerAudioStream = undefined;
    //   consumer.consumerVideoStream = undefined;
    //   consumer.consumerScreenStream = undefined;
    //   consumer.consumerAudio = undefined;
    //   consumer.consumerVideo = undefined;
    //   consumer.consumerScreen = undefined;
    // });
    // this.consumerTransport?.close();
    // this.producerAudioPause(this.localMeetingMember._id!);
    // this.producerVideoPause(this.localMeetingMember._id!);
  }

  async getStats() {
    this.producerVideo?.getStats().then((stats) => {
      const summary: Record<string, any> = {};
      stats.forEach((report) => {
        switch (report.type as RTCStatsType) {
          case 'transport':
            console.warn(report.type, report);
            summary[report.type] = {
              bytesSent: report.bytesSent,
              bytesReceived: report.bytesReceived,
              packetsSent: report.packetsSent,
              packetsReceived: report.packetsReceived,
              timestamp: report.timestamp,
            };
            break;
          case 'remote-inbound-rtp':
            console.warn(report.type, report);
            summary[report.kind] = {
              ...summary[report.kind],
              send: {
                fractionLost: report.fractionLost,
                jitter: report.jitter,
                packetsLost: report.packetsLost,
                timestamp: report.timestamp,
              },
            };

            break;
          case 'inbound-rtp':
            console.warn(report.type, report);
            summary[report.mediaType] = {
              ...summary[report.mediaType],
              bytesReceived: report.bytesReceived,
            };
            break;
          case 'outbound-rtp':
            summary[report.kind] = {
              ...summary[report.kind],
              bytesSent: report.bytesSent,
              packetsSent: report.packetsSent,
              qualityLimitationReason: report.qualityLimitationReason,
              totalEncodedTime: report.totalEncodedTime,
              timestamp: report.timestamp,
            };
            if (report.kind === 'video') {
              summary[report.kind].firCount = report.firCount;
              summary[report.kind].pliCount = report.pliCount;
              summary[report.kind].qpSum = report.qpSum;
            }
            console.warn(report.type, report);
            break;
          case 'sender':
            console.warn(report.type, report);
            break;
          case 'receiver':
            console.warn(report.type, report);
            break;
        }
      });
      if (Object.keys(this.statsSummary).length == 0) {
        console.log(`there isn't stats summary`);
      } else {
        console.log(this.statsSummary.video);
        console.log(summary.video);
        if (this.statsSummary.video && summary.video) {
          const diff =
            (summary.video.timestamp - this.statsSummary.video.timestamp) /
            1000;
          const diffBytesSent =
            (summary.video.bytesSent - this.statsSummary.video.bytesSent) /
            1024;
          console.log('diff', diff, diffBytesSent);
          const outboundVideoBitrate = (8 * diffBytesSent) / diff;
          summary.video['outboundVideoBitrate'] = outboundVideoBitrate;
        }
      }
      this.statsSummary = summary;
      console.warn('summary', summary);
    });
    return;
  }
}
