import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { RecentListsModalComponent } from '../list/item/recent-lists-modal/recent-lists-modal.component';
import { Item } from 'src/models/item';
import { RecentListsModalFunctionality } from '../list/item/recent-lists-modal/recent-lists-modal-functionality.enum';

@Component({
  selector: 'app-share-target',
  templateUrl: './share-target.component.html',
  styleUrls: ['./share-target.component.css'],
  standalone: false,
})
export class ShareTargetComponent implements OnInit {
  private receivedTitle: string | null = null;
  private receivedText: string | null = null;
  private receivedUrl: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.receivedTitle = params.get('title');
      this.receivedText = params.get('text');
      this.receivedUrl = params.get('url');
    });

    this.processSharedData();
  }

  private processSharedData() {
    // Validate data
    if (!this.receivedTitle && !this.receivedText && !this.receivedUrl) {
      // If no valid data is received, navigate back to home
      this.router.navigate(['/']);
    }

    // Extract URL from text if URL param is missing
    if (!this.receivedUrl && this.receivedText) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls: string[] | null = this.receivedText.match(urlRegex);
      if (urls && urls.length > 0) {
        this.receivedUrl = urls[0];
      }
    }

    // Create an item with the data
    const item: Item = {
      name: this.receivedTitle || '',
      details: '',
      url: this.receivedUrl || '',
      purchased: false,
    };

    // Open modal to add item to list
    this.openAddToListModal(item);
  }

  private openAddToListModal(item: Item) {
    const dialogRef = this.dialog.open(RecentListsModalComponent, {
      data: { item, functionality:  RecentListsModalFunctionality.AddItemToList },
      width: '600px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        this.router.navigate(['/']);
      }
    });
  }
}
