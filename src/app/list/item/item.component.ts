import { Component, EventEmitter, Inject, Output } from '@angular/core';

import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import { Item } from 'src/models/item';
import { RecentListsModalComponent } from './recent-lists-modal/recent-lists-modal.component';
import { RecentListsModalFunctionality } from './recent-lists-modal/recent-lists-modal-functionality.enum';
import { RevealPurchaseComponent } from './reveal-purchase/reveal-purchase.component';
import { getItemFaviconUrl } from 'src/utils/favicon';

@Component({
  selector: 'app-item',
  templateUrl: './item.component.html',
  styleUrls: ['./item.component.css'],
  standalone: false,
})
export class ItemComponent {
  item: Item;
  faviconUrl: string | null = null;
  listId: string | undefined;
  itemIndex: number | undefined;
  spoilers: boolean;
  isGeneralList: boolean = false;
  isOwner: boolean = false;
  @Output() copiedListEvent = new EventEmitter<string>();
  @Output() editItemEvent = new EventEmitter<void>();
  @Output() removeItemEvent = new EventEmitter<void>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<ItemComponent>,
    public dialog: MatDialog,
  ) {
    this.item = data.item;
    this.faviconUrl = getItemFaviconUrl(this.item);
    this.listId = data.listId;
    this.itemIndex = data.itemIndex;
    this.spoilers = !!data.spoilers;
    this.isGeneralList = !!data.isGeneralList;
    this.isOwner = !!data.isOwner;
  }

  onFaviconError() {
    this.faviconUrl = null;
  }

  togglePurchase() {
    this.item.purchased = !this.item.purchased;
    this.dialogRef.close(true);
  }

  onEditItem() {
    this.editItemEvent.emit();
    this.dialogRef.close();
  }

  openRevealPurchaseModal() {
    if (!this.isOwner || this.isGeneralList) return;
    const revealDialogRef = this.dialog.open(RevealPurchaseComponent, {
      data: {
        item: this.item,
        listId: this.listId,
        itemIndex: this.itemIndex,
      },
      width: '90vw',
      maxWidth: '420px',
    });

    revealDialogRef?.afterClosed().subscribe((result) => {
      if (result === 'remove') {
        this.removeItemEvent.emit();
        this.dialogRef.close();
      }
    });
  }

  openCopyToListModal() {
    const dialogRef = this.dialog.open(RecentListsModalComponent, {
      data: {
        item: this.item,
        functionality: RecentListsModalFunctionality.CopyItemToList,
      },
      width: '600px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.copiedListEvent.emit(result);
      }
    });
  }
}
