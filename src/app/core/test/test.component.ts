import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import * as uuid from 'uuid';
import {NGXLogger} from "ngx-logger";
import {MediasoupService} from "../../wss/wss.mediasoup";
@Component({
  selector: 'app-test',
  templateUrl: './test.component.html',
  styleUrls: ['./test.component.css']
})
export class TestComponent implements OnInit {
  @ViewChild('producerVideo', { static: false }) producerVideo!: ElementRef;
  @ViewChild('consumerVideo', { static: false }) consumerVideo!: ElementRef;
  @ViewChild('consumerAudio', { static: false }) consumerAudio!: ElementRef;

  private readonly user_id: string = uuid.v4();
  constructor(private readonly logger: NGXLogger, private mediasoupService: MediasoupService) { }

  async ngOnInit(): Promise<void> {
    this.mediasoupService.connectionReady().subscribe((data)=>{
      // console.log('connection ready', data);
      if(data){
        this.mediasoupService.initCommunication();
      }
    })

  }
  public showProducerVideo(){
    this.producerVideo.nativeElement.srcObject = this.mediasoupService.producerVideoStream;
  }
  public showConsumerVideo(){
    const keys = Array.from(this.mediasoupService.consumersVideoStream.keys());
    this.consumerVideo.nativeElement.srcObject = this.mediasoupService.consumersVideoStream.get(keys[0]);
  }
  public showConsumerAudio() {
    const keys = Array.from(this.mediasoupService.consumersAudioStream.keys());
    this.consumerAudio.nativeElement.srcObject = this.mediasoupService.consumersAudioStream.get(keys[0]);
  }
  public pauseProducerVideo() {
    this.mediasoupService.producerVideoPause();
  }

  public resumeProducerVideo() {
    this.mediasoupService.producerVideoResume();
  }

  public pauseProducerAudio() {
    this.mediasoupService.producerAudioPause();
  }

  public resumeProducerAudio() {
    this.mediasoupService.producerAudioResume();
  }

}
