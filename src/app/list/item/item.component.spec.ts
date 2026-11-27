import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { of } from 'rxjs';

import { ItemComponent } from './item.component';
import { RevealPurchaseComponent } from './reveal-purchase/reveal-purchase.component';

describe('ItemComponent', () => {
  let dialogSpy: jasmine.SpyObj<MatDialog>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<ItemComponent>>;

  function createComponent(
    dataOverrides: Record<string, any> = {},
    revealDialogResult: 'remove' | undefined = undefined,
  ) {
    dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);
    dialogSpy.open.and.returnValue({
      afterClosed: () => of(revealDialogResult),
    } as any);
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
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
      imports: [
        NoopAnimationsModule,
        MatDialogModule,
        MatButtonModule,
        MatMenuModule,
      ],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
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

  it('should render 3-dot menu button for owner on a gift list and open RevealPurchaseComponent from menu', () => {
    const { fixture, data } = createComponent({
      isOwner: true,
      isGeneralList: false,
    });

    const moreBtn: HTMLButtonElement | null =
      fixture.nativeElement.querySelector('.more-options-btn');
    expect(moreBtn).toBeTruthy();

    moreBtn!.click();
    fixture.detectChanges();

    const menuItem: HTMLButtonElement | null =
      document.querySelector('.reveal-menu-item');
    expect(menuItem).toBeTruthy();
    expect(menuItem?.textContent).toContain(
      'Check availability (buying myself)',
    );

    menuItem!.click();

    expect(dialogSpy.open).toHaveBeenCalledWith(RevealPurchaseComponent, {
      data: {
        item: data.item,
        listId: 'list-1',
        itemIndex: 0,
      },
      width: '90vw',
      maxWidth: '420px',
    });
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });

  it('should emit removeItemEvent and close dialog when user chooses to remove item', () => {
    const { component } = createComponent(
      { isOwner: true, isGeneralList: false },
      'remove',
    );
    const removeSpy = jasmine.createSpy('removeItemEvent');
    component.removeItemEvent.subscribe(removeSpy);

    component.openRevealPurchaseModal();

    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(dialogRefSpy.close).toHaveBeenCalledTimes(1);
  });

  it('should not render 3-dot menu button for non-owners', () => {
    const { fixture } = createComponent({
      isOwner: false,
      isGeneralList: false,
    });

    const moreBtn = fixture.nativeElement.querySelector('.more-options-btn');
    expect(moreBtn).toBeNull();
  });

  it('should not render 3-dot menu button on general lists', () => {
    const { fixture } = createComponent({
      isOwner: true,
      isGeneralList: true,
    });

    const moreBtn = fixture.nativeElement.querySelector('.more-options-btn');
    expect(moreBtn).toBeNull();
  });

  it('should render item favicon when item has a valid URL and hide it on error', () => {
    const { fixture } = createComponent({
      item: {
        name: 'Board Game',
        url: 'https://a.co/d/example',
        affiliateUrl:
          'https://www.amazon.com/dp/B001/ref=nosim?tag=swishlist0c-20',
        purchased: false,
        details: '',
      },
    });

    const favicon = fixture.nativeElement.querySelector(
      'img.item-favicon',
    ) as HTMLImageElement | null;
    expect(favicon).toBeTruthy();
    expect(favicon!.src).toBe(
      'https://www.google.com/s2/favicons?domain=www.amazon.com&sz=64',
    );

    favicon!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img.item-favicon')).toBeNull();
  });

  it('should not render item favicon when item has no URL', () => {
    const { fixture } = createComponent({
      item: {
        name: 'Board Game',
        url: '',
        purchased: false,
        details: '',
      },
    });

    expect(fixture.nativeElement.querySelector('img.item-favicon')).toBeNull();
  });
});
