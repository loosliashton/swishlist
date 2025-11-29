import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FirebaseService } from 'src/services/firebase.service';
import { Item } from 'src/models/item';
import { List } from 'src/models/list';

@Component({
  selector: 'app-add-item',
  templateUrl: './add-item.component.html',
  styleUrl: './add-item.component.css',
  standalone: false,
})
export class AddItemComponent {
  list: List;
  item: Item | undefined;
  name: string = '';
  url: string = '';
  details: string = '';
  loading: boolean = false;
  newItem: boolean = true;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private snackbar: MatSnackBar,
    private firebase: FirebaseService,
    public dialogRef: MatDialogRef<AddItemComponent>,
  ) {
    this.list = data.list;
    this.item = data.item;
    this.newItem = data.newItem;
  }

  ngOnInit(): void {
    if (this.item) {
      this.name = this.item.name;
      this.url = this.item.url;
      this.details = this.item.details;
      if (this.newItem) {
        this.item = undefined; // Mark item as undefined to specify adding a new item
      }
    }
  }

  async addItem() {
    // Validate fields
    if (!this.name) {
      this.snackbar.open('Please enter a name', 'Close', {
        duration: 3000,
      });
      return;
    }

    // Check if URL is valid
    if (this.url && !this.url.startsWith('http')) {
      this.snackbar.open('Please enter a valid URL', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.loading = true;
    try {
      const { keepaUrl, affiliateUrl } = this.firebase.isAmazonUrl(this.url)
        ? await this.firebase.getAmazonLinks(this.url)
        : { keepaUrl: null, affiliateUrl: null };

      // If editing an item, update it.
      if (this.item) {
        this.item.name = this.name;
        this.item.url = this.url;
        this.item.details = this.details;
        this.item.camelUrl = keepaUrl;
        this.item.affiliateUrl = affiliateUrl;
      } else {
        // Otherwise, create a new item and add it to the list.
        // This handles both creating a brand new item,
        // and creating a new item pre-filled from an existing one.
        const newItem: Item = {
          name: this.name,
          url: this.url,
          purchased: false,
          details: this.details,
          camelUrl: keepaUrl,
          affiliateUrl: affiliateUrl,
        };
        this.list.items?.push(newItem);
      }

      this.dialogRef.close(true);
    } catch (error) {
      console.error('Error adding item:', error);
      this.snackbar.open('Could not add item. Please try again.', 'Close', {
        duration: 3000,
      });
    } finally {
      this.loading = false;
    }
  }
}
