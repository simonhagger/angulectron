import {
  ChangeDetectionStrategy,
  computed,
  Component,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { getDesktopApi } from '@electron-foundation/desktop-api';
import { createShellBadge } from '@electron-foundation/shell';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-home-page',
  imports: [CommonModule, MatButtonModule],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  readonly labels = {
    title: 'Workspace Home',
    subtitle: 'Desktop bridge status and quick integration actions.',
    desktopBridge: 'Desktop bridge',
    connected: 'Connected',
    disconnected: 'Disconnected',
    appVersion: 'App version',
    contractVersion: 'Contract version',
    activeLanguage: 'Active language',
    actions: 'Actions',
    openFile: 'Open file',
    checkUpdates: 'Check updates',
    trackTelemetry: 'Track telemetry',
    useEnglish: 'Use English',
    filePreview: 'File preview',
    updateStatus: 'Update status',
    telemetryStatus: 'Telemetry status',
    governanceTitle: 'Governance',
    governanceBody:
      'Track build quality, CI health, and release readiness from this dashboard.',
  } as const;

  readonly language = signal('en-US');
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
