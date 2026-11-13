import { Item } from "./item";

export type ListType = 'gift' | 'general';

export interface List {
  id?: string;
  name: string;
  type?: ListType;
  items?: Item[];
  creatorID: string; // ID
  creatorUid?: string;
  shortUrl?: string;
  ideas?: string;
}
