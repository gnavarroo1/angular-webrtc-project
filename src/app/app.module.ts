import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AngularMaterialModule } from './angular-material.module';
import { AppComponent } from './app.component';
import { LoggerModule, NgxLoggerLevel } from 'ngx-logger';
import { HttpClientModule } from '@angular/common/http';
import { SocketIoModule } from 'ngx-socket-io';
import { environment } from '../environments/environment';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FlexLayoutModule } from '@angular/flex-layout';
import { LayoutModule } from '@angular/cdk/layout';
import { ClipboardModule } from 'ngx-clipboard';
import { AppRoutingModule } from './app-routing.module';
import { interceptorProviders } from './core/interceptors/token.interceptor';
import { JWT_OPTIONS, JwtModule } from '@auth0/angular-jwt';
import { HomeComponent } from './home/home.component';
import { WebrtcP2pComponent } from './webrtc-p2p/webrtc-p2p.component';
import { WebrtcSfuComponent } from './webrtc-sfu/webrtc-sfu.component';
import { MeetingService } from './services/meeting.service';
import { P2pWebrtcService } from './services/p2p-connection/p2p-webrtc.service';
import { MeetingDataService } from './services/meeting-data.service';
import { SfuWebrtcService } from './services/mediasoup-connection/mediasoup.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { P404Component } from './views/p404/p404.component';
import { ErrorPageComponent } from './views/p500/error-page.component';
import { AuthGuard } from './core/guards/auth.guard';
import { SecurityService } from './services/security/security.service';
import { LoggedInAuthGuard } from './core/guards/logged-in-auth.guard';

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
    LoginComponent,
    RegisterComponent,
    P404Component,
    ErrorPageComponent,
  ],
  imports: [
    BrowserModule,
    FlexLayoutModule,
    BrowserAnimationsModule,
    AngularMaterialModule,
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
    LayoutModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  providers: [
    AuthGuard,
    LoggedInAuthGuard,
    interceptorProviders,
    MeetingService,
    P2pWebrtcService,
    SfuWebrtcService,
    MeetingDataService,
    SecurityService,
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {}
