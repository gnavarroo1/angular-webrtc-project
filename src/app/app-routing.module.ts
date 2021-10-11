import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TestComponent } from './core/test/test.component';
import { MemberType } from '../types/enums';
import {LogInComponent} from "./components/log-in/log-in.component";
import {RegisterComponent} from "./components/register/register.component";
import {LobbyComponent} from "./components/lobby/lobby.component";

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    component: LogInComponent
  },
  {
    path: 'lobby',
    component: LobbyComponent
  },
  {
    path: 'register',
    component: RegisterComponent
  },
  {
    path: 'lobby/meetings',
    component: TestComponent,
    data: { memberType: MemberType.BOTH },
  },
  {
    path: 'lobby/meetings/join/:id',
    component: TestComponent,
    data: { memberType: MemberType.BOTH },
  },
  {
    path: 'lobby/meetings/broadcasting/:id',
    component: TestComponent,
    data: { memberType: MemberType.CONSUMER },
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
