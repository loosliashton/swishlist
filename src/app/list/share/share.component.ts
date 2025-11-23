import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FirebaseService } from 'src/services/firebase.service';
import { Clipboard } from '@angular/cdk/clipboard';
import { List } from 'src/models/list';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-share',
  templateUrl: './share.component.html',
  styleUrl: './share.component.css',
  standalone: false,
})
export class ShareComponent {
  shareUrl: string = '';
  list: List;
  loading: boolean = true;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private firebase: FirebaseService,
    private clipboard: Clipboard,
    private snackbar: MatSnackBar,
  ) {
    this.list = data.list;
  }

  ngOnInit() {
    this.firebase.createAndAddShortUrl(this.list).then((url) => {
      this.shareUrl = `http://swishlist.cc/${url}`;
      this.loading = false;
      // If share API is available, prompt share dialog
      if (navigator.share) {
        navigator
          .share({
            title: 'Check out my list!',
            text: 'Here is a link to my list:',
            url: this.shareUrl,
          })
          .catch((error) => console.log('Error sharing', error));
      }
    });
  }

  copyToClipboard() {
    this.clipboard.copy(this.shareUrl);
    this.snackbar.open('Copied to clipboard!', 'Dismiss', {
      duration: 3000,
    });
  }
}
