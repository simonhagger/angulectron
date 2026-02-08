import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

type DensityMode = 'comfortable' | 'compact';
type AccentTone = 'amber' | 'teal' | 'blue';

@Component({
  selector: 'app-tailwind-showcase-page',
  imports: [CommonModule],
  templateUrl: './tailwind-showcase-page.html',
  styleUrl: './tailwind-showcase-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TailwindShowcasePage {
  readonly density = signal<DensityMode>('comfortable');
  readonly accent = signal<AccentTone>('amber');
  readonly elevated = signal(true);

  readonly cardPadding = computed(() =>
    this.density() === 'compact' ? 'p-4' : 'p-6',
  );

  readonly accentClasses = computed(() => {
    const accent = this.accent();
    if (accent === 'teal') {
      return 'from-teal-500 to-cyan-600';
    }
    if (accent === 'blue') {
      return 'from-blue-500 to-indigo-600';
    }
    return 'from-amber-500 to-orange-600';
  });

  setDensity(mode: DensityMode) {
    this.density.set(mode);
  }

  setAccent(tone: AccentTone) {
    this.accent.set(tone);
  }

  toggleElevation() {
    this.elevated.update((current) => !current);
  }
}
