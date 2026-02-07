import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-surface-card',
  imports: [],
  templateUrl: './primitives.html',
  styleUrl: './primitives.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiSurfaceCardComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
}
