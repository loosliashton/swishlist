import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FirebaseService } from 'src/services/firebase.service';

@Component({
  selector: 'app-spoiler-prompt',
  templateUrl: './spoiler-prompt.component.html',
  styleUrl: './spoiler-prompt.component.css',
  standalone: false,
})
export class SpoilerPromptComponent {
  rememberChoice: boolean = true;
  listId: string = '';
  isAuthenticatedNonOwner: boolean = false;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: { listId: string; isAuthenticatedNonOwner?: boolean },
    public dialogRef: MatDialogRef<SpoilerPromptComponent>,
    private firebase: FirebaseService,
  ) {
    this.listId = data.listId;
    this.isAuthenticatedNonOwner = !!data.isAuthenticatedNonOwner;
  }

  onSelect(spoilers: boolean) {
    if (this.rememberChoice) {
      void this.firebase.setSpoilerChoice(this.listId, spoilers);
    }
    this.dialogRef.close(spoilers);
  }
}
