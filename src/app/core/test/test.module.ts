import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestComponent } from './test.component';

import { MediasoupService } from '../../wss/wss.mediasoup';

@NgModule({
  declarations: [TestComponent],
  imports: [CommonModule],
  providers: [MediasoupService],
})
export class TestModule {}
