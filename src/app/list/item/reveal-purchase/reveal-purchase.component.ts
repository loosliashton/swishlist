import { ChangeDetectorRef, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Item } from 'src/models/item';
import { FirebaseService } from 'src/services/firebase.service';

export interface RevealPurchaseDialogData {
  item: Item;
  listId?: string;
  itemIndex?: number;
}

@Component({
  selector: 'app-reveal-purchase',
  templateUrl: './reveal-purchase.component.html',
  styleUrl: './reveal-purchase.component.css',
  standalone: false,
})
export class RevealPurchaseComponent {
  step: 'confirm' | 'loading' | 'revealed' | 'error' = 'confirm';
  purchased: boolean = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: RevealPurchaseDialogData,
    public dialogRef: MatDialogRef<RevealPurchaseComponent>,
    private firebase: FirebaseService,
    private cdr: ChangeDetectorRef,
  ) {}

  async confirmReveal(): Promise<void> {
    if (this.step === 'loading' || this.step === 'revealed') return;

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
      this.step = 'revealed';
    } catch (error) {
      console.error('Error checking purchase status:', error);
      this.step = 'error';
    } finally {
      this.cdr.detectChanges();
    }
  }
}
