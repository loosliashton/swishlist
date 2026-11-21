import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Clipboard } from '@angular/cdk/clipboard';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { GiftSwapComponent } from './gift-swap.component';

describe('GiftSwapComponent', () => {
  let component: GiftSwapComponent;
  let fixture: ComponentFixture<GiftSwapComponent>;
  let clipboardSpy: jasmine.SpyObj<Clipboard>;
  let snackbarSpy: jasmine.SpyObj<MatSnackBar>;

  beforeEach(async () => {
    clipboardSpy = jasmine.createSpyObj('Clipboard', ['copy']);
    snackbarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      declarations: [GiftSwapComponent],
      imports: [
        FormsModule,
        NoopAnimationsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSnackBarModule,
      ],
      providers: [
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: MAT_DIALOG_DATA, useValue: null },
        { provide: Clipboard, useValue: clipboardSpy },
        { provide: MatSnackBar, useValue: snackbarSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GiftSwapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should add single and comma/newline-separated names while skipping duplicates', () => {
    component.newName = 'Alice, Bob\ncharlie, alice';
    component.addNamesFromInput();

    expect(component.participants).toEqual(['Alice', 'Bob', 'charlie']);
    expect(component.newName).toBe('');
  });

  it('should require at least 2 participants to generate a swap', () => {
    component.participants = ['Alice'];
    component.generateSwap();

    expect(component.showResults).toBeFalse();
    expect(component.pairs.length).toBe(0);
    expect(snackbarSpy.open).toHaveBeenCalled();
  });

  it('should generate a single Hamiltonian cycle with no self-assignments', () => {
    const names = ['Alice', 'Bob', 'Charlie', 'Dana', 'Eli'];
    const pairs = component.createSingleCyclePairs(names);

    expect(pairs.length).toBe(names.length);

    const givers = new Set(pairs.map((p) => p.giver));
    const receivers = new Set(pairs.map((p) => p.receiver));
    expect(givers.size).toBe(names.length);
    expect(receivers.size).toBe(names.length);

    const nextMap = new Map<string, string>();
    for (const pair of pairs) {
      expect(pair.giver).not.toBe(pair.receiver);
      nextMap.set(pair.giver, pair.receiver);
    }

    // Verify all participants belong to one single cycle
    const visited = new Set<string>();
    let current = pairs[0].giver;
    for (let i = 0; i < names.length; i++) {
      visited.add(current);
      current = nextMap.get(current)!;
    }
    expect(visited.size).toBe(names.length);
    expect(current).toBe(pairs[0].giver);
  });

  it('should copy formatted results to clipboard', () => {
    component.pairs = [
      { giver: 'Alice', receiver: 'Bob' },
      { giver: 'Bob', receiver: 'Alice' },
    ];
    component.copyResults();

    expect(clipboardSpy.copy).toHaveBeenCalledWith(
      'Gift Swap:\n• Alice → Bob\n• Bob → Alice',
    );
    expect(snackbarSpy.open).toHaveBeenCalled();
  });
});
