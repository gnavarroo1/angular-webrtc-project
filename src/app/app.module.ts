import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { SharedModule } from './shared/shared.module';
import { AppComponent } from './app.component';
import { LoggerModule, NgxLoggerLevel } from 'ngx-logger';
import { HttpClientModule } from '@angular/common/http';
import { SocketIoModule } from 'ngx-socket-io';
import { environment } from '../environments/environment';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FlexModule } from '@angular/flex-layout/flex';
import { GridModule } from '@angular/flex-layout/grid';

import { LayoutModule } from '@angular/cdk/layout';
import { ClipboardModule } from 'ngx-clipboard';
import { AppRoutingModule } from './app-routing.module';
import { interceptorProviders } from './shared/interceptors/token.interceptor';
import { JWT_OPTIONS, JwtModule } from '@auth0/angular-jwt';
import { HomeComponent } from './meetings/pages/home/home.component';
import { WebrtcP2pComponent } from './meetings/pages/webrtc-p2p/webrtc-p2p.component';
import { MeetingService } from './meetings/services/meeting.service';
import { P2pWebrtcService } from './meetings/services/p2p-connection/p2p-webrtc.service';
import { MeetingDataService } from './meetings/services/meeting-data.service';
import { SfuWebrtcService } from './meetings/services/mediasoup-connection/mediasoup.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LoginComponent } from './auth/pages/login/login.component';
import { RegisterComponent } from './auth/pages/register/register.component';
import { P404Component } from './shared/pages/not-found/p404.component';
import { ErrorPageComponent } from './shared/pages/error-page/error-page.component';
import { AuthGuard } from './shared/guards/auth.guard';
import { SecurityService } from './auth/services/security.service';
import { LoggedInAuthGuard } from './shared/guards/logged-in-auth.guard';
import { ResetPasswordComponent } from './auth/pages/reset-password/reset-password.component';
import { VerifyEmailComponent } from './auth/pages/verify-email/verify-email.component';
import { ForgotPasswordComponent } from './auth/pages/forgot-password/forgot-password.component';

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
    LoginComponent,
    RegisterComponent,
    P404Component,
    ErrorPageComponent,
    ResetPasswordComponent,
    VerifyEmailComponent,
    ForgotPasswordComponent,
  ],
  imports: [
    BrowserModule,
    FlexLayoutModule,
    GridModule,
    FlexModule,
    BrowserAnimationsModule,
    SharedModule,
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
