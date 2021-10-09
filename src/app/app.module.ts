import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { LoggerModule, NgxLoggerLevel } from 'ngx-logger';
import { HttpClientModule } from '@angular/common/http';
import { TestModule } from './core/test/test.module';
import { SocketIoModule } from 'ngx-socket-io';
import { environment } from '../environments/environment';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { LayoutModule } from '@angular/cdk/layout';
import { ClipboardModule } from 'ngx-clipboard';
import { AppRoutingModule } from './app-routing.module';
import { interceptorProviders } from './core/interceptors/token.interceptor';
import { JWT_OPTIONS, JwtModule } from '@auth0/angular-jwt';
import { HomeComponent } from './home/home.component';
import { WebrtcP2pComponent } from './webrtc-p2p/webrtc-p2p.component';
import { WebrtcSfuComponent } from './webrtc-sfu/webrtc-sfu.component';
import { WebrtcMutableComponent } from './webrtc-mutable/webrtc-mutable.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MediasoupService } from './wss/wss.mediasoup';
import { MeetingService } from './wss/meeting.service';
import { MeetingApiService } from './meetings/services/api/meeting-api.service';
import { P2pWebrtcService } from './wss/p2p-webrtc.service';
import { MatListModule } from '@angular/material/list';
import { MatSliderModule } from '@angular/material/slider';

export function jwtOptionsFactory() {
  return {
    tokenGetter: () => {
      return localStorage.getItem(environment.token.authHeaderKey);
    },
    authScheme: () => {
      return 'Bearer ';
    },
  };
}
@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    WebrtcP2pComponent,
    WebrtcSfuComponent,
    WebrtcMutableComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    ClipboardModule,
    HttpClientModule,
    LoggerModule.forRoot({ level: NgxLoggerLevel.DEBUG }),
    JwtModule.forRoot({
      jwtOptionsProvider: {
        provide: JWT_OPTIONS,
        useFactory: jwtOptionsFactory,
      },
    }),
    SocketIoModule,
    TestModule,
    MatGridListModule,
    MatCardModule,
    MatMenuModule,
    MatIconModule,
    MatButtonModule,
    LayoutModule,
    MatSidenavModule,
    MatListModule,
    MatSliderModule,
  ],
  providers: [
    interceptorProviders,
    MediasoupService,
    MeetingService,
    MeetingApiService,
    P2pWebrtcService,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
