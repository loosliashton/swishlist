import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FirebaseService } from 'src/services/firebase.service';

@Component({
  selector: 'app-short-url-receiver',
  imports: [],
  templateUrl: './short-url-receiver.component.html',
  styleUrl: './short-url-receiver.component.css',
})
export class ShortUrlReceiverComponent {
  constructor(
    private route: ActivatedRoute,
    private firebase: FirebaseService,
  ) {}

  async ngOnInit() {
    this.route.paramMap.subscribe(async (params) => {
      // Get short URL from path
      let shortUrl = params.get('shorturl') ?? '';
      // Get the list ID from the short URL
      let listId = await this.firebase.checkShortUrl(shortUrl);
      if (listId) {
        // Navigate to the list
        window.location.href = `/list/${listId}`;
      } else {
        // Navigate home if short URL is invalid
        window.location.href = '/';
      }
    });
  }
}
