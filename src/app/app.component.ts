import { Component, OnInit } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: false,
})
export class AppComponent implements OnInit {
  title = 'swishlist';

  constructor(
    private swUpdate: SwUpdate,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(
          filter(
            (evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY',
          ),
        )
        .subscribe(() => {
          const snack = this.snackBar.open('New version available', 'Reload');
          snack.onAction().subscribe(() => {
            this.swUpdate
              .activateUpdate()
              .then(() => window.location.reload())
              .catch((err) => console.error('Failed to activate update', err));
          });
        });
    }
  }
}
