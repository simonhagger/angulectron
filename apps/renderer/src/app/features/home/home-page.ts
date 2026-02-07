import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { UiPrimaryButtonComponent } from '@electron-foundation/material';
import { UiSurfaceCardComponent } from '@electron-foundation/primitives';
import { CarbonNoticeComponent } from '@electron-foundation/carbon-adapters';
import { getDesktopApi } from '@electron-foundation/desktop-api';
import { createShellBadge } from '@electron-foundation/shell';

@Component({
  selector: 'app-home-page',
  imports: [
    TranslocoDirective,
    UiPrimaryButtonComponent,
    UiSurfaceCardComponent,
    CarbonNoticeComponent,
  ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly transloco = inject(TranslocoService);

  readonly language = signal(this.transloco.getActiveLang());
  readonly desktopAvailable = signal(false);
  readonly appVersion = signal('N/A');
  readonly contractVersion = signal('N/A');
  readonly fileResult = signal('');
  readonly updateResult = signal('');
  readonly telemetryResult = signal('');

  readonly statusBadge = computed(() =>
    createShellBadge(this.desktopAvailable()),
  );
  readonly statusTranslationKey = computed(() =>
    this.statusBadge().label === 'Connected' ? 'connected' : 'disconnected',
  );

  constructor() {
    void this.initializeDesktopMetadata();
  }

  setLanguage(language: 'en-US') {
    this.transloco.setActiveLang(language);
    this.language.set(language);
  }

  async openFile() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.fileResult.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    const fileDialogResult = await desktop.dialog.openFile({
      title: 'Select a text file',
      filters: [{ name: 'Text files', extensions: ['txt', 'md', 'json'] }],
    });

    if (
      !fileDialogResult.ok ||
      fileDialogResult.data.canceled ||
      !fileDialogResult.data.fileToken
    ) {
      this.fileResult.set('No file selected.');
      return;
    }

    const readResult = await desktop.fs.readTextFile(
      fileDialogResult.data.fileToken,
    );

    if (!readResult.ok) {
      this.fileResult.set(readResult.error.message);
      return;
    }

    this.fileResult.set(readResult.data.slice(0, 140));
  }

  async checkUpdates() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.updateResult.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    const result = await desktop.updates.check();

    if (!result.ok) {
      this.updateResult.set(result.error.message);
      return;
    }

    this.updateResult.set(result.data.message ?? result.data.status);
  }

  async trackTelemetry() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.telemetryResult.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    const result = await desktop.telemetry.track('home.interaction', {
      language: this.language(),
      status: this.statusBadge().label,
    });

    this.telemetryResult.set(
      result.ok ? 'Event accepted.' : result.error.message,
    );
  }

  private async initializeDesktopMetadata() {
    const desktop = getDesktopApi();

    if (!desktop) {
      return;
    }

    this.desktopAvailable.set(true);

    const [versionResult, contractResult] = await Promise.all([
      desktop.app.getVersion(),
      desktop.app.getContractVersion(),
    ]);

    if (versionResult.ok) {
      this.appVersion.set(versionResult.data);
    }

    if (contractResult.ok) {
      this.contractVersion.set(contractResult.data);
    }
  }
}
