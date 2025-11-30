import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { List } from 'src/models/list';
import { User } from 'src/models/user';
import { FirebaseService } from 'src/services/firebase.service';
import { StorageService } from 'src/services/storage.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: false,
})
export class HomeComponent implements OnInit {
  badEmail: boolean = false;
  email: string = '';
  theme: string = '';
  recentLists: List[] = [];
  recentListCreators: (User | null)[] = [];
  loading: boolean = false;

  constructor(
    private router: Router,
    private firebase: FirebaseService,
    private storageService: StorageService,
  ) {}

  async ngOnInit() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;

    if (currentMonth === 12) {
      this.theme = 'christmas';
    } else if (currentMonth === 11) {
      this.theme = 'fall';
    }

    // Retrieve the last used email
    const lastEmail = this.storageService.getLastEmail();
    if (lastEmail) {
      this.email = lastEmail;
    }

    // Retrieve recent lists
    const sortedIds = this.storageService.getSortedRecentListIds();
    if (!sortedIds.length) return;
    this.loading = true;

    const { lists, creators } = await this.firebase.getListsWithCreators(
      sortedIds.slice(0, 10),
    );
    this.recentLists = lists;
    this.recentListCreators = creators;

    this.loading = false;
  }

  navigateToList(list: List, user: User | null) {
    this.router.navigate(['/list', list.id], {
      state: { list: list, user: user },
    });
  }

  goToMyLists(email: string) {
    this.badEmail = false;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    email = email.toLowerCase().trim();

    if (emailPattern.test(email)) {
      this.storageService.setLastEmail(email);
      this.router.navigate(['/my-lists'], { queryParams: { email } });
    } else {
      this.badEmail = true;
    }
  }

  removeList(list: List, event: MouseEvent) {
    if (!confirm('Remove from recent lists?')) return;
    let index = this.recentLists.indexOf(list);
    this.recentLists = this.recentLists.filter((l) => l.id !== list.id);
    this.recentListCreators = this.recentListCreators.filter(
      (_name, i) => i !== index,
    );

    this.storageService.removeRecentList(list.id!);
  }
}
