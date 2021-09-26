import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TestComponent } from './core/test/test.component';
import { MemberType } from '../types/enums';
import {LogInComponent} from "./components/log-in/log-in.component";
import {RegisterComponent} from "./components/register/register.component";

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    component: LogInComponent
  },
  {
    path: 'register',
    component: RegisterComponent
  },
  {
    path: 'meetings',
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
