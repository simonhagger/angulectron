import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { RuntimeSettingsService } from '../runtime-settings.service';

@Component({
  selector: 'app-settings-app-page',
  imports: [CommonModule, MatCardModule, MatButtonModule],
  templateUrl: './settings-app-page.html',
  styleUrl: './settings-app-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAppPage {
  protected readonly settings = inject(RuntimeSettingsService);
}
