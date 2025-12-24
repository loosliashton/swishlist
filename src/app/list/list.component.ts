import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FirebaseService } from '../../services/firebase.service';
import { List } from '../../models/list';
import { User } from '../../models/user';
import { Item } from '../../models/item';
import { MatDialog } from '@angular/material/dialog';
import { ItemComponent } from './item/item.component';
import { AddItemComponent } from './add-item/add-item.component';
import { SpoilerPromptComponent } from './spoiler-prompt/spoiler-prompt.component';
import { Title } from '@angular/platform-browser';
import { SuggestionsComponent } from './suggestions/suggestions.component';
import { SaveListComponent } from './save-list/save-list.component';
import { ShareComponent } from './share/share.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { RecentListsModalComponent } from './item/recent-lists-modal/recent-lists-modal.component';
import { RecentListsModalFunctionality } from './item/recent-lists-modal/recent-lists-modal-functionality.enum';
import { StorageService } from 'src/services/storage.service';

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrl: './list.component.css',
  standalone: false,
})
export class ListComponent {
  list: List | undefined;
  creator: User | undefined;
  spoilers: boolean = false;
  loading: boolean = true;
  saveListLoading: boolean = false;
  cancelEditListLoading: boolean = false;
  editing: boolean = false;
  userHasSavedSetting = false;

  constructor(
    private route: ActivatedRoute,
    private firebase: FirebaseService,
    public dialog: MatDialog,
    private titleService: Title,
    private snackbar: MatSnackBar,
    private storageService: StorageService,
  ) {}

  async ngOnInit() {
    this.route.paramMap.subscribe(async (params) => {
      this.loading = true;
      this.editing = false;
      const id = params.get('id');
      if (!id) return;

      const { passedList, passedUser } = this.initializeFromState();

      await this.loadList(id, passedList);
      if (!this.list) return;

      await this.loadCreator(passedUser);

      // Update the page name
      this.titleService.setTitle(`${this.creator?.name}'s List`);

      this.storageService.addRecentList(id);
      await this.manageSpoilerSettings(id);

      this.loading = false;
    });
  }

  private initializeFromState(): { passedList: List; passedUser: User } {
    const passedList: List = history.state.list;
    const passedUser: User = history.state.user;
    // Consume navigation state to force fetching data on reload
    history.replaceState({}, '');
    return { passedList, passedUser };
  }

  private async loadList(id: string, passedList?: List) {
    // If a list was passed via navigation state and its ID matches the route, use it.
    // Otherwise, fetch the list from Firebase.
    if (passedList && passedList.id === id) {
      this.list = passedList;
    } else {
      await this.getList(id);
    }
  }

  private async loadCreator(passedUser?: User) {
    // Get the creator of the list
    // Cache-First: Use passed user if available and valid to avoid DB call
    if (passedUser && passedUser.id === this.list!.creatorID) {
      this.creator = passedUser;
    } else {
      // Only fetch if we don't have valid passed user data
      await this.firebase.getUserById(this.list!.creatorID).then((creator) => {
        if (!creator) return;
        this.creator = creator;
      });
    }
  }

  private async manageSpoilerSettings(id: string) {
    // Check if user has set a spoiler preference for this list
    if (this.storageService.hasSpoilerChoice(id)) {
      this.spoilers = this.storageService.getSpoilerChoice(id)!;
    } else {
      // Check to see if the user wants spoilers
      this.spoilers = await this.openSpoilerPrompt();
    }

    // Check if user has saved a spoiler setting for this list
    this.userHasSavedSetting = this.checkIfUserHasSavedSpoilerSetting();
  }

  async getList(id: string) {
    await this.firebase.getList(id).then(async (list) => {
      this.list = list as List;
    });
  }

  async editList() {
    if (!this.editing) {
      this.editing = true;
    } else {
      this.cancelEditListLoading = true;
      await this.getList(this.list!.id!);
      this.editing = false;
      this.cancelEditListLoading = false;
    }
  }

  async saveList() {
    if (this.list) {
      this.saveListLoading = true;
      if (!(await this.firebase.saveList(this.list))) {
        this.snackbar.open('Error saving list', 'Close', { duration: 3000 });
        this.getList(this.list.id!);
      } else {
        this.snackbar.open('List updated', 'Close', { duration: 3000 });
      }
      this.saveListLoading = false;
      this.editing = false;
    }
  }

  openItemModal(item: Item) {
    const dialogRef = this.dialog.open(ItemComponent, {
      data: {
        item: item,
        listId: this.list!.id,
        spoilers: this.spoilers,
      },
    });

    let copiedSub: Subscription;
    if (dialogRef.componentInstance) {
      copiedSub = dialogRef.componentInstance.copiedListEvent.subscribe(
        (listId: string) => {
          if (this.list?.id === listId) {
            this.refreshData();
          }
        },
      );
    }

    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.saveList();
    });
  }

  openAddModal() {
    const dialogRef = this.dialog.open(AddItemComponent, {
      data: {
        list: this.list,
        newItem: true,
      },
      width: '90vw',
      maxWidth: '600px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.saveList();
    });
  }

  openSaveModal() {
    const dialogRef = this.dialog.open(SaveListComponent, {
      data: {
        list: this.list,
      },
    });
  }

  refreshData() {
    this.firebase.getList(this.list!.id!).then((list) => {
      this.list = list as List;
    });
  }

  openSpoilerPrompt(): Promise<boolean> {
    const dialogRef = this.dialog.open(SpoilerPromptComponent, {
      data: {
        listId: this.list!.id,
      },
    });
    return dialogRef.afterClosed().toPromise();
  }

  deleteItem(index: number) {
    if (confirm('Are you sure you want to delete this item?')) {
      if (this.list) {
        this.list.items?.splice(index, 1);
        this.saveList();
      }
    }
  }

  editItem(item: Item) {
    const dialogRef = this.dialog.open(AddItemComponent, {
      data: {
        list: this.list,
        item: item,
        newItem: false,
      },
      width: '90vw',
      maxWidth: '600px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.saveList();
    });
  }

  openSuggestionModal() {
    const dialogRef = this.dialog.open(SuggestionsComponent, {
      data: {
        list: this.list,
      },
    });
  }

  openShareModal() {
    const dialogRef = this.dialog.open(ShareComponent, {
      data: {
        list: this.list,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      this.refreshData();
    });
  }

  moveItem(index: number, direction: string) {
    this.swapItems(index, index + (direction === 'up' ? -1 : 1));
  }

  swapItems(index1: number, index2: number) {
    if (this.list) {
      const temp = this.list.items![index1];
      this.list.items![index1] = this.list.items![index2];
      this.list.items![index2] = temp;
    }
  }

  checkIfUserHasSavedSpoilerSetting(): boolean {
    return this.storageService.hasSpoilerChoice(this.list!.id!);
  }

  resetSpoilerPreference() {
    this.storageService.removeSpoilerChoice(this.list!.id!);
    // Refresh page to re-prompt for spoiler preference
    window.location.reload();
  }

  openHistoryModal() {
    this.dialog.open(RecentListsModalComponent, {
      data: {
        functionality: RecentListsModalFunctionality.NavigateToList,
        currentListId: this.list?.id || null,
      },
      width: '600px',
    });
  }

  controlsToShow(): string[] {
    const controls: string[] = [];
    if (!this.editing && !this.spoilers) {
      controls.push('add');
    }
    if (this.list?.items?.length) {
      controls.push('suggestions');
    }
    return controls;
  }
}
