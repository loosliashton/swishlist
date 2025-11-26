import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FirebaseService } from '../../services/firebase.service';
import { MatDialog } from '@angular/material/dialog';
import { AddListComponent } from './add-list/add-list.component';
import { List } from '../../models/list';
import { User } from '../../models/user';
import { ChangeNameComponent } from './change-name/change-name.component';

@Component({
  selector: 'app-my-lists',
  templateUrl: './my-lists.component.html',
  styleUrls: ['./my-lists.component.css'],
  standalone: false,
})
export class MyListsComponent implements OnInit {
  email: string = '';
  lists: List[] = [];
  savedLists: List[] = [];
  savedListCreators: string[] = [];
  user: User | null | undefined;
  loading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private firebase: FirebaseService,
    public dialog: MatDialog,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
    this.user = await this.firebase.createUserIfNeeded(this.email);
    if (!this.user) return;

    if (this.user.lists) {
      this.lists = await this.firebase.getLists(this.user, false);
    }

    if (this.user.savedLists) {
      this.savedLists = await this.firebase.getLists(this.user, true);
      this.savedListCreators = [];
      for (let list of this.savedLists) {
        let creator = await this.firebase.getUserById(list.creatorID);
        if (creator) this.savedListCreators.push(creator.name);
        else this.savedListCreators.push('Unknown');
      }
    }

    this.loading = false;
  }

  navigateToList(list: List) {
    this.router.navigate(['/list', list.id], {
      state: { list: list, user: this.user },
    });
  }

  async unsaveList(list: List, event: Event) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to unsave this list?')) return;
    await this.firebase.removeFromSavedLists(this.user!, list);
    this.ngOnInit();
  }

  async deleteList(list: List, $event: Event) {
    $event.stopPropagation();
    if (!confirm('Are you sure you want to delete this list?')) return;
    await this.firebase.deleteList(this.user!, list);
    this.ngOnInit();
  }

  addList(): void {
    const dialogRef = this.dialog.open(AddListComponent, {
      data: {
        user: this.user,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) this.ngOnInit();
    });
  }

  changeName() {
    const dialogRef = this.dialog.open(ChangeNameComponent, {
      data: {
        id: this.user?.id,
        name: this.user?.name,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) this.ngOnInit();
    });
  }

  async getUserName(id: string): Promise<string> {
    let user = await this.firebase.getUserById(id);
    return user?.name ?? '';
  }
}
