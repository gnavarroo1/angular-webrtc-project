import { NgModule } from '@angular/core';
import { Router, RouterModule, Routes } from '@angular/router';
import { WebrtcP2pComponent } from './meetings/pages/webrtc-p2p/webrtc-p2p.component';
import { HomeComponent } from './meetings/pages/home/home.component';
import { LoginComponent } from './auth/pages/login/login.component';
import { RegisterComponent } from './auth/pages/register/register.component';
import { AuthGuard } from './shared/guards/auth.guard';
import { LoggedInAuthGuard } from './shared/guards/logged-in-auth.guard';
import { P404Component } from './shared/pages/not-found/p404.component';
import { ErrorPageComponent } from './shared/pages/error-page/error-page.component';
import { ResetPasswordComponent } from './auth/pages/reset-password/reset-password.component';
import { ForgotPasswordComponent } from './auth/pages/forgot-password/forgot-password.component';
import { VerifyEmailComponent } from './auth/pages/verify-email/verify-email.component';
export enum MemberType {
  PRODUCER = 'PRODUCER',
  CONSUMER = 'CONSUMER',
}
const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [LoggedInAuthGuard],
  },
  {
    path: 'register',
    component: RegisterComponent,
    canActivate: [LoggedInAuthGuard],
  },
  {
    path: '',
    component: HomeComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'meetings/join/:id',
    component: WebrtcP2pComponent,
    data: { memberType: MemberType.PRODUCER, extFile: false },
    canActivate: [AuthGuard],
  },
  {
    path: 'meetings/join-2/:id',
    component: WebrtcP2pComponent,
    data: { memberType: MemberType.PRODUCER, extFile: true },
    canActivate: [AuthGuard],
  },
  {
    path: 'meetings/broadcasting/:id',
    component: WebrtcP2pComponent,
    data: { memberType: MemberType.CONSUMER },
    canActivate: [AuthGuard],
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
  },
  {
    path: 'verify-email',
    component: VerifyEmailComponent,
  },
  {
    path: '404',
    component: P404Component,
  },
  {
    path: 'error-page',
    component: ErrorPageComponent,
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {
  constructor(private router: Router) {
    this.router.errorHandler = (error: any) => {
      console.warn(error);
      this.router.navigate(['404']); // or redirect to default route
    };
  }
}
