import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly RECENT_LISTS_KEY = 'recentLists';
  private readonly SPOILER_CHOICES_KEY = 'spoilerChoices';
  private readonly AVAILABILITY_CHECKS_KEY = 'availabilityChecks';

  constructor() {}

  getRecentLists(): { [id: string]: string } {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.RECENT_LISTS_KEY) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
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

  clearRecentLists(): void {
    localStorage.removeItem(this.RECENT_LISTS_KEY);
  }

  sortRecentListIds(recentLists: { [id: string]: string }): string[] {
    return Object.keys(recentLists).sort((a, b) => {
      const timeA = new Date(recentLists[a]).getTime() || 0;
      const timeB = new Date(recentLists[b]).getTime() || 0;
      return timeB - timeA;
    });
  }

  getSortedRecentListIds(): string[] {
    return this.sortRecentListIds(this.getRecentLists());
  }

  getSpoilerChoices(): { [id: string]: boolean } {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(this.SPOILER_CHOICES_KEY) || '{}',
      );
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
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

  private getLocalDateKey(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getAvailabilityChecks(): { [listId: string]: string | number } {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(this.AVAILABILITY_CHECKS_KEY) || '{}',
      );
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  getLastAvailabilityCheckDate(listId: string): string | null {
    const checks = this.getAvailabilityChecks();
    const value = checks[listId];
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    if (typeof value === 'number' && !isNaN(value)) {
      return this.getLocalDateKey(new Date(value));
    }
    return null;
  }

  recordAvailabilityCheck(listId: string, date: Date = new Date()): void {
    const checks = this.getAvailabilityChecks();
    checks[listId] = this.getLocalDateKey(date);
    localStorage.setItem(this.AVAILABILITY_CHECKS_KEY, JSON.stringify(checks));
  }

  canCheckAvailability(listId: string, now: Date = new Date()): boolean {
    return this.getLastAvailabilityCheckDate(listId) !== this.getLocalDateKey(now);
  }
}
