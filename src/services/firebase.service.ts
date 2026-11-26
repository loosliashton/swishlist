import { Injectable, NgZone } from '@angular/core';
import { app } from 'src/environments/environment';
import {
  collection,
  getDoc,
  getDocs,
  getFirestore,
  initializeFirestore,
  addDoc,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  documentId,
  FieldPath,
  deleteField,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseAuthUser,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { BehaviorSubject, filter, firstValueFrom } from 'rxjs';
import { User } from '../models/user';
import { List, ListType } from '../models/list';
import { Item } from '../models/item';
import { StorageService } from './storage.service';

let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  db = getFirestore(app);
}
const auth = getAuth(app);
const functions = getFunctions(app);

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  private readonly USERS_COL = 'users';
  private readonly LISTS_COL = 'lists';
  private readonly SHORT_URLS_COL = 'shortUrls';
  private readonly MAX_RECENT_LISTS = 30;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private authReadySubject = new BehaviorSubject<boolean>(false);
  authReady$ = this.authReadySubject.asObservable();

  private authResolutionPromises: Map<string, Promise<User | null>> = new Map();
  private listCache = new Map<string, List>();
  private userCache = new Map<string, User>();
  private pendingRecentListsWrite: Promise<void> = Promise.resolve();

  constructor(
    private ngZone: NgZone,
    private storageService: StorageService,
  ) {
    onAuthStateChanged(auth, async (authUser) => {
      try {
        if (authUser) {
          const user = await this.resolveOrCreateUserForAuth(authUser);
          this.ngZone.run(() => this.currentUserSubject.next(user));
        } else {
          this.ngZone.run(() => this.currentUserSubject.next(null));
        }
      } catch (error) {
        console.error('Error resolving authenticated user:', error);
        this.ngZone.run(() => this.currentUserSubject.next(null));
      } finally {
        if (!this.authReadySubject.value) {
          this.ngZone.run(() => this.authReadySubject.next(true));
        }
      }
    });
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  async waitForAuthReady(): Promise<User | null> {
    if (!this.authReadySubject.value) {
      await firstValueFrom(this.authReady$.pipe(filter((ready) => ready)));
    }
    return this.currentUserSubject.value;
  }

  normalizeEmail(email: string): string {
    const clean = (email || '').toLowerCase().trim();
    const parts = clean.split('@');
    if (parts.length !== 2) return clean;
    const [local, domain] = parts;
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      return `${local.replace(/\./g, '')}@gmail.com`;
    }
    return clean;
  }

  async signInWithGoogle(): Promise<User | null> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = await this.resolveOrCreateUserForAuth(result.user);
    this.ngZone.run(() => this.currentUserSubject.next(user));
    return user;
  }

  async signOutUser(): Promise<void> {
    await signOut(auth);
    this.ngZone.run(() => this.currentUserSubject.next(null));
  }

  async refreshCurrentUser(): Promise<User | null> {
    await this.pendingRecentListsWrite.catch(() => {});
    const current = this.currentUserSubject.value;
    if (!current?.id) return null;
    const fresh = await this.getUserById(current.id);
    this.ngZone.run(() => this.currentUserSubject.next(fresh));
    return fresh;
  }

  private cloneList(list: List): List {
    return {
      ...list,
      ...(list.items ? { items: list.items.map((item) => ({ ...item })) } : {}),
    };
  }

  cacheList(list: List | null | undefined): void {
    if (list?.id) {
      this.listCache.set(list.id, this.cloneList(list));
    }
  }

  cacheUser(user: User | null | undefined): void {
    if (user?.id) {
      this.userCache.set(user.id, {
        ...user,
        ...(user.recentLists ? { recentLists: { ...user.recentLists } } : {}),
      });
    }
  }

  getCachedLists(user: User, saved: boolean): List[] | null {
    const listIds = (saved ? user.savedLists : user.lists) ?? [];
    return this.getCachedListsFromIds(listIds);
  }

  getCachedListsFromIds(listIds: string[]): List[] | null {
    if (!listIds || listIds.length === 0) return [];
    const result: List[] = [];
    for (const id of listIds) {
      const cached = this.listCache.get(id);
      if (!cached) return null;
      result.push(this.cloneList(cached));
    }
    return result;
  }

  getCachedListsWithCreators(
    listIds: string[],
  ): { list: List; creator: User | null }[] | null {
    if (!listIds || listIds.length === 0) return [];
    const lists = this.getCachedListsFromIds(listIds);
    if (!lists) return null;
    const result: { list: List; creator: User | null }[] = [];
    for (const list of lists) {
      const creator = this.userCache.get(list.creatorID) ?? null;
      if (!creator) return null;
      result.push({ list, creator });
    }
    return result;
  }

  private patchCurrentUser(userId: string, patch: Partial<User>): void {
    const existing = this.userCache.get(userId);
    if (existing) {
      this.cacheUser({ ...existing, ...patch });
    }
    const current = this.currentUserSubject.value;
    if (current && current.id === userId) {
      const updated = { ...current, ...patch };
      this.cacheUser(updated);
      this.ngZone.run(() => this.currentUserSubject.next(updated));
    }
  }

  private async resolveOrCreateUserForAuth(
    authUser: FirebaseAuthUser,
  ): Promise<User | null> {
    if (this.authResolutionPromises.has(authUser.uid)) {
      return this.authResolutionPromises.get(authUser.uid)!;
    }

    const promise = (async () => {
      try {
        let user = await this.getUserByUid(authUser.uid);

        if (!user && authUser.email) {
          const normalized = this.normalizeEmail(authUser.email);
          user = await this.getUserByNormalizedEmail(normalized);
          if (!user) {
            user = await this.getUserByExactEmail(
              authUser.email.toLowerCase().trim(),
            );
          }
        }

        if (user) {
          const updates: Partial<User> = {};
          const isFirstAuthSignIn = !user.uid;
          if (user.uid !== authUser.uid) {
            updates.uid = authUser.uid;
          }
          const normalized = this.normalizeEmail(authUser.email || user.email);
          if (normalized && user.normalizedEmail !== normalized) {
            updates.normalizedEmail = normalized;
          }
          if (
            authUser.displayName &&
            user.name !== authUser.displayName &&
            (isFirstAuthSignIn ||
              !user.name ||
              user.name.toLowerCase() === user.email.toLowerCase())
          ) {
            updates.name = authUser.displayName;
          }

          if (Object.keys(updates).length > 0) {
            const userDocRef = doc(db, this.USERS_COL, user.id!);
            await updateDoc(userDocRef, updates);
            user = { ...user, ...updates };
          }
          this.cacheUser(user);
          user = await this.syncLocalRecentListsToAccount(user);

          if (user.lists?.length) {
            void this.backfillCreatorUidOnLists(user.lists, authUser.uid);
          }

          return user;
        }

        const email = (authUser.email || '').toLowerCase().trim();
        const localRecent = this.storageService.getRecentLists();
        const { pruned: initialRecentLists } =
          this.pruneRecentLists(localRecent);
        const newUser: User = {
          uid: authUser.uid,
          email,
          normalizedEmail: this.normalizeEmail(email),
          name: authUser.displayName || email || 'User',
          lists: [],
          savedLists: [],
          recentLists: initialRecentLists,
        };
        const docRef = await addDoc(collection(db, this.USERS_COL), newUser);
        if (Object.keys(localRecent).length > 0) {
          this.storageService.clearRecentLists();
        }
        const createdUser = { ...newUser, id: docRef.id };
        this.cacheUser(createdUser);
        return createdUser;
      } finally {
        this.authResolutionPromises.delete(authUser.uid);
      }
    })();

    this.authResolutionPromises.set(authUser.uid, promise);
    return promise;
  }

  private async backfillCreatorUidOnLists(
    listIds: string[],
    creatorUid: string,
  ): Promise<void> {
    try {
      const lists = await this.getListsFromIds(listIds);
      const missing = lists.filter((l) => l.id && !l.creatorUid);
      await Promise.all(
        missing.map(async (l) => {
          await updateDoc(doc(db, this.LISTS_COL, l.id!), { creatorUid });
          this.cacheList({ ...l, creatorUid });
        }),
      );
    } catch (error) {
      console.error('Error backfilling creatorUid on lists:', error);
    }
  }

  private async getUserByUid(uid: string): Promise<User | null> {
    const q = query(
      collection(db, this.USERS_COL),
      where('uid', '==', uid),
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0];
      const user = userDoc.data() as User;
      user.id = userDoc.id;
      this.cacheUser(user);
      return user;
    }
    return null;
  }

  private async getUserByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<User | null> {
    const q = query(
      collection(db, this.USERS_COL),
      where('normalizedEmail', '==', normalizedEmail),
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0];
      const user = userDoc.data() as User;
      user.id = userDoc.id;
      this.cacheUser(user);
      return user;
    }
    return null;
  }

  private async getUserByExactEmail(email: string): Promise<User | null> {
    const q = query(
      collection(db, this.USERS_COL),
      where('email', '==', email),
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0];
      const user = userDoc.data() as User;
      user.id = userDoc.id;
      this.cacheUser(user);
      return user;
    }
    return null;
  }

  async getUserById(id: string): Promise<User | null> {
    const userDocRef = doc(db, this.USERS_COL, id);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const user = userDoc.data() as User;
      user.id = userDoc.id;
      this.cacheUser(user);
      return user;
    }

    return null;
  }

  async addList(
    user: User,
    listName: string,
    type: ListType = 'gift',
  ): Promise<void> {
    let newList: List = {
      name: listName,
      type,
      creatorID: user.id!,
      items: [],
      lastModified: new Date().toISOString(),
      ...(user.uid ? { creatorUid: user.uid } : {}),
    };
    const listsCol = collection(db, this.LISTS_COL);
    const docRef = await addDoc(listsCol, newList);
    const docId = docRef.id;

    // Update the user's lists array in the database
    const updatedLists = [...(user.lists ?? []), docId];
    const userDocRef = doc(db, this.USERS_COL, user.id!);
    await updateDoc(userDocRef, {
      lists: updatedLists,
    });
    user.lists = updatedLists;

    // Add a short URL for the new list
    const shortUrl = await this.createAndAddShortUrl({ ...newList, id: docId });
    newList.id = docId;
    newList.shortUrl = shortUrl;
    await this.updateListShortUrl(newList, shortUrl);
    this.cacheList(newList);
    this.patchCurrentUser(user.id!, { lists: updatedLists });
  }

  async saveList(list: List): Promise<boolean> {
    try {
      if (
        !list.creatorUid &&
        this.currentUser?.uid &&
        list.creatorID === this.currentUser.id
      ) {
        list.creatorUid = this.currentUser.uid;
      }
      const listDocRef = doc(db, this.LISTS_COL, list.id!);
      const lastModified = new Date().toISOString();
      const { id, ...listData } = list;
      await updateDoc(listDocRef, { ...listData, lastModified } as any);
      list.lastModified = lastModified;
      this.cacheList(list);
      return true;
    } catch (error) {
      console.error('Error saving list:', error);
      return false;
    }
  }

  async updateListItems(
    listId: string,
    items: Item[],
    updateLastModified: boolean = false,
  ): Promise<boolean> {
    try {
      const listDocRef = doc(db, this.LISTS_COL, listId);
      const lastModified = updateLastModified
        ? new Date().toISOString()
        : undefined;
      const payload = lastModified ? { items, lastModified } : { items };
      await updateDoc(listDocRef, payload);
      const cached = this.listCache.get(listId);
      if (cached) {
        this.cacheList({
          ...cached,
          items,
          ...(lastModified ? { lastModified } : {}),
        });
      }
      return true;
    } catch (error) {
      console.error('Error updating list items:', error);
      return false;
    }
  }

  async deleteList(user: User, list: List) {
    const updatedLists = user.lists?.filter((id) => id !== list.id) ?? [];
    const userDocRef = doc(db, this.USERS_COL, user.id!);
    if (list.id) {
      this.storageService.removeRecentList(list.id);
    }
    const hasRecentEntry = !!(list.id && user.recentLists?.[list.id]);
    if (hasRecentEntry && list.id) {
      const updatedRecent = { ...user.recentLists };
      delete updatedRecent[list.id];
      await updateDoc(
        userDocRef,
        'lists',
        updatedLists,
        new FieldPath('recentLists', list.id),
        deleteField(),
      );
      user.recentLists = updatedRecent;
      user.lists = updatedLists;
      this.patchCurrentUser(user.id!, {
        lists: updatedLists,
        recentLists: updatedRecent,
      });
    } else {
      await updateDoc(userDocRef, {
        lists: updatedLists,
      });
      user.lists = updatedLists;
      this.patchCurrentUser(user.id!, { lists: updatedLists });
    }

    // Delete references to this list in other users' savedLists arrays
    const usersCol = collection(db, this.USERS_COL);
    const q = query(usersCol, where('savedLists', 'array-contains', list.id));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      await Promise.all(
        querySnapshot.docs.map((document) => {
          const otherUser = document.data() as User;
          const otherUserDocRef = doc(db, this.USERS_COL, document.id);
          return updateDoc(otherUserDocRef, {
            savedLists:
              otherUser.savedLists?.filter((id) => id !== list.id) ?? [],
          });
        }),
      );
    }

    // Delete references to this list's short URL
    if (list.shortUrl) {
      const shortUrlDocRef = doc(db, this.SHORT_URLS_COL, list.shortUrl);
      await deleteDoc(shortUrlDocRef);
    }

    // Delete the list
    const listDocRef = doc(db, this.LISTS_COL, list.id!);
    await deleteDoc(listDocRef);
    if (list.id) {
      this.listCache.delete(list.id);
    }
  }

  private async updateListShortUrl(list: List, shortUrl: string) {
    const listDocRef = doc(db, this.LISTS_COL, list.id!);
    await updateDoc(listDocRef, {
      shortUrl: shortUrl,
    });
  }

  async getLists(user: User, saved: boolean): Promise<List[]> {
    let listIds = (saved ? user.savedLists : user.lists) ?? [];
    return this.getListsFromIds(listIds);
  }

  async getListsFromIds(listIds: string[]): Promise<List[]> {
    if (!listIds || listIds.length === 0) return [];

    const chunks = [];
    // Split the listIds into chunks of 30
    for (let i = 0; i < listIds.length; i += 30) {
      chunks.push(listIds.slice(i, i + 30));
    }

    const listPromises = chunks.map(async (chunk) => {
      const q = query(
        collection(db, this.LISTS_COL),
        where(documentId(), 'in', chunk),
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => {
        const list = doc.data() as List;
        list.id = doc.id;
        this.cacheList(list);
        return list;
      });
    });

    const listsArrays = await Promise.all(listPromises);
    const allLists = listsArrays.flat();

    const listMap = new Map(allLists.map((list) => [list.id!, list]));

    return listIds
      .map((id) => listMap.get(id))
      .filter((list): list is List => list !== undefined);
  }

  async getUsersFromIds(userIds: string[]): Promise<User[]> {
    if (!userIds || userIds.length === 0) return [];

    const chunks = [];
    for (let i = 0; i < userIds.length; i += 30) {
      chunks.push(userIds.slice(i, i + 30));
    }

    const userPromises = chunks.map(async (chunk) => {
      const q = query(
        collection(db, this.USERS_COL),
        where(documentId(), 'in', chunk),
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => {
        const user = doc.data() as User;
        user.id = doc.id;
        this.cacheUser(user);
        return user;
      });
    });

    const usersArrays = await Promise.all(userPromises);
    return usersArrays.flat();
  }

  async getListsWithCreators(
    listIds: string[],
  ): Promise<{ list: List; creator: User | null }[]> {
    const lists = await this.getListsFromIds(listIds);
    const creatorIds = [...new Set(lists.map((list) => list.creatorID))];
    const creators = await this.getUsersFromIds(creatorIds);
    const creatorsMap = new Map(creators.map((user) => [user.id, user]));

    const listsWithCreators = lists.map((list) => {
      return {
        list: list,
        creator: creatorsMap.get(list.creatorID) ?? null,
      };
    });

    return listsWithCreators;
  }

  async addToSavedLists(user: User, list: List): Promise<void> {
    if (user.savedLists?.includes(list.id!) || user.lists?.includes(list.id!))
      return;
    const updatedSavedLists = [...(user.savedLists ?? []), list.id!];
    const userDocRef = doc(db, this.USERS_COL, user.id!);
    await updateDoc(userDocRef, {
      savedLists: updatedSavedLists,
    });
    user.savedLists = updatedSavedLists;
    this.patchCurrentUser(user.id!, { savedLists: updatedSavedLists });
  }

  async removeFromSavedLists(user: User, list: List): Promise<void> {
    if (!user.savedLists?.includes(list.id!)) return;
    const updatedSavedLists = user.savedLists.filter((id) => id !== list.id);
    const userDocRef = doc(db, this.USERS_COL, user.id!);
    await updateDoc(userDocRef, {
      savedLists: updatedSavedLists,
    });
    user.savedLists = updatedSavedLists;
    this.patchCurrentUser(user.id!, { savedLists: updatedSavedLists });
  }

  pruneRecentLists(recentLists: { [id: string]: string }): {
    pruned: { [id: string]: string };
    droppedIds: string[];
  } {
    const sortedIds = this.storageService.sortRecentListIds(recentLists);
    const keptIds = sortedIds.slice(0, this.MAX_RECENT_LISTS);
    const droppedIds = sortedIds.slice(this.MAX_RECENT_LISTS);
    const pruned: { [id: string]: string } = {};
    for (const id of keptIds) {
      pruned[id] = recentLists[id];
    }
    return { pruned, droppedIds };
  }

  mergeRecentLists(
    accountRecent: { [id: string]: string } | undefined,
    localRecent: { [id: string]: string } | undefined,
  ): { merged: { [id: string]: string }; changed: boolean } {
    const existing = accountRecent ?? {};
    const combined: { [id: string]: string } = { ...existing };

    for (const [id, localTs] of Object.entries(localRecent ?? {})) {
      const localTime = new Date(localTs).getTime() || 0;
      const existingTime =
        id in combined ? new Date(combined[id]).getTime() || 0 : -1;
      if (!(id in combined) || localTime > existingTime) {
        combined[id] = localTs;
      }
    }

    const { pruned: merged } = this.pruneRecentLists(combined);
    const existingKeys = Object.keys(existing);
    const mergedKeys = Object.keys(merged);
    const changed =
      existingKeys.length !== mergedKeys.length ||
      mergedKeys.some((id) => existing[id] !== merged[id]);

    return { merged, changed };
  }

  private enqueueRecentListsWrite(work: () => Promise<void>): Promise<void> {
    const next = this.pendingRecentListsWrite.catch(() => {}).then(work);
    this.pendingRecentListsWrite = next.catch(() => {});
    return next;
  }

  private async syncLocalRecentListsToAccount(user: User): Promise<User> {
    const localRecent = this.storageService.getRecentLists();
    if (!user.id || Object.keys(localRecent).length === 0) {
      return user;
    }

    const { merged, changed } = this.mergeRecentLists(
      user.recentLists,
      localRecent,
    );

    try {
      if (changed) {
        const userDocRef = doc(db, this.USERS_COL, user.id);
        await updateDoc(userDocRef, { recentLists: merged });
      }
      this.storageService.clearRecentLists();
      const updatedUser = changed ? { ...user, recentLists: merged } : user;
      this.cacheUser(updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('Error syncing local recent lists to account:', error);
      return user;
    }
  }

  getSortedRecentListIds(user?: User | null): string[] {
    const activeUser = user !== undefined ? user : this.currentUser;
    if (!activeUser) {
      return this.storageService.getSortedRecentListIds();
    }
    const localRecent = this.storageService.getRecentLists();
    const source =
      Object.keys(localRecent).length > 0
        ? this.mergeRecentLists(activeUser.recentLists, localRecent).merged
        : (activeUser.recentLists ?? {});
    return this.storageService.sortRecentListIds(source);
  }

  async addRecentList(listId: string): Promise<void> {
    if (!listId) return;
    const user = this.currentUser;
    if (!user?.id) {
      this.storageService.addRecentList(listId);
      return;
    }

    const timestamp = new Date().toISOString();
    const nextMap = { ...(user.recentLists ?? {}), [listId]: timestamp };
    const { pruned, droppedIds } = this.pruneRecentLists(nextMap);

    this.patchCurrentUser(user.id, { recentLists: pruned });

    await this.enqueueRecentListsWrite(async () => {
      try {
        const userDocRef = doc(db, this.USERS_COL, user.id!);
        const extraArgs: unknown[] = [];
        for (const droppedId of droppedIds) {
          extraArgs.push(new FieldPath('recentLists', droppedId), deleteField());
        }
        await updateDoc(
          userDocRef,
          new FieldPath('recentLists', listId),
          timestamp,
          ...extraArgs,
        );
      } catch (error) {
        console.error('Error saving recent list to account:', error);
      }
    });
  }

  async removeRecentList(listId: string): Promise<void> {
    return this.removeRecentLists([listId]);
  }

  async removeRecentLists(listIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(listIds.filter(Boolean))];
    if (!uniqueIds.length) return;

    for (const id of uniqueIds) {
      this.storageService.removeRecentList(id);
    }

    const user = this.currentUser;
    if (!user?.id || !user.recentLists) return;

    const idsToDelete = uniqueIds.filter((id) => id in user.recentLists!);
    if (!idsToDelete.length) return;

    const updated = { ...user.recentLists };
    for (const id of idsToDelete) {
      delete updated[id];
    }
    this.patchCurrentUser(user.id, { recentLists: updated });

    await this.enqueueRecentListsWrite(async () => {
      try {
        const userDocRef = doc(db, this.USERS_COL, user.id!);
        const [firstId, ...restIds] = idsToDelete;
        const extraArgs: unknown[] = [];
        for (const id of restIds) {
          extraArgs.push(new FieldPath('recentLists', id), deleteField());
        }
        await updateDoc(
          userDocRef,
          new FieldPath('recentLists', firstId),
          deleteField(),
          ...extraArgs,
        );
      } catch (error) {
        console.error('Error removing recent list(s) from account:', error);
      }
    });
  }

  async getList(listId: string): Promise<List | null> {
    const listDocRef = doc(db, this.LISTS_COL, listId);
    const listDoc = await getDoc(listDocRef);
    if (listDoc.exists()) {
      const list = listDoc.data() as List;
      list.id = listDoc.id;
      this.cacheList(list);
      return list;
    }

    return null;
  }

  async changeName(id: string, name: string) {
    const userDocRef = doc(db, this.USERS_COL, id);
    await updateDoc(userDocRef, {
      name: name,
    });
    this.patchCurrentUser(id, { name });
  }

  async checkShortUrl(shortUrl: string): Promise<string | null> {
    const shortUrlDocRef = doc(db, this.SHORT_URLS_COL, shortUrl);
    const shortUrlDoc = await getDoc(shortUrlDocRef);
    if (shortUrlDoc.exists()) {
      const longUrl = shortUrlDoc.data()['listId'];
      return longUrl;
    }
    return null;
  }

  async createAndAddShortUrl(list: List): Promise<string> {
    if (list.shortUrl) return list.shortUrl;

    const listId = list.id!;
    let shortUrl = '';
    while (true) {
      shortUrl = Math.random().toString(36).substring(2, 5);
      const shortUrlDocRef = doc(db, this.SHORT_URLS_COL, shortUrl);
      const shortUrlDoc = await getDoc(shortUrlDocRef);
      if (!shortUrlDoc.exists()) break; // Unique short URL found
    }
    await setDoc(doc(db, this.SHORT_URLS_COL, shortUrl), { listId: listId });
    await this.updateListShortUrl({ id: listId } as List, shortUrl);
    list.shortUrl = shortUrl;
    const cached = this.listCache.get(listId);
    if (cached) {
      this.cacheList({ ...cached, shortUrl });
    } else if (list.creatorID && list.name) {
      this.cacheList({ ...list, id: listId, shortUrl });
    }
    return shortUrl;
  }

  // Firebase Functions
  async getSuggestions(list: List) {
    const getSuggestions = httpsCallable(functions, 'getSuggestions');

    return getSuggestions({ list: list })
      .then((result: any) => {
        return JSON.parse(
          result.data.response.candidates[0].content.parts[0].text,
        );
      })
      .catch((error) => {
        var code = error.code;
        var message = error.message;
        var details = error.details;
        console.log(
          `Error Code: ${code}\nMessage: ${message}\nDetails: ${details}`,
        );
      });
  }

  async getAmazonLinks(
    url: string,
  ): Promise<{ keepaUrl: string; affiliateUrl: string }> {
    const getAmazonLinks = httpsCallable(functions, 'getAmazonLinks');

    return getAmazonLinks({ url: url })
      .then((result: any) => {
        return result.data;
      })
      .catch((error) => {
        var code = error.code;
        var message = error.message;
        var details = error.details;
        console.log(
          `Error Code: ${code}\nMessage: ${message}\nDetails: ${details}`,
        );
      });
  }

  // Helper Functions

  /**
   * Determines if a given URL is an Amazon URL.
   * This is a basic filter to reduce unnecessary cloud calls
   * for non-Amazon URLs.
   * @param url - The URL to evaluate.
   * @returns True if the URL is an Amazon URL, false otherwise.
   */
  isAmazonUrl(url: string): boolean {
    if (!url) return false;
    return ['amazon', 'amzn.to', 'a.co'].some((domain) => url.includes(domain));
  }
}
