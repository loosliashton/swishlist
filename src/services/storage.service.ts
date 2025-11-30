import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly LAST_EMAIL_KEY = 'lastEmail';
  private readonly RECENT_LISTS_KEY = 'recentLists';
  private readonly SPOILER_CHOICES_KEY = 'spoilerChoices';

  constructor() {}

  getLastEmail(): string | null {
    return localStorage.getItem(this.LAST_EMAIL_KEY);
  }

  setLastEmail(email: string): void {
    localStorage.setItem(this.LAST_EMAIL_KEY, email);
  }

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
}
