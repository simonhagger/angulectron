import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'ui-primary-button',
  imports: [MatButtonModule],
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
