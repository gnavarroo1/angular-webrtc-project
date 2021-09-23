import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TestComponent } from './test.component';
import { MemberType } from '../../wss/types/defines';

const routes: Routes = [
  // {
  //   path: 'meetings',
  //   component: TestComponent,
  //   data: { memberType: MemberType.BOTH, newMeeting: true },
  // },
  // {
  //   path: 'meetings/join/:id',
  //   component: TestComponent,
  //   data: { memberType: MemberType.BOTH, newMeeting: false },
  // },
  // {
  //   path: 'meetings/broadcasting/:id',
  //   component: TestComponent,
  //   data: { memberType: MemberType.CONSUMER, newMeeting: false },
  // },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MeetingRoutingModule {}
