import { Injectable } from '@angular/core';
import { BehaviorSubject, ReplaySubject } from 'rxjs';
import { Transport } from 'mediasoup-client/lib/Transport';
import { Consumer } from 'mediasoup-client/lib/Consumer';

@Injectable()
export class MeetingHandlerService {
  private device;
  private producer;
  private producerVideo$: ReplaySubject<MediaStream> =
    new ReplaySubject<MediaStream>();
  private producerTransport: Transport;
  private consumerTransport: Transport;

  private consumersVideo: BehaviorSubject<Map<string, Consumer>>;
  private consumersAudio: BehaviorSubject<Map<string, Consumer>>;
  private isProducer: boolean;
}
