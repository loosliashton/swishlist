import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly RECENT_LISTS_KEY = 'recentLists';
  private readonly SPOILER_CHOICES_KEY = 'spoilerChoices';

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
}
