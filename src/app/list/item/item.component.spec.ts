import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

import { ItemComponent } from './item.component';
import { RevealPurchaseComponent } from './reveal-purchase/reveal-purchase.component';

describe('ItemComponent', () => {
  let dialogSpy: jasmine.SpyObj<MatDialog>;

  function createComponent(dataOverrides: Record<string, any> = {}) {
    dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);
    const data = {
      item: {
        name: 'Board Game',
        url: '',
        purchased: false,
        details: '',
      },
      listId: 'list-1',
      itemIndex: 0,
      spoilers: false,
      isGeneralList: false,
      isOwner: true,
      ...dataOverrides,
    };

    TestBed.configureTestingModule({
      declarations: [ItemComponent],
      imports: [NoopAnimationsModule, MatDialogModule, MatButtonModule],
      providers: [
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialog, useValue: dialogSpy },
      ],
    });

    const fixture: ComponentFixture<ItemComponent> =
      TestBed.createComponent(ItemComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, data };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render Reveal if Purchased button for owner on a gift list and open RevealPurchaseComponent on click', () => {
    const { fixture, data } = createComponent({
      isOwner: true,
      isGeneralList: false,
    });

    const revealBtn: HTMLButtonElement | null =
      fixture.nativeElement.querySelector('.reveal-btn');
    expect(revealBtn).toBeTruthy();
    expect(revealBtn?.textContent).toContain('Reveal if Purchased');

    revealBtn!.click();

    expect(dialogSpy.open).toHaveBeenCalledWith(RevealPurchaseComponent, {
      data: {
        item: data.item,
        listId: 'list-1',
        itemIndex: 0,
      },
      width: '90vw',
      maxWidth: '420px',
    });
  });

  it('should not render Reveal if Purchased button for non-owners', () => {
    const { fixture } = createComponent({
      isOwner: false,
      isGeneralList: false,
    });

    const revealBtn = fixture.nativeElement.querySelector('.reveal-btn');
    expect(revealBtn).toBeNull();
  });

  it('should not render Reveal if Purchased button on general lists', () => {
    const { fixture } = createComponent({
      isOwner: true,
      isGeneralList: true,
    });

    const revealBtn = fixture.nativeElement.querySelector('.reveal-btn');
    expect(revealBtn).toBeNull();
  });
});
