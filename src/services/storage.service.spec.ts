import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(StorageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add, remove, and clear recent lists', () => {
    service.addRecentList('list-1');
    service.addRecentList('list-2');
    expect(Object.keys(service.getRecentLists())).toEqual(['list-1', 'list-2']);

    service.removeRecentList('list-1');
    expect(Object.keys(service.getRecentLists())).toEqual(['list-2']);

    service.clearRecentLists();
    expect(service.getRecentLists()).toEqual({});
  });

  it('should sort recent list IDs descending by timestamp with invalid date fallback', () => {
    const sorted = service.sortRecentListIds({
      oldest: '2026-01-01T00:00:00.000Z',
      invalid: 'not-a-date',
      newest: '2026-03-01T00:00:00.000Z',
      middle: '2026-02-01T00:00:00.000Z',
    });

    expect(sorted).toEqual(['newest', 'middle', 'oldest', 'invalid']);
  });

  it('should read sorted recent list IDs from localStorage', () => {
    localStorage.setItem(
      'recentLists',
      JSON.stringify({
        a: '2026-01-01T00:00:00.000Z',
        b: '2026-05-01T00:00:00.000Z',
      }),
    );

    expect(service.getSortedRecentListIds()).toEqual(['b', 'a']);
  });

  it('should recover gracefully from corrupt JSON in localStorage', () => {
    localStorage.setItem('recentLists', '{bad json');
    localStorage.setItem('spoilerChoices', '["not-an-object"]');

    expect(service.getRecentLists()).toEqual({});
    expect(service.getSpoilerChoices()).toEqual({});
  });

  it('should allow availability check when no prior check exists', () => {
    expect(service.canCheckAvailability('list-1')).toBeTrue();
    expect(service.getLastAvailabilityCheckDate('list-1')).toBeNull();
  });

  it('should enforce once-per-calendar-day lockout per list', () => {
    const todayLate = new Date(2026, 10, 26, 23, 55, 0);
    const sameDayLater = new Date(2026, 10, 26, 23, 59, 0);
    const nextDayEarly = new Date(2026, 10, 27, 0, 5, 0);

    service.recordAvailabilityCheck('list-1', todayLate);

    expect(service.getLastAvailabilityCheckDate('list-1')).toBe('2026-11-26');
    expect(service.canCheckAvailability('list-1', sameDayLater)).toBeFalse();

    // Independent per list
    expect(service.canCheckAvailability('list-2', sameDayLater)).toBeTrue();

    // Resets on the next calendar day even if less than 24 hours later
    expect(service.canCheckAvailability('list-1', nextDayEarly)).toBeTrue();
  });
});
