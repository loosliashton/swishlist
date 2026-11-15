import { Component, Inject, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FirebaseService } from 'src/services/firebase.service';
import { Item } from 'src/models/item';
import { List } from 'src/models/list';

type LinkMetadata = {
  price: string | null;
  imageUrl: string | null;
  keepaUrl: string | null;
  affiliateUrl: string | null;
};

@Component({
  selector: 'app-add-item',
  templateUrl: './add-item.component.html',
  styleUrl: './add-item.component.css',
  standalone: false,
})
export class AddItemComponent implements OnDestroy {
  list: List;
  item: Item | undefined;
  name: string = '';
  url: string = '';
  details: string = '';
  price: string | null = null;
  imageUrl: string | null = null;
  keepaUrl: string | null = null;
  affiliateUrl: string | null = null;
  loading: boolean = false;
  fetchingMetadata: boolean = false;
  newItem: boolean = true;
  private lastFetchedUrl: string = '';
  private urlDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private activeMetadataPromise: Promise<LinkMetadata> | null = null;

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
    const isEditing = !this.newItem && !!this.item;

    if (this.item) {
      this.name = this.item.name;
      this.url = this.item.url;
      this.details = this.item.details;
      this.price = this.item.price ?? null;
      this.imageUrl = this.item.imageUrl ?? null;
      this.keepaUrl = this.item.camelUrl ?? null;
      this.affiliateUrl = this.item.affiliateUrl ?? null;
      if (this.newItem) {
        this.item = undefined; // Mark item as undefined to specify adding a new item
      }
    }

    const trimmedUrl = (this.url || '').trim();
    if (trimmedUrl.startsWith('http')) {
      if (isEditing || this.price || this.imageUrl) {
        this.lastFetchedUrl = trimmedUrl;
      } else {
        void this.onUrlBlur();
      }
    }
  }

  ngOnDestroy(): void {
    this.clearUrlDebounce();
  }

  private clearUrlDebounce(): void {
    if (this.urlDebounceTimer !== null) {
      clearTimeout(this.urlDebounceTimer);
      this.urlDebounceTimer = null;
    }
  }

  private resetMetadataState(): void {
    this.price = null;
    this.imageUrl = null;
    this.keepaUrl = null;
    this.affiliateUrl = null;
    this.lastFetchedUrl = '';
    this.fetchingMetadata = false;
    this.activeMetadataPromise = null;
  }

  onUrlChange(newUrl: string): void {
    this.clearUrlDebounce();
    const trimmed = (newUrl || '').trim();
    if (!trimmed || !trimmed.startsWith('http')) {
      this.resetMetadataState();
      return;
    }

    if (trimmed === this.lastFetchedUrl) {
      return;
    }

    // Only auto-fetch when creating a new item; edits use the refresh button
    if (this.item) {
      this.keepaUrl = null;
      this.affiliateUrl = null;
      this.lastFetchedUrl = trimmed;
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (
        (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
        !parsed.hostname
      ) {
        return;
      }
    } catch {
      return;
    }

    this.urlDebounceTimer = setTimeout(() => {
      this.urlDebounceTimer = null;
      if ((this.url || '').trim() === trimmed && trimmed !== this.lastFetchedUrl) {
        void this.fetchMetadataForUrl(trimmed);
      }
    }, 300);
  }

  onUrlBlur(): void {
    this.clearUrlDebounce();
    const trimmed = (this.url || '').trim();
    if (!trimmed || !trimmed.startsWith('http')) {
      this.resetMetadataState();
      return;
    }

    if (trimmed === this.lastFetchedUrl) {
      return;
    }

    if (this.item) {
      this.keepaUrl = null;
      this.affiliateUrl = null;
      this.lastFetchedUrl = trimmed;
      return;
    }

    void this.fetchMetadataForUrl(trimmed);
  }

  get hasValidUrl(): boolean {
    return (this.url || '').trim().startsWith('http');
  }

  get hasFetchedCurrentUrl(): boolean {
    const trimmed = (this.url || '').trim();
    return (
      Boolean(trimmed) &&
      trimmed === this.lastFetchedUrl &&
      !this.fetchingMetadata
    );
  }

  clearThumbnail(): void {
    this.imageUrl = null;
  }

  clearPrice(): void {
    this.price = null;
  }

  refreshMetadata(): void {
    this.clearUrlDebounce();
    const trimmed = (this.url || '').trim();
    if (!trimmed || !trimmed.startsWith('http') || this.fetchingMetadata) {
      return;
    }
    void this.fetchMetadataForUrl(trimmed);
  }

  private fetchMetadataForUrl(targetUrl: string): Promise<LinkMetadata> {
    this.lastFetchedUrl = targetUrl;
    this.fetchingMetadata = true;

    const promise = this.firebase
      .getLinkMetadata(targetUrl)
      .then((res) => {
        if ((this.url || '').trim() === targetUrl) {
          this.price = res.price ?? null;
          this.imageUrl = res.imageUrl ?? null;
          this.keepaUrl = res.keepaUrl ?? null;
          this.affiliateUrl = res.affiliateUrl ?? null;
        }
        return res;
      })
      .finally(() => {
        if (this.activeMetadataPromise === promise) {
          this.fetchingMetadata = false;
          this.activeMetadataPromise = null;
        }
      });

    this.activeMetadataPromise = promise;
    return promise;
  }

  async addItem() {
    // Validate fields
    if (!this.name) {
      this.snackbar.open('Please enter a name', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.clearUrlDebounce();
    const trimmedUrl = (this.url || '').trim();
    this.url = trimmedUrl;

    // Check if URL is valid
    if (trimmedUrl && !trimmedUrl.startsWith('http')) {
      this.snackbar.open('Please enter a valid URL', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.loading = true;
    try {
      if (!trimmedUrl) {
        this.resetMetadataState();
      } else if (!this.item && trimmedUrl !== this.lastFetchedUrl) {
        void this.fetchMetadataForUrl(trimmedUrl);
      }

      if (this.activeMetadataPromise) {
        await this.activeMetadataPromise;
      }

      let keepaUrl = this.keepaUrl;
      let affiliateUrl = this.affiliateUrl;
      if (
        this.firebase.isAmazonUrl(trimmedUrl) &&
        !keepaUrl &&
        !affiliateUrl
      ) {
        const amazonResult = await this.firebase.getAmazonLinks(trimmedUrl);
        keepaUrl = amazonResult?.keepaUrl ?? null;
        affiliateUrl = amazonResult?.affiliateUrl ?? null;
      }

      // If editing an item, update it.
      if (this.item) {
        this.item.name = this.name;
        this.item.url = trimmedUrl;
        this.item.details = this.details;
        this.item.camelUrl = keepaUrl;
        this.item.affiliateUrl = affiliateUrl;
        this.item.price = this.price ?? null;
        this.item.imageUrl = this.imageUrl ?? null;
      } else {
        // Otherwise, create a new item and add it to the list.
        // This handles both creating a brand new item,
        // and creating a new item pre-filled from an existing one.
        const newItem: Item = {
          name: this.name,
          url: trimmedUrl,
          purchased: false,
          details: this.details,
          camelUrl: keepaUrl,
          affiliateUrl: affiliateUrl,
          price: this.price ?? null,
          imageUrl: this.imageUrl ?? null,
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
