import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'ui-carbon-notice',
  imports: [],
  templateUrl: './carbon-adapters.html',
  styleUrl: './carbon-adapters.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarbonNoticeComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) body!: string;
  @Input() status: 'info' | 'warning' | 'success' = 'info';
}
