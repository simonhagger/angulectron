import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'ui-primary-button',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './material.html',
  styleUrl: './material.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiPrimaryButtonComponent {
  readonly label = input.required<string>();
  readonly icon = input<string | null>(null);
  readonly disabled = input(false);
  readonly pressed = output<Event>();
}
