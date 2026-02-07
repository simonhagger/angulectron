import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-carbon-notice',
  imports: [],
  templateUrl: './carbon-adapters.html',
  styleUrl: './carbon-adapters.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarbonNoticeComponent {
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly status = input<'info' | 'warning' | 'success'>('info');
}
