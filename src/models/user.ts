export interface User {
  id?: string;
  uid?: string;
  name: string;
  email: string;
  normalizedEmail?: string;
  lists?: string[]; // IDs
  savedLists?: string[]; // IDs
  recentLists?: { [id: string]: string }; // listId -> ISO timestamp
  spoilerChoices?: { [id: string]: boolean }; // listId -> show spoilers
}
