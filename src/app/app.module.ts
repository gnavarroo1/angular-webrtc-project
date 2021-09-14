import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {LoggerModule, NgxLoggerLevel} from "ngx-logger";
import {HttpClientModule} from "@angular/common/http";
import {TestModule} from "./core/test/test.module";
import {SocketIoModule} from "ngx-socket-io";
import {environment} from "../environments/environment";
import * as uuid from 'uuid';
@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    LoggerModule.forRoot({level: NgxLoggerLevel.DEBUG}),
    SocketIoModule.forRoot({
      url: environment.wss_url,
      options:{
        query:{
          session_id: "4zsnRr+4wWBLFcSb",
          user_id: uuid.v4(),
        }
      }
    }),
    TestModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
