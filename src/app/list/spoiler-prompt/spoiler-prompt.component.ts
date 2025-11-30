import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { StorageService } from 'src/services/storage.service';

@Component({
  selector: 'app-spoiler-prompt',
  templateUrl: './spoiler-prompt.component.html',
  styleUrl: './spoiler-prompt.component.css',
  standalone: false,
})
export class SpoilerPromptComponent {
  rememberChoice: boolean = false;
  listId: string = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { listId: string },
    public dialogRef: MatDialogRef<SpoilerPromptComponent>,
    private storageService: StorageService,
  ) {
    this.listId = data.listId;
  }

  onSelect(spoilers: boolean) {
    if (this.rememberChoice) {
      this.storageService.setSpoilerChoice(this.listId, spoilers);
    }
    this.dialogRef.close(spoilers);
  }
}
