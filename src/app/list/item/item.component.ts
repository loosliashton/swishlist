import { Component, EventEmitter, Inject, Output } from '@angular/core';

import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import { Item } from 'src/models/item';
import { RecentListsModalComponent } from './recent-lists-modal/recent-lists-modal.component';
import { RecentListsModalFunctionality } from './recent-lists-modal/recent-lists-modal-functionality.enum';

@Component({
  selector: 'app-item',
  templateUrl: './item.component.html',
  styleUrls: ['./item.component.css'],
  standalone: false,
})
export class ItemComponent {
  item: Item;
  spoilers: boolean;
  @Output() copiedListEvent = new EventEmitter<string>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<ItemComponent>,
    public dialog: MatDialog,
  ) {
    this.item = data.item;
    this.spoilers = data.spoilers;
  }

  togglePurchase() {
    this.item.purchased = !this.item.purchased;
    this.dialogRef.close(true);
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
