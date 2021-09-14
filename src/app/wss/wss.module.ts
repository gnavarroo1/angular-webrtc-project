import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {WssService} from "./wss.service";
import {MediasoupService} from "./wss.mediasoup";



@NgModule({
  declarations: [],
  imports: [
    CommonModule
  ],
  providers:[
    WssService,MediasoupService
  ],

})
export class WssModule { }
