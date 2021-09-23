import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WssService } from './mediasoup-connection/wss.service';
import { MediasoupService } from './wss.mediasoup';
import { MeetingService } from './meeting.service';
import { ApiGatewayService } from './api-connection/api-gateway.service';
import { ApiRestService } from './api-connection/api-rest.service';

@NgModule({
  declarations: [],
  imports: [CommonModule],
  providers: [
    WssService,
    MediasoupService,
    MeetingService,
    ApiGatewayService,
    ApiRestService,
  ],
  exports: [],
})
export class WssModule {}
