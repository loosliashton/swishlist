import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Item } from 'src/models/item';
import { FirebaseService } from 'src/services/firebase.service';

import {
  RevealPurchaseComponent,
  RevealPurchaseDialogData,
} from './reveal-purchase.component';

describe('RevealPurchaseComponent', () => {
  let component: RevealPurchaseComponent;
  let fixture: ComponentFixture<RevealPurchaseComponent>;
  let firebaseSpy: jasmine.SpyObj<FirebaseService>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<RevealPurchaseComponent>>;
  let dialogData: RevealPurchaseDialogData;

  async function setup(canCheckToday = true) {
    firebaseSpy = jasmine.createSpyObj('FirebaseService', [
      'getList',
      'canCheckAvailability',
      'recordAvailabilityCheck',
    ]);
    firebaseSpy.canCheckAvailability.and.returnValue(canCheckToday);
    firebaseSpy.recordAvailabilityCheck.and.resolveTo();
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
    dialogData = {
      item: {
        name: 'Coffee Grinder',
        url: 'https://example.com',
        purchased: false,
        details: 'Burr grinder',
      },
      listId: 'list-1',
      itemIndex: 0,
    };

    await TestBed.configureTestingModule({
      declarations: [RevealPurchaseComponent],
      imports: [NoopAnimationsModule, MatDialogModule, MatButtonModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: FirebaseService, useValue: firebaseSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RevealPurchaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should start in confirm state without revealing purchase status when not locked out today', async () => {
    await setup(true);
    expect(component.step).toBe('confirm');
    expect(firebaseSpy.getList).not.toHaveBeenCalled();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Buying This Yourself?');
    expect(text).toContain('Coffee Grinder');
    expect(text).toContain('one item per day');
  });

  it('should start in cooldown state when a check was already used today', async () => {
    await setup(false);
    expect(component.step).toBe('cooldown');
    expect(firebaseSpy.getList).not.toHaveBeenCalled();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Daily Check Used');
    expect(text).toContain('Come back tomorrow');
  });

  it('should fetch latest list on confirmReveal, record cooldown, and show hold-off message when purchased', async () => {
    await setup(true);
    const freshItem: Item = { ...dialogData.item, purchased: true };
    firebaseSpy.getList.and.resolveTo({
      id: 'list-1',
      name: 'Birthday',
      creatorID: 'user-1',
      items: [freshItem],
    });

    await component.confirmReveal();
    fixture.detectChanges();

    expect(firebaseSpy.getList).toHaveBeenCalledWith('list-1');
    expect(firebaseSpy.recordAvailabilityCheck).toHaveBeenCalledWith('list-1');
    expect(component.step).toBe('revealed');
    expect(component.purchased).toBeTrue();
    expect(dialogData.item.purchased).toBeTrue();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Hold Off on This One');
    expect(text).toContain('skip buying it yourself');
    expect(fixture.nativeElement.querySelector('.remove-item-btn')).toBeNull();
  });

  it('should enter cooldown without revealing if fresh list was already checked today on another device', async () => {
    await setup(true);
    const freshList = {
      id: 'list-1',
      name: 'Birthday',
      creatorID: 'user-1',
      items: [{ ...dialogData.item, purchased: true }],
      lastAvailabilityCheckDate: '2026-11-27',
    };
    firebaseSpy.getList.and.resolveTo(freshList);
    firebaseSpy.canCheckAvailability.and.callFake((arg) => typeof arg === 'string');

    await component.confirmReveal();
    fixture.detectChanges();

    expect(component.step).toBe('cooldown');
    expect(firebaseSpy.recordAvailabilityCheck).not.toHaveBeenCalled();
    expect(dialogData.item.purchased).toBeFalse();
  });

  it('should prompt user to remove item from list when not purchased', async () => {
    await setup(true);
    firebaseSpy.getList.and.resolveTo({
      id: 'list-1',
      name: 'Birthday',
      creatorID: 'user-1',
      items: [{ ...dialogData.item, purchased: false }],
    });

    await component.confirmReveal();
    fixture.detectChanges();

    expect(firebaseSpy.recordAvailabilityCheck).toHaveBeenCalledWith('list-1');
    expect(component.step).toBe('revealed');
    expect(component.purchased).toBeFalse();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('All Clear — Safe to Buy!');
    expect(text).toContain('Remove it from your list now');

    const removeBtn: HTMLButtonElement | null =
      fixture.nativeElement.querySelector('.remove-item-btn');
    expect(removeBtn).toBeTruthy();
    removeBtn!.click();

    expect(dialogRefSpy.close).toHaveBeenCalledWith('remove');
  });

  it('should not consume cooldown on error and should allow retrying', async () => {
    await setup(true);
    firebaseSpy.getList.and.rejectWith(new Error('Network error'));

    await component.confirmReveal();
    fixture.detectChanges();

    expect(component.step).toBe('error');
    expect(firebaseSpy.recordAvailabilityCheck).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      "Couldn't Check Availability",
    );

    firebaseSpy.getList.and.resolveTo({
      id: 'list-1',
      name: 'Birthday',
      creatorID: 'user-1',
      items: [{ ...dialogData.item, purchased: true }],
    });

    await component.confirmReveal();
    fixture.detectChanges();

    expect(component.step).toBe('revealed');
    expect(component.purchased).toBeTrue();
    expect(firebaseSpy.recordAvailabilityCheck).toHaveBeenCalledWith('list-1');
  });
});
