import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';

type Density = 'comfortable' | 'compact';

@Component({
  selector: 'app-material-carbon-lab-page',
  imports: [
    CommonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDividerModule,
  ],
  templateUrl: './material-carbon-lab-page.html',
  styleUrl: './material-carbon-lab-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaterialCarbonLabPage {
  readonly density = signal<Density>('comfortable');
  readonly featureOn = signal(true);

  setDensity(value: string) {
    if (value === 'compact' || value === 'comfortable') {
      this.density.set(value);
    }
  }

  toggleFeature() {
    this.featureOn.update((current) => !current);
  }
}
