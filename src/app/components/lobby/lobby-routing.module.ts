import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TestComponent } from "../../core/test/test.component";
import {MemberType} from "../../../types/enums";

const routes: Routes = [{
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
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LobbyRoutingModule { }
