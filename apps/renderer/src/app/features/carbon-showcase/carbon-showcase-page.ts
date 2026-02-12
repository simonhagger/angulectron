import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-carbon-showcase-page',
  imports: [CommonModule],
  templateUrl: './carbon-showcase-page.html',
  styleUrl: './carbon-showcase-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarbonShowcasePage {
  readonly tags = ['Foundation', 'Data Grid', 'Workflow', 'Accessibility'];
}
