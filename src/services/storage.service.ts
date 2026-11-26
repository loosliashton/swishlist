import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly RECENT_LISTS_KEY = 'recentLists';
  private readonly SPOILER_CHOICES_KEY = 'spoilerChoices';
  private readonly AVAILABILITY_CHECKS_KEY = 'availabilityChecks';
  readonly AVAILABILITY_CHECK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

  constructor() {}

  getRecentLists(): { [id: string]: string } {
    return JSON.parse(localStorage.getItem(this.RECENT_LISTS_KEY) || '{}');
  }

  addRecentList(id: string): void {
    const recentLists = this.getRecentLists();
    recentLists[id] = new Date().toISOString();
    localStorage.setItem(this.RECENT_LISTS_KEY, JSON.stringify(recentLists));
  }

  removeRecentList(id: string): void {
    const recentLists = this.getRecentLists();
    if (recentLists[id]) {
      delete recentLists[id];
      localStorage.setItem(this.RECENT_LISTS_KEY, JSON.stringify(recentLists));
    }
  }

  getSortedRecentListIds(): string[] {
    const recentListsObject = this.getRecentLists();
    return Object.keys(recentListsObject).sort((a, b) => {
      const dateA = new Date(recentListsObject[a]);
      const dateB = new Date(recentListsObject[b]);
      return dateB.getTime() - dateA.getTime();
    });
  }

  getSpoilerChoices(): { [id: string]: boolean } {
    return JSON.parse(localStorage.getItem(this.SPOILER_CHOICES_KEY) || '{}');
  }

  setSpoilerChoice(id: string, choice: boolean): void {
    const choices = this.getSpoilerChoices();
    choices[id] = choice;
    localStorage.setItem(this.SPOILER_CHOICES_KEY, JSON.stringify(choices));
  }

  removeSpoilerChoice(id: string): void {
    const choices = this.getSpoilerChoices();
    if (choices[id] !== undefined) {
      delete choices[id];
      localStorage.setItem(this.SPOILER_CHOICES_KEY, JSON.stringify(choices));
    }
  }

  hasSpoilerChoice(id: string): boolean {
    const choices = this.getSpoilerChoices();
    return choices[id] !== undefined;
  }

  getSpoilerChoice(id: string): boolean | undefined {
    const choices = this.getSpoilerChoices();
    return choices[id];
  }

  getAvailabilityChecks(): { [listId: string]: number } {
    try {
      return JSON.parse(
        localStorage.getItem(this.AVAILABILITY_CHECKS_KEY) || '{}',
      );
    } catch {
      return {};
    }
  }

  getLastAvailabilityCheck(listId: string): number | null {
    const checks = this.getAvailabilityChecks();
    const timestamp = checks[listId];
    return typeof timestamp === 'number' && !isNaN(timestamp)
      ? timestamp
      : null;
  }

  recordAvailabilityCheck(listId: string, timestamp: number = Date.now()): void {
    const checks = this.getAvailabilityChecks();
    checks[listId] = timestamp;
    localStorage.setItem(this.AVAILABILITY_CHECKS_KEY, JSON.stringify(checks));
  }

  getAvailabilityCheckCooldownRemainingMs(
    listId: string,
    now: number = Date.now(),
  ): number {
    const lastCheck = this.getLastAvailabilityCheck(listId);
    if (lastCheck === null) return 0;
    const elapsed = now - lastCheck;
    return Math.max(0, this.AVAILABILITY_CHECK_COOLDOWN_MS - elapsed);
  }

  canCheckAvailability(listId: string, now: number = Date.now()): boolean {
    return this.getAvailabilityCheckCooldownRemainingMs(listId, now) === 0;
  }
}
