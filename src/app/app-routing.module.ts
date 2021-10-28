import { NgModule } from '@angular/core';
import { Router, RouterModule, Routes } from '@angular/router';
import { MemberType } from './types/defines';
import { WebrtcP2pComponent } from './webrtc-p2p/webrtc-p2p.component';
import { WebrtcSfuComponent } from './webrtc-sfu/webrtc-sfu.component';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { AuthGuard } from './core/guards/auth.guard';
import { LoggedInAuthGuard } from './core/guards/logged-in-auth.guard';
import { P404Component } from './views/p404/p404.component';
import { ErrorPageComponent } from './views/p500/error-page.component';

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
    data: { memberType: MemberType.BOTH },
    canActivate: [AuthGuard],
  },
  {
    path: 'meetings-sfu',
    component: WebrtcSfuComponent,
    data: { memberType: MemberType.BOTH },
    canActivate: [AuthGuard],
  },
  {
    path: 'meetings-sfu/join/:id',
    component: WebrtcSfuComponent,
    data: { memberType: MemberType.BOTH },
    canActivate: [AuthGuard],
  },
  {
    path: 'meetings/broadcasting/:id',
    component: WebrtcP2pComponent,
    data: { memberType: MemberType.CONSUMER },
    canActivate: [AuthGuard],
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
      this.router.navigate(['404']); // or redirect to default route
    };
  }
}
