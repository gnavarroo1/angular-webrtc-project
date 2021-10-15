import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PeerComponent } from './components/peer/peer.component';
import { MeetingDataService } from './services/meeting-data.service';

@NgModule({
  declarations: [PeerComponent],
  imports: [CommonModule],
  providers: [MeetingDataService],
})
export class MeetingsModule {}
