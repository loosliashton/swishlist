import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Item } from 'src/models/item';

@Component({
  selector: 'app-share-target',
  templateUrl: './share-target.component.html',
  styleUrls: ['./share-target.component.css'],
  standalone: false,
})
export class ShareTargetComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.isStaleNavigation()) {
      this.router.navigate(['/'], { replaceUrl: true });
      return;
    }

    const params = this.route.snapshot.queryParamMap;
    const receivedTitle = params.get('title');
    const receivedText = params.get('text');
    let receivedUrl = params.get('url');

    // Validate data
    if (!receivedTitle && !receivedText && !receivedUrl) {
      // If no valid data is received, navigate back to home
      this.router.navigate(['/'], { replaceUrl: true });
      return;
    }

    // Extract URL from text if URL param is missing
    if (!receivedUrl && receivedText) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls: string[] | null = receivedText.match(urlRegex);
      if (urls && urls.length > 0) {
        receivedUrl = urls[0];
      }
    }

    // Create an item with the data
    const item: Item = {
      name: receivedTitle || '',
      details: '',
      url: receivedUrl || '',
      purchased: false,
    };

    // Immediately replace /share-target in history with / so reopening or
    // navigating back never re-triggers the share-target flow.
    this.router.navigate(['/'], {
      replaceUrl: true,
      state: { sharedItem: item },
    });
  }

  protected getNavigationType(): NavigationTimingType | undefined {
    const entries = performance?.getEntriesByType?.('navigation');
    const navEntry = entries?.[0] as PerformanceNavigationTiming | undefined;
    return navEntry?.type;
  }

  private isStaleNavigation(): boolean {
    const navType = this.getNavigationType();
    return navType === 'reload' || navType === 'back_forward';
  }
}
