import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestComponent } from './test.component';

import { MediasoupService } from '../../wss/wss.mediasoup';
import { MeetingService } from '../../wss/meeting.service';
import { MeetingApiService } from '../../meetings/services/api/meeting-api.service';
import { MeetingRoutingModule } from './test-routing.module';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

@NgModule({
  declarations: [TestComponent],
  imports: [
    CommonModule,
    MatSidenavModule,
    MatButtonModule,
    MatCheckboxModule,
    MatMenuModule,
    MatIconModule,
    MatListModule,
  ],
  providers: [
    MeetingRoutingModule,
    MediasoupService,
    MeetingService,
    MeetingApiService,
  ],
})
export class TestModule {}
