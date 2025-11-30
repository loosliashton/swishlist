import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FirebaseService } from 'src/services/firebase.service';
import { List } from 'src/models/list';
import { StorageService } from 'src/services/storage.service';

@Component({
  selector: 'app-save-list',
  templateUrl: './save-list.component.html',
  styleUrl: './save-list.component.css',
  standalone: false,
})
export class SaveListComponent implements OnInit {
  list: List;
  email: string = '';
  loading: boolean = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<SaveListComponent>,
    private snackbar: MatSnackBar,
    private firebase: FirebaseService,
    private storageService: StorageService,
  ) {
    this.list = data.list;
  }

  ngOnInit(): void {
    this.email = this.storageService.getLastEmail() || '';
  }

  async saveList() {
    if (!this.email) return;
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.snackbar.open('Invalid email address', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.loading = true;
    let user = await this.firebase.createUserIfNeeded(this.email);
    if (!user) return;

    await this.firebase.addToSavedLists(user, this.list);
    this.snackbar.open('List saved', 'Close', {
      duration: 3000,
    });
    this.loading = false;
    this.dialogRef.close(true);
  }
}
