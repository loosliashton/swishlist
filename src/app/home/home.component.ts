import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { List } from 'src/models/list';
import { User } from 'src/models/user';
import { FirebaseService } from 'src/services/firebase.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: false,
})
export class HomeComponent implements OnInit {
  badEmail: boolean = false;
  email: string = '';
  christmasTheme: boolean = false;
  recentLists: List[] = [];
  recentListCreators: (User | null)[] = [];
  loading: boolean = false;

  constructor(
    private router: Router,
    private firebase: FirebaseService,
  ) {}

  async ngOnInit() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;

    if ([11, 12].includes(currentMonth)) {
      this.christmasTheme = true;
    }

    // Retrieve the last used email
    const lastEmail = localStorage.getItem('lastEmail');
    if (lastEmail) {
      this.email = lastEmail;
    }

    // Retrieve recent lists
    const recentListsObject = JSON.parse(
      localStorage.getItem('recentLists') || '{}',
    );
    let f = Object.keys(recentListsObject).length;
    if (!Object.keys(recentListsObject).length) return;
    this.loading = true;

    // Sort the recent lists by date
    let sorted = Object.keys(recentListsObject).sort((a, b) => {
      let dateA = new Date(recentListsObject[a]);
      let dateB = new Date(recentListsObject[b]);
      return dateB.getTime() - dateA.getTime();
    });

    this.recentLists = await this.firebase.getListsFromIds(sorted.slice(0, 5));
    for (let list of this.recentLists) {
      let creator = await this.firebase.getUserById(list.creatorID);
      this.recentListCreators.push(creator);
    }

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
      localStorage.setItem('lastEmail', email);
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

    let recentLists = JSON.parse(localStorage.getItem('recentLists') || '{}');
    delete recentLists[list.id!];
    localStorage.setItem('recentLists', JSON.stringify(recentLists));
  }
}
