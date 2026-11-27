import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of } from 'rxjs';

import { ListComponent } from './list.component';
import { FirebaseService } from '../../services/firebase.service';
import { List } from '../../models/list';
import { User } from '../../models/user';

describe('ListComponent', () => {
  let component: ListComponent;
  let fixture: ComponentFixture<ListComponent>;
  let currentUserSubject: BehaviorSubject<User | null>;
  let firebaseSpy: jasmine.SpyObj<FirebaseService>;
  let dialogSpy: jasmine.SpyObj<MatDialog>;
  let snackbarSpy: jasmine.SpyObj<MatSnackBar>;
  let titleSpy: jasmine.SpyObj<Title>;

  const ownerUser: User = {
    id: 'owner-1',
    name: 'Alice',
    email: 'alice@example.com',
  };

  const otherUser: User = {
    id: 'viewer-2',
    name: 'Bob',
    email: 'bob@example.com',
  };

  function createList(overrides: Partial<List> = {}): List {
    return {
      id: 'list-1',
      name: 'Birthday List',
      type: 'gift',
      creatorID: ownerUser.id!,
      items: [
        {
          name: 'Book',
          url: '',
          purchased: false,
          details: '',
        },
      ],
      lastModified: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    currentUserSubject = new BehaviorSubject<User | null>(null);
    firebaseSpy = jasmine.createSpyObj(
      'FirebaseService',
      [
        'waitForAuthReady',
        'getList',
        'getUserById',
        'addRecentList',
        'cacheList',
        'cacheUser',
        'saveList',
        'updateListItems',
        'getCachedListsFromIds',
        'hasSpoilerChoice',
        'getSpoilerChoice',
        'removeSpoilerChoice',
      ],
      {
        currentUser$: currentUserSubject.asObservable(),
        currentUser: null,
      },
    );
    firebaseSpy.waitForAuthReady.and.resolveTo(null);
    firebaseSpy.getList.and.resolveTo(null);
    firebaseSpy.getUserById.and.resolveTo(ownerUser);
    firebaseSpy.addRecentList.and.resolveTo();
    firebaseSpy.updateListItems.and.resolveTo(true);
    firebaseSpy.getCachedListsFromIds.and.returnValue(null);
    firebaseSpy.hasSpoilerChoice.and.returnValue(true);
    firebaseSpy.getSpoilerChoice.and.returnValue(true);
    firebaseSpy.removeSpoilerChoice.and.resolveTo();

    dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);
    snackbarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);
    titleSpy = jasmine.createSpyObj('Title', ['setTitle']);

    await TestBed.configureTestingModule({
      declarations: [ListComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({})) },
        },
        { provide: FirebaseService, useValue: firebaseSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: MatSnackBar, useValue: snackbarSpy },
        { provide: Title, useValue: titleSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ListComponent);
    component = fixture.componentInstance;
    component.creator = ownerUser;
    component.loading = false;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('last modified message visibility', () => {
    it('should show subtle last-modified message when viewing someone else’s list while signed in', () => {
      component.currentUser = otherUser;
      component.list = createList();
      component.loading = false;
      fixture.detectChanges();

      const notice: HTMLElement | null = fixture.nativeElement.querySelector(
        '.last-modified-notice',
      );
      expect(notice).toBeTruthy();
      expect(notice!.textContent).toContain('Last updated 2 hours ago');
      expect(notice!.getAttribute('title')).toBeTruthy();
    });

    it('should show subtle last-modified message when viewing a list while signed out', () => {
      component.currentUser = null;
      component.list = createList();
      component.loading = false;
      fixture.detectChanges();

      const notice: HTMLElement | null = fixture.nativeElement.querySelector(
        '.last-modified-notice',
      );
      expect(notice).toBeTruthy();
      expect(notice!.textContent).toContain('Last updated 2 hours ago');
    });

    it('should hide last-modified message when viewing your own list', () => {
      component.currentUser = ownerUser;
      component.list = createList();
      component.loading = false;
      fixture.detectChanges();

      const notice: HTMLElement | null = fixture.nativeElement.querySelector(
        '.last-modified-notice',
      );
      expect(notice).toBeNull();
    });

    it('should hide last-modified message when list has no lastModified timestamp', () => {
      component.currentUser = otherUser;
      component.list = createList({ lastModified: undefined });
      component.loading = false;
      fixture.detectChanges();

      const notice: HTMLElement | null = fixture.nativeElement.querySelector(
        '.last-modified-notice',
      );
      expect(notice).toBeNull();
    });

    it('should hide last-modified message while loading', () => {
      component.currentUser = otherUser;
      component.list = createList();
      component.loading = true;
      fixture.detectChanges();

      const notice: HTMLElement | null = fixture.nativeElement.querySelector(
        '.last-modified-notice',
      );
      expect(notice).toBeNull();
    });
  });

  describe('formatLastModified', () => {
    const now = new Date('2026-11-26T12:00:00.000Z');

    it('should return null for missing or invalid timestamps', () => {
      expect(component.formatLastModified(undefined, now)).toBeNull();
      expect(component.formatLastModified('not-a-date', now)).toBeNull();
    });

    it('should format timestamps under 1 minute as just now', () => {
      const ts = new Date(now.getTime() - 30_000).toISOString();
      expect(component.formatLastModified(ts, now)).toBe(
        'Last updated just now',
      );
    });

    it('should format singular and plural minutes', () => {
      const oneMin = new Date(now.getTime() - 60_000).toISOString();
      const fiveMins = new Date(now.getTime() - 5 * 60_000).toISOString();
      expect(component.formatLastModified(oneMin, now)).toBe(
        'Last updated 1 minute ago',
      );
      expect(component.formatLastModified(fiveMins, now)).toBe(
        'Last updated 5 minutes ago',
      );
    });

    it('should format singular and plural hours', () => {
      const oneHour = new Date(now.getTime() - 3_600_000).toISOString();
      const fourHours = new Date(now.getTime() - 4 * 3_600_000).toISOString();
      expect(component.formatLastModified(oneHour, now)).toBe(
        'Last updated 1 hour ago',
      );
      expect(component.formatLastModified(fourHours, now)).toBe(
        'Last updated 4 hours ago',
      );
    });

    it('should format yesterday and multiple days ago', () => {
      const yesterday = new Date(now.getTime() - 86_400_000).toISOString();
      const fourDays = new Date(now.getTime() - 4 * 86_400_000).toISOString();
      expect(component.formatLastModified(yesterday, now)).toBe(
        'Last updated yesterday',
      );
      expect(component.formatLastModified(fourDays, now)).toBe(
        'Last updated 4 days ago',
      );
    });

    it('should format dates 7 or more days ago as a readable date', () => {
      const older = '2026-10-15T12:00:00.000Z';
      const result = component.formatLastModified(older, now);
      expect(result).toBeTruthy();
      expect(result!.startsWith('Last updated ')).toBeTrue();
      expect(result).toContain('2026');
    });
  });

  describe('saveItemsOnly', () => {
    it('should not update lastModified when a non-owner updates items', async () => {
      component.currentUser = otherUser;
      component.list = createList();

      await component.saveItemsOnly();

      expect(firebaseSpy.updateListItems).toHaveBeenCalledWith(
        'list-1',
        component.list.items!,
        false,
      );
    });

    it('should update lastModified when the owner updates items', async () => {
      component.currentUser = ownerUser;
      component.list = createList({ type: 'general' });

      await component.saveItemsOnly();

      expect(firebaseSpy.updateListItems).toHaveBeenCalledWith(
        'list-1',
        component.list.items!,
        true,
      );
    });
  });
});
