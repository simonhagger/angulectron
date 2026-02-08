import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { getDesktopApi } from '@electron-foundation/desktop-api';

@Component({
  selector: 'app-updates-release-page',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './updates-release-page.html',
  styleUrl: './updates-release-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdatesReleasePage {
  readonly desktopAvailable = signal(!!getDesktopApi());
  readonly appVersion = signal('N/A');
  readonly contractVersion = signal('N/A');
  readonly updateState = signal('Idle.');

  constructor() {
    void this.loadMetadata();
  }

  async checkForUpdates() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.updateState.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    this.updateState.set('Checking for updates...');
    const result = await desktop.updates.check();
    if (!result.ok) {
      this.updateState.set(result.error.message);
      return;
    }

    this.updateState.set(result.data.message ?? result.data.status);
  }

  private async loadMetadata() {
    const desktop = getDesktopApi();
    if (!desktop) {
      return;
    }

    const [appVersion, contractVersion] = await Promise.all([
      desktop.app.getVersion(),
      desktop.app.getContractVersion(),
    ]);

    if (appVersion.ok) {
      this.appVersion.set(appVersion.data);
    }

    if (contractVersion.ok) {
      this.contractVersion.set(contractVersion.data);
    }
  }
}
