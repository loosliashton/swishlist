import { NgModule, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AddListComponent } from './home/add-list/add-list.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ListComponent } from './list/list.component';
import { AddItemComponent } from './list/add-item/add-item.component';
import { SpoilerPromptComponent } from './list/spoiler-prompt/spoiler-prompt.component';
import { ItemComponent } from './list/item/item.component';
import { ChangeNameComponent } from './home/change-name/change-name.component';
import { SuggestionsComponent } from './list/suggestions/suggestions.component';
import { ShareComponent } from './list/share/share.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { RecentListComponent } from './list/recent-list/recent-list.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { ShareTargetComponent } from './share-target/share-target.component';
import { ShortUrlReceiverComponent } from './short-url-receiver/short-url-receiver.component';
import { AboutComponent } from './about/about.component';
import { PrivacyComponent } from './privacy/privacy.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'about', component: AboutComponent },
  { path: 'privacy', component: PrivacyComponent },
  { path: 'my-lists', redirectTo: '', pathMatch: 'full' },
  { path: 'list/:id', component: ListComponent },
  { path: 'list', redirectTo: '/', pathMatch: 'full' },
  { path: 'share-target', component: ShareTargetComponent },
  { path: ':shorturl', component: ShortUrlReceiverComponent },
];

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    AddListComponent,
    AddItemComponent,
    SpoilerPromptComponent,
    ItemComponent,
    ChangeNameComponent,
    SuggestionsComponent,
    ShareComponent,
    ListComponent,
    ShareTargetComponent,
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot(routes),
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    BrowserAnimationsModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    FormsModule,
    CommonModule,
    RecentListComponent,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
  providers: [provideZoneChangeDetection()],
  bootstrap: [AppComponent],
})
export class AppModule {}
