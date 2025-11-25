import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { List } from 'src/models/list';

@Component({
  selector: 'app-recent-list',
  imports: [CommonModule],
  templateUrl: './recent-list.component.html',
  styleUrl: './recent-list.component.css',
})
export class RecentListComponent {
  @Input() list!: List;
  @Input() creator: string = 'Unknown';
  @Input() showDeleteButton: boolean = false;
  @Input() theme: string = '';
  @Output() listClicked = new EventEmitter<List>();
  @Output() deleteClicked = new EventEmitter<{
    list: List;
    event: MouseEvent;
  }>();

  onClick() {
    this.listClicked.emit(this.list);
  }

  onDelete(event: MouseEvent) {
    event.stopPropagation();
    this.deleteClicked.emit({ list: this.list, event });
  }
}
