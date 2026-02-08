import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

type Preset = 'material' | 'carbonish' | 'sunrise';

@Component({
  selector: 'app-theme-tokens-playground-page',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
  ],
  templateUrl: './theme-tokens-playground-page.html',
  styleUrl: './theme-tokens-playground-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeTokensPlaygroundPage {
  readonly preset = signal<Preset>('material');
  readonly dense = signal(false);

  readonly presetClass = computed(() => {
    const current = this.preset();
    if (current === 'carbonish') {
      return 'preset-carbonish';
    }
    if (current === 'sunrise') {
      return 'preset-sunrise';
    }
    return 'preset-material';
  });

  setPreset(value: string) {
    if (value === 'material' || value === 'carbonish' || value === 'sunrise') {
      this.preset.set(value);
    }
  }

  toggleDensity() {
    this.dense.update((current) => !current);
  }
}
