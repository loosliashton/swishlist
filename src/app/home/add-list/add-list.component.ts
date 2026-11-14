import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FirebaseService } from 'src/services/firebase.service';
import { User } from 'src/models/user';
import { ListType } from 'src/models/list';

@Component({
  selector: 'app-add-list',
  templateUrl: './add-list.component.html',
  styleUrl: './add-list.component.css',
  standalone: false,
})
export class AddListComponent {
  user: User;
  loading: boolean = false;
  listType: ListType = 'gift';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private firebase: FirebaseService,
    public dialogRef: MatDialogRef<AddListComponent>,
    private snackbar: MatSnackBar,
  ) {
    this.user = data.user;
  }

  async addList(listName: string) {
    const trimmedName = listName.trim();
    if (!trimmedName) {
      this.snackbar.open('Please enter a list name', 'Close', {
        duration: 2000,
      });
      return;
    }

    this.loading = true;
    await this.firebase.addList(this.user, trimmedName, this.listType);
    this.loading = false;
    this.snackbar.open(`"${trimmedName}" added successfully`, 'Close', {
      duration: 2000,
    });
    this.dialogRef.close(true);
  }
}
