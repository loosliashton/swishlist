import { Component, Inject } from '@angular/core';
import { FirebaseService } from 'src/services/firebase.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: 'app-change-name',
    templateUrl: './change-name.component.html',
    styleUrl: './change-name.component.css',
    standalone: false
})
export class ChangeNameComponent {
  id: string;
  nameInput: string;

  constructor(
    private firebase: FirebaseService,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<ChangeNameComponent>
  ) {
    this.id = data.id;
    this.nameInput = data.name;
  }

  async changeName(newName: string) {
    await this.firebase.changeName(this.id, newName);
    this.dialogRef.close(true);
  }
}
