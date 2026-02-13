import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { getDesktopApi } from '@electron-foundation/desktop-api';
import { createShellBadge } from '@electron-foundation/shell';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-home-page',
  imports: [CommonModule, MatButtonModule],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly transloco = inject(TranslocoService);
  readonly labels = toSignal(this.transloco.selectTranslateObject('home'), {
    initialValue: {
      title: 'home.title',
      subtitle: 'home.subtitle',
      desktopBridge: 'home.desktopBridge',
      connected: 'home.connected',
      disconnected: 'home.disconnected',
      appVersion: 'home.appVersion',
      contractVersion: 'home.contractVersion',
      activeLanguage: 'home.activeLanguage',
      actions: 'home.actions',
      openFile: 'home.openFile',
      checkUpdates: 'home.checkUpdates',
      trackTelemetry: 'home.trackTelemetry',
      useEnglish: 'home.useEnglish',
      filePreview: 'home.filePreview',
      updateStatus: 'home.updateStatus',
      telemetryStatus: 'home.telemetryStatus',
      governanceTitle: 'home.governanceTitle',
      governanceBody: 'home.governanceBody',
      desktopUnavailable: 'home.desktopUnavailable',
      selectTextFileTitle: 'home.selectTextFileTitle',
      textFiles: 'home.textFiles',
      noFileSelected: 'home.noFileSelected',
      eventAccepted: 'home.eventAccepted',
    },
  });

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
      this.fileResult.set(this.labels().desktopUnavailable);
      return;
    }

    const fileDialogResult = await desktop.dialog.openFile({
      title: this.labels().selectTextFileTitle,
      filters: [
        { name: this.labels().textFiles, extensions: ['txt', 'md', 'json'] },
      ],
    });

    if (
      !fileDialogResult.ok ||
      fileDialogResult.data.canceled ||
      !fileDialogResult.data.fileToken
    ) {
      this.fileResult.set(this.labels().noFileSelected);
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
      this.updateResult.set(this.labels().desktopUnavailable);
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
      this.telemetryResult.set(this.labels().desktopUnavailable);
      return;
    }

    const result = await desktop.telemetry.track('home.interaction', {
      language: this.language(),
      status: this.statusBadge().label,
    });

    this.telemetryResult.set(
      result.ok ? this.labels().eventAccepted : result.error.message,
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
