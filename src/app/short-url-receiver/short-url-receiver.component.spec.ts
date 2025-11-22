import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShortUrlReceiverComponent } from './short-url-receiver.component';

describe('ShortUrlReceiverComponent', () => {
  let component: ShortUrlReceiverComponent;
  let fixture: ComponentFixture<ShortUrlReceiverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShortUrlReceiverComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShortUrlReceiverComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
