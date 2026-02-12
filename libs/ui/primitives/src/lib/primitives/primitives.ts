import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'ui-surface-card',
  imports: [],
  templateUrl: './primitives.html',
  styleUrl: './primitives.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiSurfaceCardComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle: string | null = null;
}
