import { Component, Inject, Optional } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface GiftSwapPair {
  giver: string;
  receiver: string;
}

@Component({
  selector: 'app-gift-swap',
  templateUrl: './gift-swap.component.html',
  styleUrl: './gift-swap.component.css',
  standalone: false,
})
export class GiftSwapComponent {
  newName: string = '';
  participants: string[] = [];
  pairs: GiftSwapPair[] = [];
  showResults: boolean = false;
  readonly canNativeShare: boolean =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  constructor(
    @Optional() @Inject(MAT_DIALOG_DATA) public data: { theme?: string } | null,
    public dialogRef: MatDialogRef<GiftSwapComponent>,
    private clipboard: Clipboard,
    private snackbar: MatSnackBar,
  ) {}

  addNamesFromInput(): void {
    const raw = this.newName.trim();
    if (!raw) {
      return;
    }

    const candidates = raw
      .split(/[\n,;]+/)
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    const existingLower = new Set(
      this.participants.map((p) => p.toLowerCase()),
    );
    let addedCount = 0;
    let duplicateCount = 0;

    for (const candidate of candidates) {
      const lower = candidate.toLowerCase();
      if (existingLower.has(lower)) {
        duplicateCount++;
        continue;
      }
      existingLower.add(lower);
      this.participants.push(candidate);
      addedCount++;
    }

    this.newName = '';

    if (addedCount === 0 && duplicateCount > 0) {
      this.snackbar.open('That name is already in the list', 'Close', {
        duration: 2000,
      });
    } else if (duplicateCount > 0) {
      this.snackbar.open(
        `Added ${addedCount} name(s), skipped ${duplicateCount} duplicate(s)`,
        'Close',
        { duration: 2500 },
      );
    }
  }

  onInputPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text') ?? '';
    if (/[\n,;]/.test(pasted)) {
      event.preventDefault();
      const combined = this.newName ? `${this.newName}\n${pasted}` : pasted;
      this.newName = combined;
      this.addNamesFromInput();
    }
  }

  removeParticipant(index: number): void {
    this.participants.splice(index, 1);
  }

  clearAll(): void {
    this.participants = [];
    this.pairs = [];
    this.showResults = false;
  }

  generateSwap(): void {
    if (this.newName.trim()) {
      this.addNamesFromInput();
    }

    if (this.participants.length < 2) {
      this.snackbar.open('Add at least 2 names to generate a swap', 'Close', {
        duration: 2500,
      });
      return;
    }

    this.pairs = this.createSingleCyclePairs(this.participants);
    this.showResults = true;
  }

  editNames(): void {
    this.showResults = false;
  }

  createSingleCyclePairs(names: string[]): GiftSwapPair[] {
    if (names.length < 2) {
      return [];
    }

    const shuffled = [...names];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.map((giver, index) => ({
      giver,
      receiver: shuffled[(index + 1) % shuffled.length],
    }));
  }

  getFormattedResults(): string {
    const lines = this.pairs.map((p) => `• ${p.giver} → ${p.receiver}`);
    return `Gift Swap:\n${lines.join('\n')}`;
  }

  copyResults(): void {
    if (!this.pairs.length) return;
    this.clipboard.copy(this.getFormattedResults());
    this.snackbar.open('Copied to clipboard!', 'Dismiss', {
      duration: 2500,
    });
  }

  async shareResults(): Promise<void> {
    if (!this.pairs.length || !this.canNativeShare) return;
    try {
      await navigator.share({
        title: 'Gift Swap',
        text: this.getFormattedResults(),
      });
    } catch (error) {
      console.log('Share cancelled or failed', error);
    }
  }
}
