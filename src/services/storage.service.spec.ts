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

  it('should allow availability check when no prior check exists', () => {
    expect(service.canCheckAvailability('list-1')).toBeTrue();
    expect(service.getAvailabilityCheckCooldownRemainingMs('list-1')).toBe(0);
  });

  it('should enforce 24-hour cooldown per list after recording a check', () => {
    const start = 1_700_000_000_000;
    service.recordAvailabilityCheck('list-1', start);

    const oneHourLater = start + 60 * 60 * 1000;
    expect(service.canCheckAvailability('list-1', oneHourLater)).toBeFalse();
    expect(
      service.getAvailabilityCheckCooldownRemainingMs('list-1', oneHourLater),
    ).toBe(23 * 60 * 60 * 1000);

    // Independent per list
    expect(service.canCheckAvailability('list-2', oneHourLater)).toBeTrue();

    // Cooldown expires after 24 hours
    const afterCooldown = start + 24 * 60 * 60 * 1000;
    expect(service.canCheckAvailability('list-1', afterCooldown)).toBeTrue();
    expect(
      service.getAvailabilityCheckCooldownRemainingMs('list-1', afterCooldown),
    ).toBe(0);
  });
});
