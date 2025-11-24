import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecentListsModalComponent } from './recent-lists-modal.component';

describe('RecentListsModalComponent', () => {
  let component: RecentListsModalComponent;
  let fixture: ComponentFixture<RecentListsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecentListsModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecentListsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
