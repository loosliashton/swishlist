import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FirebaseService } from '../../services/firebase.service';
import { List, ListType } from '../../models/list';
import { User } from '../../models/user';
import { Item } from '../../models/item';
import { MatDialog } from '@angular/material/dialog';
import { ItemComponent } from './item/item.component';
import { AddItemComponent } from './add-item/add-item.component';
import { SpoilerPromptComponent } from './spoiler-prompt/spoiler-prompt.component';
import { Title } from '@angular/platform-browser';
import { SuggestionsComponent } from './suggestions/suggestions.component';
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
export class ListComponent implements OnInit, OnDestroy {
  list: List | undefined;
  creator: User | undefined;
  currentUser: User | null = null;
  spoilers: boolean = false;
  loading: boolean = true;
  saveListLoading: boolean = false;
  cancelEditListLoading: boolean = false;
  savingBookmark: boolean = false;
  editing: boolean = false;
  userHasSavedSetting = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private firebase: FirebaseService,
    public dialog: MatDialog,
    private titleService: Title,
    private snackbar: MatSnackBar,
    private storageService: StorageService,
    private cdr: ChangeDetectorRef,
  ) {}

  get isOwner(): boolean {
    return !!this.currentUser && this.currentUser.id === this.list?.creatorID;
  }

  get isGiftList(): boolean {
    return (this.list?.type ?? 'gift') === 'gift';
  }

  get isListSaved(): boolean {
    return (
      !!this.list?.id &&
      !!this.currentUser?.savedLists?.includes(this.list.id)
    );
  }

  async ngOnInit() {
    this.subscriptions.push(
      this.firebase.currentUser$.subscribe((user) => {
        this.currentUser = user;
        if (this.list && this.isOwner) {
          this.spoilers = false;
          this.userHasSavedSetting = false;
        }
        this.cdr.detectChanges();
      }),
      this.route.paramMap.subscribe(async (params) => {
        this.loading = true;
        this.editing = false;
        const id = params.get('id');
        if (!id) return;

        const { passedList, passedUser } = this.initializeFromState();

        await Promise.all([
          this.loadList(id, passedList),
          this.firebase.waitForAuthReady(),
        ]);
        if (!this.list) {
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }

        this.currentUser = this.firebase.currentUser;
        await this.loadCreator(passedUser);

        // Update the page name
        this.titleService.setTitle(`${this.creator?.name}'s List`);

        this.storageService.addRecentList(id);
        await this.manageSpoilerSettings(id);

        this.loading = false;
        this.cdr.detectChanges();
      }),
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private initializeFromState(): { passedList: List; passedUser: User } {
    const passedList: List = history.state?.list;
    const passedUser: User = history.state?.user;
    // Consume navigation state to force fetching data on reload
    const { list: _list, user: _user, ...restState } = history.state || {};
    history.replaceState(restState, '');
    return { passedList, passedUser };
  }

  private async loadList(id: string, passedList?: List) {
    // If a list was passed via navigation state and its ID matches the route, use it.
    // Otherwise, fetch the list from Firebase.
    if (passedList && passedList.id === id) {
      this.list = passedList;
      this.firebase.cacheList(this.list);
    } else {
      await this.getList(id);
    }
  }

  private async loadCreator(passedUser?: User) {
    // Get the creator of the list
    // Cache-First: Use passed user if available and valid to avoid DB call
    if (passedUser && passedUser.id === this.list!.creatorID) {
      this.creator = passedUser;
      this.firebase.cacheUser(this.creator);
    } else {
      // Only fetch if we don't have valid passed user data
      await this.firebase.getUserById(this.list!.creatorID).then((creator) => {
        if (!creator) return;
        this.creator = creator;
      });
    }
  }

  private async manageSpoilerSettings(id: string) {
    if (!this.isGiftList || this.isOwner) {
      this.spoilers = false;
      this.userHasSavedSetting = false;
      return;
    }

    // Check if user has set a spoiler preference for this list
    if (this.storageService.hasSpoilerChoice(id)) {
      this.spoilers = this.storageService.getSpoilerChoice(id)!;
    } else {
      // Check to see if the user wants spoilers
      this.spoilers = await this.openSpoilerPrompt();
    }

    if (!this.currentUser && !this.spoilers) {
      const snack = this.snackbar.open(
        'Sign in with Google to edit your list',
        'Sign In',
        { duration: 5000 },
      );
      snack.onAction().subscribe(async () => {
        try {
          await this.firebase.signInWithGoogle();
        } catch (error) {
          console.error('Google sign-in failed:', error);
        }
      });
    }

    // Check if user has saved a spoiler setting for this list
    this.userHasSavedSetting = this.checkIfUserHasSavedSpoilerSetting();
  }

  async getList(id: string) {
    await this.firebase.getList(id).then(async (list) => {
      this.list = list as List;
    });
  }

  setListType(type: ListType) {
    if (!this.isOwner || !this.list) return;
    if (
      type === 'general' &&
      this.isGiftList &&
      !confirm(
        'Are you sure you want to switch this to a General List? Purchased items will immediately become visible.',
      )
    ) {
      return;
    }
    this.list.type = type;
  }

  async editList() {
    if (!this.isOwner) return;
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
    if (!this.list || !this.isOwner) return;
    this.saveListLoading = true;
    if (!(await this.firebase.saveList(this.list))) {
      this.snackbar.open('Error saving list', 'Close', { duration: 3000 });
      await this.getList(this.list.id!);
    } else {
      this.snackbar.open('List updated', 'Close', { duration: 3000 });
    }
    this.saveListLoading = false;
    this.editing = false;
    if (this.list?.id) {
      await this.manageSpoilerSettings(this.list.id);
    }
  }

  async saveItemsOnly() {
    if (!this.list?.id) return;
    this.saveListLoading = true;
    if (
      !(await this.firebase.updateListItems(
        this.list.id,
        this.list.items ?? [],
      ))
    ) {
      this.snackbar.open('Error updating item', 'Close', { duration: 3000 });
      await this.getList(this.list.id);
    } else {
      this.snackbar.open('List updated', 'Close', { duration: 3000 });
    }
    this.saveListLoading = false;
  }

  async toggleItemCheck(item: Item) {
    if (!this.isOwner || this.editing || this.isGiftList) return;
    item.purchased = !item.purchased;
    await this.saveItemsOnly();
  }

  async toggleSaveList() {
    if (!this.list || this.savingBookmark) return;
    this.savingBookmark = true;
    try {
      if (!this.currentUser) {
        const user = await this.firebase.signInWithGoogle();
        if (!user) return;
        this.currentUser = user;
        if (this.isOwner) {
          this.spoilers = false;
          this.userHasSavedSetting = false;
          this.snackbar.open('Signed in — this is your list', 'Close', {
            duration: 3000,
          });
          return;
        }
      }

      if (this.isListSaved) {
        await this.firebase.removeFromSavedLists(this.currentUser, this.list);
        this.snackbar.open('Removed from Saved Lists', 'Close', {
          duration: 3000,
        });
      } else {
        await this.firebase.addToSavedLists(this.currentUser, this.list);
        this.snackbar.open('List saved', 'Close', {
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error toggling saved list:', error);
      this.snackbar.open('Could not update saved lists', 'Close', {
        duration: 3000,
      });
    } finally {
      this.savingBookmark = false;
    }
  }

  openItemModal(item: Item) {
    const dialogRef = this.dialog.open(ItemComponent, {
      data: {
        item: item,
        listId: this.list!.id,
        spoilers: this.spoilers,
        isGeneralList: !this.isGiftList,
        isOwner: this.isOwner,
      },
    });

    let copiedSub: Subscription | undefined;
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
      if (copiedSub) copiedSub.unsubscribe();
      if (result) this.saveItemsOnly();
    });
  }

  openAddModal() {
    if (!this.isOwner) return;
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

  refreshData() {
    this.firebase.getList(this.list!.id!).then((list) => {
      this.list = list as List;
    });
  }

  async openSpoilerPrompt(): Promise<boolean> {
    const dialogRef = this.dialog.open(SpoilerPromptComponent, {
      data: {
        listId: this.list!.id,
        isAuthenticatedNonOwner: !!this.currentUser,
      },
    });
    const result = await dialogRef.afterClosed().toPromise();
    return !!result;
  }

  deleteItem(index: number) {
    if (!this.isOwner) return;
    if (confirm('Are you sure you want to delete this item?')) {
      if (this.list) {
        this.list.items?.splice(index, 1);
        this.saveList();
      }
    }
  }

  editItem(item: Item) {
    if (!this.isOwner) return;
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
    if (!this.isOwner) return;
    this.dialog.open(SuggestionsComponent, {
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

    dialogRef.afterClosed().subscribe(() => {
      this.refreshData();
    });
  }

  moveItem(index: number, direction: string) {
    if (!this.isOwner) return;
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

  async resetSpoilerPreference() {
    this.storageService.removeSpoilerChoice(this.list!.id!);
    await this.manageSpoilerSettings(this.list!.id!);
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
    if (!this.isOwner || this.editing) {
      return [];
    }
    const controls: string[] = ['add'];
    if (this.list?.items?.length) {
      controls.push('suggestions');
    }
    return controls;
  }
}
