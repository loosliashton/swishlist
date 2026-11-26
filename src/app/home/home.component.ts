import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { combineLatest, Subscription } from 'rxjs';
import { List } from 'src/models/list';
import { User } from 'src/models/user';
import { FirebaseService } from 'src/services/firebase.service';
import { AddListComponent } from './add-list/add-list.component';
import { ChangeNameComponent } from './change-name/change-name.component';
import { GiftSwapComponent } from './gift-swap/gift-swap.component';

type HomeTab = 'my' | 'saved' | 'recent';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: false,
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild('columnsContainer') columnsContainer?: ElementRef<HTMLElement>;
  @ViewChild('helpDialog') helpDialog?: TemplateRef<unknown>;

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
  private hasLoadedUserState: boolean = false;
  private recentListsLoadSeq: number = 0;
  private scrollAnimationTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly tabOrder: HomeTab[] = ['my', 'saved', 'recent'];
  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private firebase: FirebaseService,
    private snackbar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;

    if (currentMonth === 12) {
      this.theme = 'christmas';
    } else if (currentMonth === 11) {
      this.theme = 'fall';
    }

    this.applyDocumentTheme(this.theme);

    this.subscriptions.push(
      this.firebase.authReady$.subscribe((ready) => {
        this.authReady = ready;
        this.cdr.detectChanges();
      }),
      combineLatest([
        this.firebase.authReady$,
        this.firebase.currentUser$,
      ]).subscribe(([ready, user]) => {
        if (!ready) {
          return;
        }
        const prevUser = this.currentUser;
        const wasSignedOut = !prevUser;
        this.currentUser = user;
        if (user && wasSignedOut && !this.tabManuallySelected) {
          this.activeTab = 'my';
          this.tabProgress = 0;
        }
        if (
          !this.hasLoadedUserState ||
          prevUser?.id !== user?.id ||
          prevUser?.name !== user?.name ||
          prevUser?.lists !== user?.lists ||
          prevUser?.savedLists !== user?.savedLists
        ) {
          this.loadUserLists(user);
        }
        if (
          !this.hasLoadedUserState ||
          prevUser?.id !== user?.id ||
          prevUser?.recentLists !== user?.recentLists
        ) {
          this.loadRecentLists();
        }
        this.hasLoadedUserState = true;
      }),
    );

    if (this.firebase.currentUser) {
      void this.firebase
        .refreshCurrentUser()
        .catch((error) =>
          console.error('Error refreshing current user:', error),
        );
    }
  }

  ngOnDestroy() {
    this.applyDocumentTheme('');
    this.cancelScrollAnimation();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private applyDocumentTheme(theme: string) {
    const classes = ['christmas-theme', 'fall-theme'];
    document.documentElement.classList.remove(...classes);
    document.body.classList.remove(...classes);

    let meta = document.querySelector('meta[name="theme-color"]');
    if (theme === 'christmas' || theme === 'fall') {
      const cls = `${theme}-theme`;
      document.documentElement.classList.add(cls);
      document.body.classList.add(cls);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
      }
      meta.setAttribute(
        'content',
        theme === 'christmas' ? '#180036' : '#2e1a0f',
      );
    } else if (meta) {
      meta.remove();
    }
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

  openHelp() {
    if (!this.helpDialog) return;
    this.dialog.open(this.helpDialog);
  }

  openGiftSwap() {
    this.dialog.open(GiftSwapComponent, {
      data: { theme: this.theme },
      width: '440px',
      maxWidth: '92vw',
    });
  }

  isGiftList(list: List): boolean {
    return (list.type ?? 'gift') === 'gift';
  }

  private async loadUserLists(user: User | null) {
    if (!user) {
      this.myLists = [];
      this.savedListItems = [];
      this.userListsLoading = false;
      this.cdr.detectChanges();
      return;
    }

    const cachedMyLists = this.firebase.getCachedLists(user, false);
    const cachedSavedLists = this.firebase.getCachedListsWithCreators(
      user.savedLists ?? [],
    );

    if (cachedMyLists && cachedSavedLists) {
      this.myLists = cachedMyLists;
      this.savedListItems = cachedSavedLists;
      this.userListsLoading = false;
      this.cdr.detectChanges();
    } else {
      this.userListsLoading = true;
      this.cdr.detectChanges();
    }

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
    } catch (error) {
      console.error('Error loading user lists:', error);
    } finally {
      this.userListsLoading = false;
      this.cdr.detectChanges();
    }
  }

  get visibleRecentListItems(): { list: List; creator: User | null }[] {
    if (!this.currentUser) {
      return this.recentListItems;
    }
    return this.recentListItems.filter((item) => !this.isOwnList(item.list));
  }

  private isOwnList(list: List): boolean {
    if (!this.currentUser) {
      return false;
    }
    if (this.currentUser.id && list.creatorID === this.currentUser.id) {
      return true;
    }
    if (this.currentUser.uid && list.creatorUid === this.currentUser.uid) {
      return true;
    }
    return !!(list.id && this.currentUser.lists?.includes(list.id));
  }

  private async loadRecentLists() {
    const seq = ++this.recentListsLoadSeq;
    const ownedIds = new Set(this.currentUser?.lists ?? []);
    const sortedIds = this.firebase
      .getSortedRecentListIds(this.currentUser)
      .filter((id) => !ownedIds.has(id));
    if (!sortedIds.length) {
      this.recentListItems = [];
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    const topIds = sortedIds.slice(0, 10);
    const cachedRecent = this.firebase.getCachedListsWithCreators(topIds);
    if (cachedRecent) {
      this.recentListItems = cachedRecent;
      this.loading = false;
      this.cdr.detectChanges();
    } else {
      this.loading = true;
      this.cdr.detectChanges();
    }

    try {
      const items = await this.firebase.getListsWithCreators(topIds);
      if (seq !== this.recentListsLoadSeq) {
        return;
      }
      this.recentListItems = items;
      const foundIds = new Set(items.map((item) => item.list.id));
      const missingIds = topIds.filter((id) => !foundIds.has(id));
      if (missingIds.length) {
        void this.firebase.removeRecentLists(missingIds);
      }
    } catch (error) {
      console.error('Error loading recent lists:', error);
    } finally {
      if (seq === this.recentListsLoadSeq) {
        this.loading = false;
        this.cdr.detectChanges();
      }
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
    if (list.id) {
      await this.firebase.removeRecentList(list.id);
    }
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

    if (list.id) {
      void this.firebase.removeRecentList(list.id);
    }
  }
}
