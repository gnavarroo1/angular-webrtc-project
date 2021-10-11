import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {AppModule} from "../../app.module";
import { LobbyRoutingModule } from './lobby-routing.module';
import { LobbyComponent} from "./lobby.component";
import {from} from "rxjs";

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    LobbyRoutingModule
  ]
})
export class LobbyModule { }
