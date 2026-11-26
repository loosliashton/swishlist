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
  let dialogData: RevealPurchaseDialogData;

  beforeEach(async () => {
    firebaseSpy = jasmine.createSpyObj('FirebaseService', ['getList']);
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
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: FirebaseService, useValue: firebaseSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RevealPurchaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should start in confirm state without revealing purchase status', () => {
    expect(component.step).toBe('confirm');
    expect(firebaseSpy.getList).not.toHaveBeenCalled();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Reveal Purchase Status?');
    expect(text).toContain('Coffee Grinder');
  });

  it('should fetch latest list on confirmReveal and show purchased status', async () => {
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
    expect(component.step).toBe('revealed');
    expect(component.purchased).toBeTrue();
    expect(dialogData.item.purchased).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain(
      'has been marked as purchased!',
    );
  });

  it('should show not purchased when fresh item is not purchased', async () => {
    firebaseSpy.getList.and.resolveTo({
      id: 'list-1',
      name: 'Birthday',
      creatorID: 'user-1',
      items: [{ ...dialogData.item, purchased: false }],
    });

    await component.confirmReveal();
    fixture.detectChanges();

    expect(component.step).toBe('revealed');
    expect(component.purchased).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain(
      'has not been marked as purchased yet.',
    );
  });

  it('should transition to error state on failure and allow retrying', async () => {
    firebaseSpy.getList.and.rejectWith(new Error('Network error'));

    await component.confirmReveal();
    fixture.detectChanges();

    expect(component.step).toBe('error');
    expect(fixture.nativeElement.textContent).toContain("Couldn't Check Status");

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
  });
});
