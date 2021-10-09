import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebrtcMutableComponent } from './webrtc-mutable.component';

describe('WebrtcMutableComponent', () => {
  let component: WebrtcMutableComponent;
  let fixture: ComponentFixture<WebrtcMutableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WebrtcMutableComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WebrtcMutableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
