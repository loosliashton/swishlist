import { Component, OnInit, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  MatDialogModule,
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialog,
} from '@angular/material/dialog';
import { List } from 'src/models/list';
import { Item } from 'src/models/item';
import { FirebaseService } from 'src/services/firebase.service';
import { RecentListComponent } from 'src/app/list/recent-list/recent-list.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AddItemComponent } from '../../add-item/add-item.component';
import { RecentListsModalFunctionality } from './recent-lists-modal-functionality.enum';
import { User } from 'src/models/user';
import { StorageService } from 'src/services/storage.service';

@Component({
  selector: 'app-recent-lists-modal',
  imports: [CommonModule, MatDialogModule, RecentListComponent],
  templateUrl: './recent-lists-modal.component.html',
  styleUrl: './recent-lists-modal.component.css',
})
export class RecentListsModalComponent implements OnInit {
  recentListItems: { list: List; creator: User | null }[] = [];
  loading: boolean = false;
  copyLoading: boolean = false;
  functionality: RecentListsModalFunctionality =
    RecentListsModalFunctionality.NavigateToList;
  item: Item | null = null;
  title: string;
  currentListId: string | null = null;

  constructor(
    private router: Router,
    private firebase: FirebaseService,
    private snackbar: MatSnackBar,
    public dialogRef: MatDialogRef<RecentListsModalComponent>,
    public dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      item: Item;
      functionality: RecentListsModalFunctionality;
      currentListId?: string;
    },
    private storageService: StorageService,
  ) {
    this.item = data.item;
    this.currentListId = data.currentListId || null;
    this.functionality = data.functionality;
    switch (this.functionality) {
      case RecentListsModalFunctionality.AddItemToList:
        this.title = 'Select a list to add to:';
        break;
      case RecentListsModalFunctionality.CopyItemToList:
        this.title = 'Select a list to copy to:';
        break;
      case RecentListsModalFunctionality.NavigateToList:
      default:
        this.title = 'Select a list to view:';
        break;
    }
  }

  async ngOnInit() {
    // Retrieve recent lists
    const sortedIds = this.storageService.getSortedRecentListIds();
    if (!sortedIds.length) return;
    this.loading = true;

    this.recentListItems = await this.firebase.getListsWithCreators(
      sortedIds.slice(0, 10),
    );

    if (this.functionality === RecentListsModalFunctionality.NavigateToList) {
      // Filter out the currenct list
      const index = this.recentListItems.findIndex(
        (item) => item.list.id === this.currentListId,
      );
      if (index !== -1) {
        this.recentListItems.splice(index, 1);
      }
    }

    this.loading = false;
  }

  async selectList(list: List, user: User | null) {
    if (this.functionality === RecentListsModalFunctionality.NavigateToList) {
      this.router.navigate(['/list', list.id], {
        state: { list: list, user: user },
      });
      this.dialogRef.close();
    } else if (
      this.functionality === RecentListsModalFunctionality.AddItemToList
    ) {
      await this.selectListForItemCopy(list, true);
    } else if (
      this.functionality === RecentListsModalFunctionality.CopyItemToList
    ) {
      await this.selectListForItemCopy(list, false);
    }
  }

  async selectListForItemCopy(list: List, customizeItem: boolean) {
    if (this.copyLoading) {
      return;
    }

    if (customizeItem) {
      // Open the AddItemComponent to allow for edits before copying.
      const dialogRef = this.dialog.open(AddItemComponent, {
        data: { list, item: this.item, newItem: true },
        width: '90vw',
        maxWidth: '600px',
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result) {
          // The AddItemComponent has modified the list object. Save it and navigate.
          this.saveAndClose(list, true);
        }
      });
    } else {
      // Reset 'purchased' status for the new copy.
      const itemCopy: Item = { ...this.item!, purchased: false };
      list.items?.push(itemCopy);
      await this.saveAndClose(list);
    }
  }

  private async saveAndClose(list: List, navigate: boolean = false) {
    this.copyLoading = true;
    try {
      await this.firebase.saveList(list);
      if (navigate) {
        this.snackbar.open('Item added', 'Close', { duration: 3000 });
        // Navigate to the list view, prevent going back to the share target.
        this.router.navigate(['/list', list.id], { replaceUrl: true });
      } else {
        const snack = this.snackbar.open('Item added', 'Go to List', {
          duration: 3000,
        });
        snack.onAction().subscribe(() => {
          this.dialog.closeAll();
          this.router.navigate(['/list', list.id]);
        });
      }
      this.dialogRef.close(list.id);
    } catch (error) {
      console.error('Error adding item:', error);
      this.snackbar.open('Failed to add item. Please try again.', 'Close', {
        duration: 3000,
      });
    } finally {
      this.copyLoading = false;
    }
  }
}
