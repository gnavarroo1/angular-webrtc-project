import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TestComponent } from './core/test/test.component';
import { MemberType } from './meetings/types/defines';
import { WebrtcP2pComponent } from './webrtc-p2p/webrtc-p2p.component';
import { WebrtcSfuComponent } from './webrtc-sfu/webrtc-sfu.component';
import { HomeComponent } from './home/home.component';

const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
  },
  {
    path: 'meetings',
    component: TestComponent,
    data: { memberType: MemberType.BOTH, newMeeting: true },
  },
  {
    path: 'meetings/join/:id',
    component: TestComponent,
    data: { memberType: MemberType.BOTH, newMeeting: false },
  },
  {
    path: 'meetings/broadcasting/:id',
    component: TestComponent,
    data: { memberType: MemberType.CONSUMER, newMeeting: false },
  },

  {
    path: 'meetings-p2p',
    component: WebrtcP2pComponent,
    data: { memberType: MemberType.BOTH, newMeeting: true },
  },
  {
    path: 'meetings-p2p/join/:id',
    component: WebrtcP2pComponent,
    data: { memberType: MemberType.BOTH, newMeeting: false },
  },
  // {
  //   path: 'meetings-p2p/broadcasting/:id',
  //   component: WebrtcP2pComponent,
  //   data: { memberType: MemberType.CONSUMER, newMeeting: false },
  // },
  {
    path: 'meetings-sfu',
    component: WebrtcSfuComponent,
    data: { memberType: MemberType.BOTH, newMeeting: true },
  },
  {
    path: 'meetings-sfu/join/:id',
    component: WebrtcSfuComponent,
    data: { memberType: MemberType.BOTH, newMeeting: false },
  },
  {
    path: 'meetings-sfu/broadcasting/:id',
    component: WebrtcSfuComponent,
    data: { memberType: MemberType.CONSUMER, newMeeting: false },
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
