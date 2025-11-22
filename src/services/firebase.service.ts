import { Injectable } from '@angular/core';
import { app } from 'src/environments/environment';
import {
  collection,
  getDocs,
  getFirestore,
  addDoc,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { User } from '../models/user';
import { List } from '../models/list';

const db = getFirestore(app);
const functions = getFunctions(app);

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  constructor() {}

  async getUsers(): Promise<User[]> {
    // Get users
    const usersCol = collection(db, 'users');
    const userSnapshot = await getDocs(usersCol);
    const userList = await Promise.all(
      userSnapshot.docs.map(async (doc) => {
        const user = doc.data() as User;
        user.id = doc.id;
        return user;
      }),
    );

    return userList;
  }

  async createUserIfNeeded(email: string): Promise<User | null> {
    let userId = await this.getUserIdByEmail(email);
    if (!userId) {
      userId = await this.addUser(email);
    }
    return await this.getUserById(userId);
  }

  async getUserIdByEmail(email: string): Promise<string> {
    const usersCol = collection(db, 'users');
    const q = query(usersCol, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return doc.id;
    }

    return '';
  }

  async getUserById(id: string): Promise<User | null> {
    const usersCol = collection(db, 'users');
    const q = query(usersCol, where('__name__', '==', id));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const user = doc.data() as User;
      user.id = doc.id;
      return user;
    }

    return null;
  }

  async addUser(email: string): Promise<string> {
    let newUser: User = { email: email.toLowerCase().trim(), name: email };
    const usersCol = collection(db, 'users');
    const docRef = await addDoc(usersCol, newUser);
    return docRef.id;
  }

  async addList(user: User, listName: string): Promise<void> {
    let newList: List = { name: listName, creatorID: user.id!, items: [] };
    const listsCol = collection(db, `lists`);
    const docRef = await addDoc(listsCol, newList);
    const docId = docRef.id;

    // Update the user's lists array in the database
    const userDocRef = doc(db, 'users', user.id!);
    await updateDoc(userDocRef, {
      lists: [...(user.lists ?? []), docId],
    });
  }

  async saveList(list: List): Promise<boolean> {
    const listDocRef = doc(db, 'lists', list.id!);
    await updateDoc(listDocRef, list as any).catch((error) => {
      console.log(error);
      return false;
    });
    return true;
  }

  async deleteList(user: User, list: List) {
    // Update the user's lists array in the database
    const userDocRef = doc(db, 'users', user.id!);
    await updateDoc(userDocRef, {
      lists: user.lists?.filter((id) => id !== list.id),
    });

    // Delete references to this list in other users' savedLists arrays
    const usersCol = collection(db, 'users');
    const q = query(usersCol, where('savedLists', 'array-contains', list.id));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      querySnapshot.docs.forEach(async (document) => {
        const userId = document.id;
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, {
          savedLists: user.savedLists?.filter((id) => id !== list.id),
        });
      });
    }

    // Delete references to this list's short URL
    if (list.shortUrl) {
      const shortUrlsCol = collection(db, 'shortUrls');
      const q = query(shortUrlsCol, where('__name__', '==', list.shortUrl));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const shortUrlDocRef = doc.ref;
        await deleteDoc(shortUrlDocRef);
      }
    }

    // Delete the list
    const listDocRef = doc(db, 'lists', list.id!);
    await deleteDoc(listDocRef);
  }

  async updateListShortUrl(list: List, shortUrl: string) {
    const listDocRef = doc(db, 'lists', list.id!);
    await updateDoc(listDocRef, {
      shortUrl: shortUrl,
    });
  }

  async getLists(user: User, saved: boolean): Promise<List[]> {
    let listIds = (saved ? user.savedLists : user.lists) ?? [];
    return this.getListsFromIds(listIds);
  }

  async getListsFromIds(listIds: string[]): Promise<List[]> {
    let lists: List[] = [];
    for (let listId of listIds) {
      const listCol = collection(db, `lists`);
      const q = query(listCol, where('__name__', '==', listId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const list = doc.data() as List;
        list.id = doc.id;
        lists.push(list);
      }
    }
    return lists;
  }

  async addToSavedLists(user: User, list: List) {
    if (user.savedLists?.includes(list.id!) || user.lists?.includes(list.id!))
      return;
    // Update the user's savedLists array in the database
    const userDocRef = doc(db, 'users', user.id!);
    updateDoc(userDocRef, {
      savedLists: [...(user.savedLists ?? []), list.id],
    });
  }

  async removeFromSavedLists(user: User, list: List) {
    if (!user.savedLists?.includes(list.id!)) return;
    // Update the user's savedLists array in the database
    const userDocRef = doc(db, 'users', user.id!);
    updateDoc(userDocRef, {
      savedLists: user.savedLists?.filter((id) => id !== list.id),
    });
  }

  async getList(listId: string): Promise<List | null> {
    const listCol = collection(db, `lists`);
    const q = query(listCol, where('__name__', '==', listId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const list = doc.data() as List;
      list.id = doc.id;
      return list;
    }

    return null;
  }

  async changeName(id: string, name: string) {
    const userDocRef = doc(db, 'users', id);
    await updateDoc(userDocRef, {
      name: name,
    });
  }

  async checkShortUrl(shortUrl: string): Promise<string | null> {
    const shortUrlsCol = collection(db, 'shortUrls');
    const q = query(shortUrlsCol, where('__name__', '==', shortUrl));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const longUrl = doc.data()['listId'];
      return longUrl;
    }
    return null;
  }

  async createAndAddShortUrl(list: List): Promise<string> {
    if (list.shortUrl) return list.shortUrl;

    const listId = list.id!;
    const shortUrlsCol = collection(db, 'shortUrls');
    let shortUrl = '';
    while (true) {
      shortUrl = Math.random().toString(36).substring(2, 5);
      const q = query(shortUrlsCol, where('__name__', '==', shortUrl));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) break; // Unique short URL found
    }
    await setDoc(doc(db, 'shortUrls', shortUrl), { listId: listId });
    await this.updateListShortUrl({ id: listId } as List, shortUrl);
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

  async getCamelLink(url: string): Promise<string> {
    const getCamelLink = httpsCallable(functions, 'getCamelLink');

    return getCamelLink({ url: url })
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
