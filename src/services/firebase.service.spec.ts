import { TestBed } from '@angular/core/testing';

import { FirebaseService } from './firebase.service';
import { StorageService } from './storage.service';
import { User } from '../models/user';

describe('FirebaseService', () => {
  let service: FirebaseService;
  let storageService: StorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    storageService = TestBed.inject(StorageService);
    service = TestBed.inject(FirebaseService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('pruneRecentLists', () => {
    it('should keep the 30 most recent lists and return dropped IDs', () => {
      const input: { [id: string]: string } = {};
      for (let i = 1; i <= 35; i++) {
        input[`list-${i}`] = new Date(Date.UTC(2026, 0, i)).toISOString();
      }

      const { pruned, droppedIds } = service.pruneRecentLists(input);

      expect(Object.keys(pruned).length).toBe(30);
      expect(droppedIds.length).toBe(5);
      expect(droppedIds).toEqual([
        'list-5',
        'list-4',
        'list-3',
        'list-2',
        'list-1',
      ]);
      expect(pruned['list-35']).toBe(new Date(Date.UTC(2026, 0, 35)).toISOString());
      expect(pruned['list-1']).toBeUndefined();
    });
  });

  describe('mergeRecentLists', () => {
    it('should keep newer timestamps from both account and local storage', () => {
      const accountRecent = {
        a: '2026-01-05T00:00:00.000Z',
        b: '2026-01-10T00:00:00.000Z',
      };
      const localRecent = {
        a: '2026-01-08T00:00:00.000Z',
        b: '2026-01-02T00:00:00.000Z',
        c: '2026-01-12T00:00:00.000Z',
      };

      const { merged, changed } = service.mergeRecentLists(
        accountRecent,
        localRecent,
      );

      expect(changed).toBeTrue();
      expect(merged).toEqual({
        c: '2026-01-12T00:00:00.000Z',
        b: '2026-01-10T00:00:00.000Z',
        a: '2026-01-08T00:00:00.000Z',
      });
    });

    it('should report changed=false when local entries are older or absent', () => {
      const accountRecent = {
        a: '2026-01-10T00:00:00.000Z',
      };
      const localRecent = {
        a: '2026-01-05T00:00:00.000Z',
      };

      const { merged, changed } = service.mergeRecentLists(
        accountRecent,
        localRecent,
      );

      expect(changed).toBeFalse();
      expect(merged).toEqual(accountRecent);
    });

    it('should cap merged entries at 30', () => {
      const accountRecent: { [id: string]: string } = {};
      for (let i = 1; i <= 25; i++) {
        accountRecent[`acct-${i}`] = new Date(
          Date.UTC(2026, 0, i),
        ).toISOString();
      }
      const localRecent: { [id: string]: string } = {};
      for (let i = 1; i <= 10; i++) {
        localRecent[`local-${i}`] = new Date(
          Date.UTC(2026, 1, i),
        ).toISOString();
      }

      const { merged, changed } = service.mergeRecentLists(
        accountRecent,
        localRecent,
      );

      expect(changed).toBeTrue();
      expect(Object.keys(merged).length).toBe(30);
      expect(merged['local-10']).toBeDefined();
      expect(merged['acct-1']).toBeUndefined();
    });
  });

  describe('getSortedRecentListIds', () => {
    it('should use account recentLists when a user is provided and merge any lingering local entries', () => {
      localStorage.setItem(
        'recentLists',
        JSON.stringify({
          'local-list': '2026-02-01T00:00:00.000Z',
        }),
      );
      const user: User = {
        id: 'u1',
        name: 'Test User',
        email: 'test@example.com',
        recentLists: {
          'acct-old': '2026-01-01T00:00:00.000Z',
          'acct-new': '2026-03-01T00:00:00.000Z',
        },
      };

      expect(service.getSortedRecentListIds(user)).toEqual([
        'acct-new',
        'local-list',
        'acct-old',
      ]);
    });

    it('should fall back to localStorage when signed out', () => {
      localStorage.setItem(
        'recentLists',
        JSON.stringify({
          first: '2026-01-01T00:00:00.000Z',
          second: '2026-02-01T00:00:00.000Z',
        }),
      );
      expect(storageService.getSortedRecentListIds()).toEqual([
        'second',
        'first',
      ]);
      expect(service.getSortedRecentListIds(null)).toEqual(['second', 'first']);
    });
  });

  describe('mergeSpoilerChoices', () => {
    it('should preserve account choices and fill in new local choices', () => {
      const accountChoices = { 'list-a': true, 'list-b': false };
      const localChoices = { 'list-a': false, 'list-c': true };

      const { merged, changed } = service.mergeSpoilerChoices(
        accountChoices,
        localChoices,
      );

      expect(changed).toBeTrue();
      expect(merged).toEqual({
        'list-a': true,
        'list-b': false,
        'list-c': true,
      });
    });

    it('should report changed=false when local choices add no new keys', () => {
      const accountChoices = { 'list-a': true };
      const localChoices = { 'list-a': false };

      const { merged, changed } = service.mergeSpoilerChoices(
        accountChoices,
        localChoices,
      );

      expect(changed).toBeFalse();
      expect(merged).toEqual({ 'list-a': true });
    });
  });

  describe('spoilerChoices', () => {
    it('should prefer account spoilerChoices over localStorage when signed in', () => {
      localStorage.setItem(
        'spoilerChoices',
        JSON.stringify({ 'list-1': false, 'list-local': true }),
      );
      const user: User = {
        id: 'u1',
        name: 'Test User',
        email: 'test@example.com',
        spoilerChoices: { 'list-1': true },
      };

      expect(service.hasSpoilerChoice('list-1', user)).toBeTrue();
      expect(service.getSpoilerChoice('list-1', user)).toBeTrue();
      expect(service.getSpoilerChoice('list-local', user)).toBeTrue();
      expect(service.hasSpoilerChoice('list-missing', user)).toBeFalse();
    });

    it('should fall back to localStorage when signed out', () => {
      localStorage.setItem(
        'spoilerChoices',
        JSON.stringify({ 'list-1': false }),
      );

      expect(service.hasSpoilerChoice('list-1', null)).toBeTrue();
      expect(service.getSpoilerChoice('list-1', null)).toBeFalse();
      expect(service.hasSpoilerChoice('list-2', null)).toBeFalse();
    });
  });

  describe('availabilityChecks', () => {
    it('should allow availability check when no prior check exists', () => {
      expect(service.canCheckAvailability('list-1')).toBeTrue();
      expect(service.getLastAvailabilityCheckDate('list-1')).toBeNull();
    });

    it('should enforce once-per-calendar-day lockout per list using cached or provided list', () => {
      const todayLate = new Date(2026, 10, 26, 23, 55, 0);
      const sameDayLater = new Date(2026, 10, 26, 23, 59, 0);
      const nextDayEarly = new Date(2026, 10, 27, 0, 5, 0);

      service.cacheList({
        id: 'list-1',
        name: 'Birthday',
        creatorID: 'u1',
        lastAvailabilityCheckDate: service.getLocalDateKey(todayLate),
      });

      expect(service.getLastAvailabilityCheckDate('list-1')).toBe('2026-11-26');
      expect(service.canCheckAvailability('list-1', sameDayLater)).toBeFalse();

      // Independent per list
      expect(service.canCheckAvailability('list-2', sameDayLater)).toBeTrue();

      // Resets on the next calendar day even if less than 24 hours later
      expect(service.canCheckAvailability('list-1', nextDayEarly)).toBeTrue();

      // Works directly with a fresh List object
      expect(
        service.canCheckAvailability(
          {
            id: 'list-fresh',
            name: 'Fresh',
            creatorID: 'u1',
            lastAvailabilityCheckDate: '2026-11-26',
          },
          sameDayLater,
        ),
      ).toBeFalse();
    });
  });
});
