import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { List } from 'src/models/list';
import { User } from 'src/models/user';
import { FirebaseService } from 'src/services/firebase.service';
import { StorageService } from 'src/services/storage.service';
import { AddListComponent } from './add-list/add-list.component';
import { ChangeNameComponent } from './change-name/change-name.component';

type HomeTab = 'my' | 'saved' | 'recent';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: false,
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild('columnsContainer') columnsContainer?: ElementRef<HTMLElement>;

  theme: string = '';
  activeTab: HomeTab = 'my';
  tabProgress: number = 0;
  myLists: List[] = [];
  savedListItems: { list: List; creator: User | null }[] = [];
  recentListItems: { list: List; creator: User | null }[] = [];
  loading: boolean = false;
  userListsLoading: boolean = false;
  currentUser: User | null = null;
  authReady: boolean = false;
  signingIn: boolean = false;
  tabAnimating: boolean = false;
  private tabManuallySelected: boolean = false;
  private scrollAnimationTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly tabOrder: HomeTab[] = ['my', 'saved', 'recent'];
  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private firebase: FirebaseService,
    private storageService: StorageService,
    private snackbar: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  async ngOnInit() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;

    if (currentMonth === 12) {
      this.theme = 'christmas';
    } else if (currentMonth === 11) {
      this.theme = 'fall';
    }

    this.subscriptions.push(
      this.firebase.authReady$.subscribe((ready) => {
        this.authReady = ready;
      }),
      this.firebase.currentUser$.subscribe((user) => {
        const wasSignedOut = !this.currentUser;
        this.currentUser = user;
        if (user && wasSignedOut && !this.tabManuallySelected) {
          this.activeTab = 'my';
          this.tabProgress = 0;
        }
        this.loadUserLists(user);
      }),
    );

    await this.loadRecentLists();
  }

  ngOnDestroy() {
    this.cancelScrollAnimation();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  cancelScrollAnimation() {
    if (this.scrollAnimationTimeout === null && !this.tabAnimating) {
      return;
    }
    if (this.scrollAnimationTimeout !== null) {
      clearTimeout(this.scrollAnimationTimeout);
      this.scrollAnimationTimeout = null;
    }
    this.tabAnimating = false;
    const container = this.columnsContainer?.nativeElement;
    if (container) {
      const columns = Array.from(container.children) as HTMLElement[];
      for (const col of columns) {
        col.style.transition = '';
        col.style.transform = '';
      }
      container.style.scrollSnapType = '';
    }
  }

  setActiveTab(tab: HomeTab) {
    this.tabManuallySelected = true;
    this.activeTab = tab;

    const index = this.tabOrder.indexOf(tab);
    const container = this.columnsContainer?.nativeElement;
    if (!container || container.scrollWidth <= container.clientWidth) {
      this.tabProgress = index;
      return;
    }

    const columns = Array.from(container.children) as HTMLElement[];
    const column = columns[index];
    if (!column) return;

    const currentOffset = columns[0]
      ? new DOMMatrixReadOnly(getComputedStyle(columns[0]).transform).m41
      : 0;
    const startLeft = container.scrollLeft - currentOffset;
    const targetLeft = column.offsetLeft;
    const delta = targetLeft - startLeft;

    if (this.scrollAnimationTimeout !== null) {
      clearTimeout(this.scrollAnimationTimeout);
      this.scrollAnimationTimeout = null;
    }

    if (Math.abs(delta) < 1) {
      this.cancelScrollAnimation();
      this.tabProgress = index;
      return;
    }

    this.tabAnimating = true;
    this.tabProgress = index;

    container.style.scrollSnapType = 'none';
    container.scrollLeft = targetLeft;

    for (const col of columns) {
      col.style.transition = 'none';
      col.style.transform = `translate3d(${delta}px, 0, 0)`;
    }

    void container.offsetWidth;

    const transitionValue = 'transform 250ms cubic-bezier(0.22, 1, 0.36, 1)';
    for (const col of columns) {
      col.style.transition = transitionValue;
      col.style.transform = 'translate3d(0, 0, 0)';
    }

    this.scrollAnimationTimeout = setTimeout(() => {
      for (const col of columns) {
        col.style.transition = '';
        col.style.transform = '';
      }
      container.style.scrollSnapType = '';
      this.tabAnimating = false;
      this.scrollAnimationTimeout = null;
    }, 255);
  }

  onColumnsScroll(event: Event) {
    if (this.tabAnimating) {
      return;
    }

    const container = event.target as HTMLElement;
    if (
      !container ||
      !container.clientWidth ||
      container.scrollWidth <= container.clientWidth
    ) {
      return;
    }

    const step = container.clientWidth + 16;
    const rawProgress = container.scrollLeft / step;
    this.tabProgress = Math.min(
      this.tabOrder.length - 1,
      Math.max(0, rawProgress),
    );

    const index = Math.round(this.tabProgress);
    const tab = this.tabOrder[index];
    if (tab && tab !== this.activeTab) {
      this.tabManuallySelected = true;
      this.activeTab = tab;
    }
  }

  isGiftList(list: List): boolean {
    return (list.type ?? 'gift') === 'gift';
  }

  private async loadUserLists(user: User | null) {
    if (!user) {
      this.myLists = [];
      this.savedListItems = [];
      this.userListsLoading = false;
      return;
    }

    this.userListsLoading = true;
    try {
      const [lists, savedListsData] = await Promise.all([
        user.lists?.length
          ? this.firebase.getLists(user, false)
          : Promise.resolve([]),
        user.savedLists?.length
          ? this.firebase.getListsWithCreators(user.savedLists)
          : Promise.resolve([]),
      ]);
      this.myLists = lists;
      this.savedListItems = savedListsData;
    } finally {
      this.userListsLoading = false;
    }
  }

  private async loadRecentLists() {
    const sortedIds = this.storageService.getSortedRecentListIds();
    if (!sortedIds.length) {
      this.recentListItems = [];
      this.loading = false;
      return;
    }

    this.loading = true;
    try {
      this.recentListItems = await this.firebase.getListsWithCreators(
        sortedIds.slice(0, 10),
      );
    } finally {
      this.loading = false;
    }
  }

  navigateToList(list: List, user: User | null) {
    this.router.navigate(['/list', list.id], {
      state: { list: list, user: user },
    });
  }

  async signIn() {
    if (this.signingIn) return;
    this.signingIn = true;
    try {
      const user = await this.firebase.signInWithGoogle();
      if (user) {
        this.activeTab = 'my';
        this.tabProgress = 0;
      }
    } catch (error) {
      console.error('Google sign-in failed:', error);
      this.snackbar.open(
        'Sign in cancelled or failed. Please try again.',
        'Close',
        { duration: 3000 },
      );
    } finally {
      this.signingIn = false;
    }
  }

  async signOut() {
    this.activeTab = 'my';
    this.tabProgress = 0;
    this.tabManuallySelected = false;
    await this.firebase.signOutUser();
  }

  addList(): void {
    if (!this.currentUser) return;
    const dialogRef = this.dialog.open(AddListComponent, {
      data: {
        user: this.currentUser,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const refreshed = await this.firebase.refreshCurrentUser();
        await this.loadUserLists(refreshed);
      }
    });
  }

  async deleteMyList(list: List, event: MouseEvent) {
    if (!this.currentUser) return;
    if (!confirm('Are you sure you want to delete this list?')) return;
    await this.firebase.deleteList(this.currentUser, list);
    this.storageService.removeRecentList(list.id!);
    this.recentListItems = this.recentListItems.filter(
      (item) => item.list.id !== list.id,
    );
    const refreshed = await this.firebase.refreshCurrentUser();
    await this.loadUserLists(refreshed);
  }

  async unsaveList(list: List, event: MouseEvent) {
    if (!this.currentUser) return;
    if (!confirm('Are you sure you want to unsave this list?')) return;
    await this.firebase.removeFromSavedLists(this.currentUser, list);
    const refreshed = await this.firebase.refreshCurrentUser();
    await this.loadUserLists(refreshed);
  }

  changeName() {
    if (!this.currentUser) return;
    const dialogRef = this.dialog.open(ChangeNameComponent, {
      data: {
        id: this.currentUser.id,
        name: this.currentUser.name,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const refreshed = await this.firebase.refreshCurrentUser();
        await this.loadUserLists(refreshed);
        await this.loadRecentLists();
      }
    });
  }

  removeList(list: List, event: MouseEvent) {
    if (!confirm('Remove from recent lists?')) return;
    this.recentListItems = this.recentListItems.filter(
      (item) => item.list.id !== list.id,
    );

    this.storageService.removeRecentList(list.id!);
  }
}
