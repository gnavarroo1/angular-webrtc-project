import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebrtcP2pComponent } from './webrtc-p2p.component';

describe('WebrtcP2pComponent', () => {
  let component: WebrtcP2pComponent;
  let fixture: ComponentFixture<WebrtcP2pComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WebrtcP2pComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WebrtcP2pComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
