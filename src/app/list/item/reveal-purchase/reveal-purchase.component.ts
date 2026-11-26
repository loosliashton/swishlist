import { ChangeDetectorRef, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Item } from 'src/models/item';
import { FirebaseService } from 'src/services/firebase.service';
import { StorageService } from 'src/services/storage.service';

export interface RevealPurchaseDialogData {
  item: Item;
  listId?: string;
  itemIndex?: number;
}

export type RevealPurchaseDialogResult = 'remove' | undefined;

@Component({
  selector: 'app-reveal-purchase',
  templateUrl: './reveal-purchase.component.html',
  styleUrl: './reveal-purchase.component.css',
  standalone: false,
})
export class RevealPurchaseComponent {
  step: 'cooldown' | 'confirm' | 'loading' | 'revealed' | 'error' = 'confirm';
  purchased: boolean = false;
  cooldownRemainingText: string = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: RevealPurchaseDialogData,
    public dialogRef: MatDialogRef<
      RevealPurchaseComponent,
      RevealPurchaseDialogResult
    >,
    private firebase: FirebaseService,
    private storageService: StorageService,
    private cdr: ChangeDetectorRef,
  ) {
    if (this.data.listId) {
      const remainingMs =
        this.storageService.getAvailabilityCheckCooldownRemainingMs(
          this.data.listId,
        );
      if (remainingMs > 0) {
        this.cooldownRemainingText = this.formatRemainingTime(remainingMs);
        this.step = 'cooldown';
      }
    }
  }

  async confirmReveal(): Promise<void> {
    if (
      this.step === 'cooldown' ||
      this.step === 'loading' ||
      this.step === 'revealed'
    ) {
      return;
    }

    if (this.data.listId) {
      const remainingMs =
        this.storageService.getAvailabilityCheckCooldownRemainingMs(
          this.data.listId,
        );
      if (remainingMs > 0) {
        this.cooldownRemainingText = this.formatRemainingTime(remainingMs);
        this.step = 'cooldown';
        this.cdr.detectChanges();
        return;
      }
    }

    if (!this.data.listId) {
      this.purchased = !!this.data.item.purchased;
      this.step = 'revealed';
      return;
    }

    this.step = 'loading';
    try {
      const freshList = await this.firebase.getList(this.data.listId);
      let latestItem: Item | undefined;
      if (
        typeof this.data.itemIndex === 'number' &&
        freshList?.items?.[this.data.itemIndex]?.name === this.data.item.name
      ) {
        latestItem = freshList.items[this.data.itemIndex];
      } else {
        latestItem = freshList?.items?.find(
          (i) =>
            i.name === this.data.item.name &&
            i.url === this.data.item.url &&
            i.details === this.data.item.details,
        );
      }

      this.purchased = !!(latestItem ?? this.data.item).purchased;
      this.data.item.purchased = this.purchased;
      this.storageService.recordAvailabilityCheck(this.data.listId);
      this.step = 'revealed';
    } catch (error) {
      console.error('Error checking purchase status:', error);
      this.step = 'error';
    } finally {
      this.cdr.detectChanges();
    }
  }

  removeFromList(): void {
    this.dialogRef.close('remove');
  }

  private formatRemainingTime(remainingMs: number): string {
    const totalMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
    if (totalMinutes < 60) {
      return `${totalMinutes} ${totalMinutes === 1 ? 'minute' : 'minutes'}`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hourText = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    if (minutes === 0) {
      return hourText;
    }
    const minuteText = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    return `${hourText} and ${minuteText}`;
  }
}
