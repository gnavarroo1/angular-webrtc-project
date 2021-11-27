import * as mediasoupClient from 'mediasoup-client';
import { Device } from 'mediasoup-client';
import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { WssService } from './wss.service';
import {
  AudioConsumerStats,
  ConsumerMediaStats,
  ConsumerStatsSnapshot,
  IMemberIdentifier,
  IPeerStat,
  MeetingMemberDto,
  MeetingServiceType,
  MemberType,
  ProducerStatsSnapshot,
  SfuStatsSnapshot,
  TKind,
  TPeer,
  TState,
  VideoConsumerStats,
} from '../../types/defines';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { NGXLogger } from 'ngx-logger';
import { Transport } from 'mediasoup-client/lib/Transport';
import { Consumer } from 'mediasoup-client/lib/Consumer';
import { Producer } from 'mediasoup-client/lib/Producer';
import { MeetingDataService } from '../meeting-data.service';
import { MeetingMember } from '../../types/meeting-member.class';
import Swal from 'sweetalert2';

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

  // get consumers(): Map<string, SfuConsumer> {
  //   return this._consumers;
  // }
  // set consumers(value: Map<string, SfuConsumer>) {
  //   this._consumers = value;
  // }
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
  private _wssService!: WssService;
  private _consumerTransport!: Transport;
  private _producerTransport!: Transport;
  private _skipConsume = false;
  private _skipProduce = false;
  // private _consumers: Map<string, SfuConsumer> = new Map<string, SfuConsumer>();
  private _audioOnly = false;
  private mediasoupDevice: Device;
  private subscriptions: Subscription[] = [];
  private readonly PC_PROPRIETARY_CONSTRAINTS = {
    optional: [{ googDscp: true }],
  };
  private _producerScreenMedia: Producer | undefined;
  private _producerVideo: Producer | undefined;
  private _producerAudio: Producer | undefined;
  private _statsSummary: SfuStatsSnapshot = {};
  private onLeaving = false;
  get statsSummary(): SfuStatsSnapshot {
    return this._statsSummary;
  }
  set statsSummary(value: SfuStatsSnapshot) {
    this._statsSummary = value;
  }
  initWssService(): void {
    this.wssService = new WssService();
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
                    // console.log(consumer.kind);
                    peer.sfuConsumerConnection.consumerScreen = consumer;
                    break;
                  case 'audio':
                    if (consumer.kind === 'audio')
                      peer.sfuConsumerConnection.consumerAudio = consumer;
                    break;
                  case 'video':
                    peer.sfuConsumerConnection.consumerVideo = consumer;
                    break;
                }
                consumer.on('transportclose', () => {
                  //console.warn('transportclose', peerId);
                  // consumer.close();
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
                if (appData.mediaTag === 'screen-media') {
                  peer.sfuConsumerConnection.consumerScreenStream =
                    new MediaStream([consumer.track]);
                  this.meetingDataService.screenStream =
                    peer.sfuConsumerConnection.consumerScreenStream;
                }
                if (!peer.hasSFUConnection) {
                  await this.consumerVideoPause(peer);
                  await this.consumerAudioPause(peer);
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
            const consumer = this.meetingDataService.meetingMembers.get(
              data.id
            );
            if (consumer) {
              if (data.kind === 'CONSUMER') {
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
          }
        });

      /**
       * When a remote peer leaves the meeting
       */
      const onMediaClientDisconnect$ = this.wssService
        .onMediaClientDisconnect()
        .subscribe(async (data) => {
          const member = this.meetingDataService.meetingMembers.get(data.id);
          if (member) {
            const consumer = member.sfuConsumerConnection;
            if (consumer.consumerVideo) {
              consumer.consumerVideo.close();
            }
            if (consumer.consumerAudio) {
              consumer.consumerAudio.close();
            }
            if (consumer.consumerScreen) {
              consumer.consumerScreen.close();
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
            if (member.hasSFUConnection) {
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
                this.producerAudioStart(true);
                break;
              case 'video':
                this.producerVideoStart(true);
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
          // console.log('mediaProducerPause', data);
          const consumer = this.meetingDataService.meetingMembers.get(
            data.userId
          );
          if (consumer && consumer.hasSFUConnection) {
            switch (data.mediaTag as TKind) {
              case 'video':
                this.consumerVideoPause(consumer);
                break;
              case 'audio':
                this.consumerAudioPause(consumer);
                break;
            }
          }
        });
      /**
       * When a remote peer unpauses its stream
       */
      const onMediaProducerResume$ = this.wssService
        .onMediaProducerResume()
        .subscribe(async (data: any) => {
          // console.log('mediaProducerResume', data);
          const member = this.meetingDataService.meetingMembers.get(
            data.userId
          );
          if (member) {
            let media;
            switch (data.mediaTag as TKind) {
              case 'video':
                media = member.sfuConsumerConnection?.consumerVideo;
                break;
              case 'audio':
                media = member.sfuConsumerConnection?.consumerAudio;
                break;
            }
            if (media) {
              console.warn(
                ` producer ${media.kind} of user ${member.id} has resumed`
              );
              if (
                member.hasSFUConnection ||
                this.localMeetingMember.connectionType === 'SFU'
              ) {
                if (data.mediaTag === 'video') {
                  await this.consumerVideoResume(member);
                  member.sfuConsumerConnection.consumerVideoTrack = media.track;
                  member.videoStream = new MediaStream([media.track]);
                } else if (data.mediaTag === 'audio') {
                  await this.consumerAudioResume(member);
                  member.sfuConsumerConnection.consumerAudioTrack = media.track;
                  member.audioStream = new MediaStream([media.track]);
                }
                if (media.paused) {
                  media.resume();
                  if (!media.track.enabled) {
                    media.track.enabled = true;
                  }
                }
              }
            } else {
              switch (data.mediaTag as TKind) {
                case 'video':
                  this.consumerVideoStart(data.userId);
                  break;
                case 'audio':
                  this.consumerAudioStart(data.userId);
                  break;
              }
            }
          }
        });
      /**
       * When a remote peer closes its stream
       */
      const onMediaProducerClose$ = this.wssService
        .onMediaProducerClose()
        .subscribe(async (data: any) => {
          // console.log('mediaProducerClose', data);
          let media;
          const member = this.meetingDataService.meetingMembers.get(
            data.userId
          );
          if (member) {
            const consumer = member.sfuConsumerConnection;
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
          // console.log('mediaReconfigure', data);
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
        // onProducerMediaDeviceToggle$,
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
    const device = mediasoupClient.detectDevice();
    this.mediasoupDevice = new mediasoupClient.Device({ handlerName: device });
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
      // console.warn('SETTING RTPCAPABILITIES');
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
      meetingMember.memberType === MemberType.CONSUMER
        ? 'CONSUMER'
        : 'PRODUCER';
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

  async initMediaProduction(force = false): Promise<void> {
    Promise.all([
      this.producerAudioStart(force),
      this.producerVideoStart(force),
    ]);
  }
  handleJoinedPeers = async (res: {
    id: string;
    peersInfo: IMemberIdentifier[];
  }) => {
    for (const peersInfoElement of res.peersInfo) {
      const member = this.meetingDataService.meetingMembers.get(
        peersInfoElement.id
      );
      if (member) {
        if (!this.skipConsume) {
          if (peersInfoElement.isScreenSharing) {
            this.consumerScreenMediaStart(peersInfoElement.id);
          }
          this.consumerVideoStart(peersInfoElement.id);
          this.consumerAudioStart(peersInfoElement.id);
        }
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
        await this.mediasoupDevice.load({ routerRtpCapabilities });
        {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          const audioTrack = stream.getAudioTracks()[0];
          audioTrack.enabled = false;
          setTimeout(() => audioTrack.stop(), 120000);
        }
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
        data: { type: 'PRODUCER' },
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
          this.wssService
            .requestMedia({
              action: 'connectWebRtcTransport',
              data: { dtlsParameters, type: 'PRODUCER' },
            })
            .then(callback)
            .catch(errback);
        }
      );
      this.producerTransport.on(
        'produce',
        async ({ kind, rtpParameters, appData }, callback, errback) => {
          try {
            const { id } = await this.wssService.requestMedia({
              action: 'produce',
              data: {
                producerTransportId: this.producerTransport.id,
                kind,
                rtpParameters,
                appData: {
                  ...appData,
                },
              },
            });
            callback({ id });
          } catch (e) {
            errback(e);
          }
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
        data: { type: 'CONSUMER' },
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
                type: 'CONSUMER',
              },
            })
            .then(callback)
            .catch((err) => {
              console.error(err);
              errback(err);
            });
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
  private async producerAudioStart(force = false): Promise<void> {
    if (this.skipProduce) {
      return;
    }
    if (this.producerAudio && !this.producerAudio.closed) {
      if (
        this.producerAudio.paused &&
        this.meetingDataService.meetingMember.produceAudioEnabled &&
        this.meetingDataService.meetingMember.produceAudioAllowed &&
        (this.meetingDataService.hasOneSFUConnection || force)
      ) {
        this.producerAudioResume(
          this.meetingDataService.meetingMember._id!,
          force
        );
      }
      return;
    }

    if (this.mediasoupDevice.canProduce('audio')) {
      if (this.localStream) {
        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const audioTrack = audioTracks[0];

          if (this.producerTransport && !this.producerTransport.closed) {
            if (this.producerAudio && !this.producerAudio.closed) {
              if (this.meetingDataService.meetingMember.produceAudioEnabled) {
                await this.producerAudioResume(
                  this.meetingDataService.meetingMember._id!
                );
              }
              return;
            }

            this.producerAudio = await this.producerTransport.produce({
              track: audioTrack,
              codecOptions: {
                opusStereo: true,
                opusDtx: true,
              },
              disableTrackOnPause: false,
              zeroRtpOnPause: true,
              appData: {
                mediaTag: 'audio',
                userId: this.localMeetingMember._id!,
              },
            });
            this.producerAudio.on('transportclose', () => {
              // console.warn('Audio transport closed');
            });
            if (!this.localMeetingMember.produceAudioEnabled) {
              this.producerAudio.pause();
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
    console.warn('producer audio pause');
    if (this.skipProduce) {
      return;
    }
    try {
      if (this.producerAudio && !this.producerAudio.paused) {
        this.producerAudio.pause();
        await this.targetProducerPause({
          userId: userId,
          kind: 'audio',
          isGlobal: false,
        });
      }
    } catch (error) {
      console.error(error.message, error.stack);
    }
  }
  /**
   * Unpause the transmission of your audio stream
   */
  async producerAudioResume(userId: string, force = false): Promise<void> {
    console.warn('producer audio resume');
    if (
      !this.meetingDataService.meetingMember.produceAudioEnabled &&
      !this.meetingDataService.meetingMember.produceAudioAllowed
    ) {
      return;
    }
    if (
      (this.skipProduce || !this.meetingDataService.hasOneSFUConnection) &&
      !force
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
      } else if (!this.producerAudio || this.producerAudio.closed) {
        await this.producerAudioStart();
      } else {
        console.error('error producer resume');
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
  private async producerVideoStart(force = false): Promise<void> {
    if (this.skipProduce) {
      return;
    }
    if (this.producerVideo && !this.producerVideo.closed) {
      if (
        this.producerVideo.paused &&
        this.meetingDataService.meetingMember.produceVideoEnabled &&
        this.meetingDataService.meetingMember.produceVideoAllowed &&
        (this.meetingDataService.hasOneSFUConnection || force)
      ) {
        await this.producerVideoResume(
          this.meetingDataService.meetingMember._id!,
          force
        );
      }
      return;
    }
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
            disableTrackOnPause: false,
            zeroRtpOnPause: true,
            encodings: [
              {
                maxBitrate: 720000,
                scaleResolutionDownBy: 2,
              },
              {
                maxBitrate: 1572864,
                scaleResolutionDownBy: 1,
              },
            ],
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
            this.producerVideo.pause();
            this.targetProducerPause({
              kind: 'video',
              userId: this.localMeetingMember._id!,
              isGlobal: false,
            });
          }
        }
      }
    }
    // if (this.mediasoupDevice.canProduce('video')) {
    //
    // }
  }

  /**
   * Pause your video stream
   */
  async producerVideoPause(userId: string): Promise<void> {
    console.warn('producer video pause');
    if (this.skipProduce) {
      return;
    }
    try {
      if (this.producerVideo && !this.producerVideo.paused) {
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
  async producerVideoResume(userId: string, force = false): Promise<void> {
    if (
      !this.meetingDataService.meetingMember.produceVideoEnabled &&
      !this.meetingDataService.meetingMember.produceVideoAllowed
    ) {
      return;
    }

    if (
      (this.skipProduce || !this.meetingDataService.hasOneSFUConnection) &&
      !force
    ) {
      return;
    }
    if (
      this.producerVideo &&
      this.producerVideo.paused &&
      !this.producerVideo.closed
    ) {
      await this.targetProducerResume({
        userId: userId,
        kind: 'video',
        isGlobal: false,
      });
      const videoTracks = this.localStream?.getVideoTracks()[0];
      await this.producerVideo.replaceTrack({
        track: videoTracks ? videoTracks : null,
      });
      this.producerVideo.resume();
    } else if (!this.producerVideo || this.producerVideo.closed) {
      await this.producerVideoStart();
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
      console.warn(`producer ${data.kind}  resumed`);
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
      return this.wssService.requestMedia({
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
   * @param userId unique user identifier
   */
  async getProducerStats(kind: TKind, userId: string): Promise<any | void> {
    try {
      return this.wssService.requestMedia({
        action: 'getProducerStats',
        data: {
          kind,
          userId,
        },
      });
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
      return this.wssService.requestMedia({
        action: 'getConsumerStats',
        data: {
          kind,
          userId,
        },
      });
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
   */
  async consumerScreenMediaStart(meetingMemberId: string) {
    console.log('consumer screen stream');
    const member = this.meetingDataService.meetingMembers.get(meetingMemberId);
    if (member) {
      const consumerConnection = member.sfuConsumerConnection;
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
          if (
            consumerConnection.consumerScreen &&
            !consumerConnection.consumerScreen.closed
          ) {
            consumerConnection.consumerScreen.close();
          }
          consumerConnection.consumerScreenStream = undefined;
          consumerConnection.consumerScreen = undefined;
        });
        consumer.on('trackended', () => {
          console.warn(
            'trackended',
            `consumer ${consumer.appData.mediaTag} for member ${meetingMemberId}`
          );
          consumerConnection.consumerScreenStream = undefined;
        });
        if (
          !(
            consumerConnection.consumerScreen &&
            !consumerConnection.consumerScreen.closed
          )
        ) {
          consumerConnection.consumerScreen = consumer;
          const { track } = consumer;
          consumerConnection.consumerScreenStream = new MediaStream([track]);
          this.meetingDataService.screenStream =
            consumerConnection.consumerScreenStream;
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
  async consumerVideoStart(meetingMemberId: string): Promise<void> {
    if (!this.mediasoupDevice?.loaded) {
      return;
    }
    const member = this.meetingDataService.meetingMembers.get(meetingMemberId);
    try {
      if (member) {
        if (
          member.sfuConsumerConnection.consumerVideo &&
          !member.sfuConsumerConnection.consumerVideo.closed
        ) {
          return;
        }
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

        consumer.on('transportclose', async () => {
          // console.warn(`Producer ${member.id} audio stream transport closed`);
          member.sfuConsumerConnection.consumerVideo = undefined;
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
        const videoStream = new MediaStream([track]);
        member.sfuConsumerConnection.consumerVideoTrack = track;
        if (
          (member.hasSFUConnection ||
            this.localMeetingMember.connectionType ===
              MeetingServiceType.SFU) &&
          member.produceVideoEnabled
        ) {
          member.videoStream = videoStream;
          consumer.resume();
          await this.consumerVideoResume(member);
        } else {
          consumer.pause();
          await this.consumerVideoPause(member);
        }
      } else {
        console.error('no member found');
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
  async consumerAudioStart(meetingMemberId: string): Promise<void> {
    if (!this.mediasoupDevice?.loaded) {
      return;
    }
    console.warn('consumer audio start');
    const member = this.meetingDataService.meetingMembers.get(meetingMemberId);
    try {
      if (member) {
        if (
          member.sfuConsumerConnection.consumerAudio &&
          !member.sfuConsumerConnection.consumerAudio.closed
        ) {
          return;
        }
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

        consumer.on('transportclose', async () => {
          if (member) {
            member.sfuConsumerConnection.consumerAudio = undefined;
          }
        });
        if (
          !member.sfuConsumerConnection.consumerAudio ||
          member.sfuConsumerConnection.consumerAudio.closed
        ) {
          if (consumer.kind === 'audio')
            member.sfuConsumerConnection.consumerAudio = consumer;
          console.warn('consumer audio set');
        }

        const { track } = consumer;
        const audioStream = new MediaStream([track]);
        member.sfuConsumerConnection.consumerAudioTrack = track;
        if (
          (member.hasSFUConnection ||
            this.localMeetingMember.connectionType ===
              MeetingServiceType.SFU) &&
          member.produceAudioEnabled
        ) {
          member.audioStream = audioStream;
          consumer.resume();
          await this.consumerAudioResume(member);
        } else {
          consumer.pause();
          await this.consumerAudioPause(member);
        }
      }
    } catch (e) {
      console.error(e.message, e.stack);
    }
  }

  /**
   * Pauses the given member audio consumer stream
   * @param consumer MeetingMember type
   */
  async consumerAudioPause(consumer: MeetingMember): Promise<void> {
    try {
      if (!consumer.sfuConsumerConnection) {
        console.error('SFU Connection object not initialized');
      }
      if (consumer.sfuConsumerConnection.consumerAudio) {
        if (
          consumer.sfuConsumerConnection.consumerAudio.track &&
          consumer.sfuConsumerConnection.consumerAudio.track.readyState !==
            'ended'
        ) {
          const result = await this.wssService.messageWithCallback(
            'toggleConsumer',
            {
              targetId: consumer.id,
              action: 'pause',
              kind: 'audio',
            }
          );
          this.logger.warn('consumer audio pause', {
            id: consumer.id,
            result,
          });
          consumer.sfuConsumerConnection.consumerAudio.pause();
        }
      }
    } catch (e) {
      console.error(e.name, `Error pausing Consumer ${e}`);
    }
  }
  /**
   * Resumes the given member audio consumer stream
   * @param consumer MeetingMember type
   */
  async consumerAudioResume(consumer: MeetingMember): Promise<void> {
    try {
      if (
        consumer.sfuConsumerConnection &&
        (!consumer.sfuConsumerConnection.consumerAudio ||
          (consumer.sfuConsumerConnection.consumerAudio &&
            consumer.sfuConsumerConnection.consumerAudio.closed))
      ) {
        await this.consumerAudioStart(consumer.id);
        return;
      }
      if (consumer.sfuConsumerConnection.consumerAudio) {
        if (
          consumer.sfuConsumerConnection.consumerAudio.track &&
          consumer.sfuConsumerConnection.consumerAudio.track.readyState !==
            'ended'
        ) {
          consumer.sfuConsumerConnection.consumerAudio.resume();
          const result = await this.wssService.messageWithCallback(
            'toggleConsumer',
            {
              targetId: consumer.id,
              action: 'resume',
              kind: 'audio',
            }
          );
          this.logger.warn('consumer audio resume', {
            id: consumer.id,
            result,
          });
        }
      }
    } catch (e) {
      console.error(e.name, `Error resuming Consumer ${e}`);
    }
  }

  /**
   * Pauses the given member video consumer stream
   * @param consumer MeetingMember type
   */
  async consumerVideoPause(consumer: MeetingMember): Promise<void> {
    try {
      if (!consumer.sfuConsumerConnection) {
        console.error('SFU Connection object not initialized');
      }
      if (consumer.sfuConsumerConnection.consumerVideo) {
        if (
          consumer.sfuConsumerConnection.consumerVideo.track &&
          consumer.sfuConsumerConnection.consumerVideo.track.readyState !==
            'ended'
        ) {
          consumer.sfuConsumerConnection.consumerVideo.pause();
          const result = await this.wssService.messageWithCallback(
            'toggleConsumer',
            {
              targetId: consumer.id,
              action: 'pause',
              kind: 'video',
            }
          );
          this.logger.log('consumer video pause', {
            id: consumer.id,
            result,
          });
        }
      }
    } catch (e) {
      console.error(e.name, `Error pausing Consumer ${e}`);
    }
  }
  /**
   * Resumes the given member video consumer stream
   * @param consumer MeetingMember type
   */
  async consumerVideoResume(consumer: MeetingMember): Promise<void> {
    try {
      if (
        consumer.sfuConsumerConnection &&
        (!consumer.sfuConsumerConnection.consumerVideo ||
          (consumer.sfuConsumerConnection.consumerVideo &&
            consumer.sfuConsumerConnection.consumerVideo.closed))
      ) {
        await this.consumerAudioStart(consumer.id);
        return;
      }
      if (consumer.sfuConsumerConnection.consumerVideo) {
        if (
          consumer.sfuConsumerConnection.consumerVideo.track &&
          consumer.sfuConsumerConnection.consumerVideo.track.readyState !==
            'ended'
        ) {
          consumer.sfuConsumerConnection.consumerVideo.resume();
          const result = await this.wssService.messageWithCallback(
            'toggleConsumer',
            {
              targetId: consumer.id,
              action: 'resume',
              kind: 'video',
            }
          );
          this.logger.warn('consumer video resume', {
            id: consumer.id,
            result,
          });
        }
      }
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
    const meetingMember =
      this.meetingDataService.meetingMembers.get(meetingMemberId);
    let flag;
    if (meetingMember) {
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
    this.producerScreenMedia = await this.producerTransport.produce({
      track: stream.getVideoTracks()[0],
      appData: {
        mediaTag: 'screen-media',
        userId: this.meetingDataService.meetingMember._id!,
      },
    });
    if (this.producerScreenMedia.track) {
      this.producerScreenMedia.track.onended = async () => {
        // console.warn('SCREEN SHARING ENDED');
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

  async getStats(defaultTimestamp: number): Promise<void> {
    await Promise.all([
      this.wssService.requestMedia({
        action: 'getProducerStats',
        data: {
          userId: this.meetingDataService.meetingMember._id,
          kind: 'video',
        },
      }),
      this.wssService.requestMedia({
        action: 'getProducerStats',
        data: {
          userId: this.meetingDataService.meetingMember._id,
          kind: 'audio',
        },
      }),
      this.producerTransport?.getStats(),
      this.consumerTransport?.getStats(),
    ]).then(async (result) => {
      const producerVideoStats = result[0];
      const producerAudioStats = result[1];
      const producerTransportStats = result[2];
      const consumerTransportStats = result[3];

      const producerStatsSnapshot: ProducerStatsSnapshot = {};
      const consumerStatsSnapshot: ConsumerStatsSnapshot = {
        transport: {
          timestamp: defaultTimestamp,
          bytesReceived: 0,
          packetsReceived: 0,
          packetsSent: 0,
          bytesSent: 0,
        },
        media: {},
      };

      producerTransportStats.forEach((result) => {
        if (result.type === 'transport') {
          producerStatsSnapshot.transport = {
            bytesSent: result.bytesSent,
            bytesReceived: result.bytesReceived,
            packetsSent: result.packetsSent,
            packetsReceived: result.packetsReceived,
            timestamp: defaultTimestamp,
          };
        }
      });
      consumerTransportStats.forEach((result) => {
        if (result.type === 'transport') {
          consumerStatsSnapshot.transport = {
            bytesSent: result.bytesSent,
            bytesReceived: result.bytesReceived,
            packetsSent: result.packetsSent,
            packetsReceived: result.packetsReceived,
            timestamp: defaultTimestamp,
          };
        }
      });
      const videoStats = producerVideoStats.stats;
      const audioStats = producerAudioStats.stats;
      if (videoStats.length > 0) {
        let bitrate = 0;
        let firCount = 0;
        let jitter = 0;
        let pliCount = 0;
        let nackCount = 0;
        let packetsLost = 0;
        let packetCount = 0;
        let byteCount = 0;
        videoStats.forEach((stat: IPeerStat) => {
          if (stat.bitrate) {
            bitrate += stat.bitrate;
          }
          if (stat.firCount) {
            firCount += stat.firCount;
          }
          if (stat.pliCount) {
            pliCount += stat.pliCount;
          }
          if (stat.jitter) {
            jitter += stat.jitter;
          }
          if (stat.packetsLost) {
            packetsLost += stat.packetsLost;
          }
          if (stat.packetCount) {
            packetCount += stat.packetCount;
          }
          if (stat.byteCount) {
            byteCount += stat.byteCount;
          }
          if (stat.nackCount) {
            nackCount += stat.nackCount;
          }
        });
        producerStatsSnapshot.video = {
          ...producerStatsSnapshot.video,
          bitrate: bitrate,
          firCount: firCount,
          pliCount: pliCount,
          jitter: jitter,
          packetCount: packetCount,
          packetsLost: packetsLost,
          byteCount: byteCount,
          nackCount: nackCount,
          timestamp: defaultTimestamp,
        };
      } else {
        producerStatsSnapshot.video = {
          ...producerStatsSnapshot.video,
          bitrate: 0,
          firCount: 0,
          pliCount: 0,
          jitter: 0,
          packetCount: 0,
          packetsLost: 0,
          byteCount: 0,
          nackCount: 0,
          timestamp: defaultTimestamp,
        };
      }

      if (audioStats.length > 0) {
        let bitrate = 0;
        let packetsLost = 0;
        let packetCount = 0;
        let byteCount = 0;
        let jitter = 0;
        let nackCount = 0;
        audioStats.forEach((stat: IPeerStat) => {
          if (stat.bitrate) {
            bitrate += stat.bitrate;
          }
          if (stat.packetsLost) {
            packetsLost += stat.packetsLost;
          }
          if (stat.packetCount) {
            packetCount += stat.packetCount;
          }
          if (stat.byteCount) {
            byteCount += stat.byteCount;
          }
          if (stat.jitter) {
            jitter += stat.jitter;
          }
          if (stat.nackCount) {
            nackCount += stat.nackCount;
          }
        });
        producerStatsSnapshot.audio = {
          ...producerStatsSnapshot.audio,
          bitrate: bitrate,
          packetCount: packetCount,
          packetsLost: packetsLost,
          byteCount: byteCount,
          jitter: jitter,
          nackCount: nackCount,
          timestamp: defaultTimestamp,
        };
      } else {
        producerStatsSnapshot.audio = {
          ...producerStatsSnapshot.audio,
          bitrate: 0,
          packetCount: 0,
          packetsLost: 0,
          byteCount: 0,
          jitter: 0,
          nackCount: 0,
          timestamp: defaultTimestamp,
        };
      }

      this.statsSummary = {
        producer: producerStatsSnapshot,
        consumer: consumerStatsSnapshot,
      };
    });
    return;
  }

  //

  onDestroy(): void {
    if (this.producerVideo) {
      this.producerVideoClose();
    }
    if (this.producerAudio) {
      this.producerAudioClose();
    }
    if (this.producerTransport) {
      this.producerTransport.close();
    }
    if (this.consumerTransport) {
      this.consumerTransport.close();
    }
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
    this.subscriptions = [];
  }
}
