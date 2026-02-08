import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatListModule } from '@angular/material/list';

type ThemeTone = 'Neutral' | 'Brand' | 'Alert';

@Component({
  selector: 'app-material-showcase-page',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatListModule,
  ],
  templateUrl: './material-showcase-page.html',
  styleUrl: './material-showcase-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaterialShowcasePage {
  readonly compactMode = signal(false);
  readonly completion = signal(46);
  readonly selectedTone = signal<ThemeTone>('Neutral');

  readonly tones: ThemeTone[] = ['Neutral', 'Brand', 'Alert'];

  setTone(value: string) {
    if (value === 'Neutral' || value === 'Brand' || value === 'Alert') {
      this.selectedTone.set(value);
    }
  }

  toggleCompact(checked: boolean) {
    this.compactMode.set(checked);
  }

  advanceProgress() {
    this.completion.update((value) => (value >= 100 ? 12 : value + 22));
  }
}
