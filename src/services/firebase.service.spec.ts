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
});
