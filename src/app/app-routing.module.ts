import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TestComponent } from './core/test/test.component';
import { MemberType } from './meetings/types/defines';

const routes: Routes = [
  {
    path: '',
    component: TestComponent,
    data: { memberType: MemberType.BOTH },
  },
  {
    path: 'meetings/join/:id',
    component: TestComponent,
    data: { memberType: MemberType.BOTH },
  },
  {
    path: 'meetings/broadcasting/:id',
    component: TestComponent,
    data: { memberType: MemberType.CONSUMER },
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
