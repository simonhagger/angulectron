import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CarbonNoticeComponent } from '@electron-foundation/carbon-adapters';

@Component({
  selector: 'app-carbon-showcase-page',
  imports: [CommonModule, CarbonNoticeComponent],
  templateUrl: './carbon-showcase-page.html',
  styleUrl: './carbon-showcase-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarbonShowcasePage {
  readonly tags = ['Foundation', 'Data Grid', 'Workflow', 'Accessibility'];
}
