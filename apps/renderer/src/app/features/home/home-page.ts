import {
  AfterViewInit,
  ChangeDetectionStrategy,
  computed,
  Component,
  DoCheck,
  OnDestroy,
  OnInit,
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
export class HomePage implements OnInit, AfterViewInit, DoCheck, OnDestroy {
  private readonly debugEnabled =
    typeof window !== 'undefined' && localStorage.getItem('debug.home') === '1';

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
    this.debug('constructor');
    void this.initializeDesktopMetadata();
  }

  ngOnInit(): void {
    this.debug('ngOnInit');
  }

  ngAfterViewInit(): void {
    this.debug('ngAfterViewInit');
  }

  ngDoCheck(): void {
    this.debug('ngDoCheck');
  }

  ngOnDestroy(): void {
    this.debug('ngOnDestroy');
  }

  setLanguage(language: 'en-US') {
    this.debug('setLanguage:start', { language });
    this.language.set(language);
    this.debug('setLanguage:done', { active: this.language() });
  }

  async openFile() {
    this.debug('openFile:start');
    const desktop = getDesktopApi();
    if (!desktop) {
      this.debug('openFile:no-desktop');
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
      this.debug('openFile:cancelled', { ok: fileDialogResult.ok });
      this.fileResult.set('No file selected.');
      return;
    }

    const readResult = await desktop.fs.readTextFile(
      fileDialogResult.data.fileToken,
    );

    if (!readResult.ok) {
      this.debug('openFile:read-error', { error: readResult.error.message });
      this.fileResult.set(readResult.error.message);
      return;
    }

    this.fileResult.set(readResult.data.slice(0, 140));
    this.debug('openFile:done');
  }

  async checkUpdates() {
    this.debug('checkUpdates:start');
    const desktop = getDesktopApi();
    if (!desktop) {
      this.debug('checkUpdates:no-desktop');
      this.updateResult.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    const result = await desktop.updates.check();

    if (!result.ok) {
      this.debug('checkUpdates:error', { error: result.error.message });
      this.updateResult.set(result.error.message);
      return;
    }

    this.updateResult.set(result.data.message ?? result.data.status);
    this.debug('checkUpdates:done', { status: result.data.status });
  }

  async trackTelemetry() {
    this.debug('trackTelemetry:start');
    const desktop = getDesktopApi();
    if (!desktop) {
      this.debug('trackTelemetry:no-desktop');
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
    this.debug('trackTelemetry:done', { ok: result.ok });
  }

  private async initializeDesktopMetadata() {
    this.debug('initializeDesktopMetadata:start');
    const desktop = getDesktopApi();

    if (!desktop) {
      this.debug('initializeDesktopMetadata:no-desktop');
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
    this.debug('initializeDesktopMetadata:done', {
      appVersion: this.appVersion(),
      contractVersion: this.contractVersion(),
    });
  }

  private debug(event: string, detail?: unknown): void {
    if (!this.debugEnabled || typeof window === 'undefined') {
      return;
    }
    const payload = {
      ts: new Date().toISOString(),
      event,
      detail,
    };
    const traceTarget = window as unknown as {
      __homeTrace?: Array<unknown>;
    };
    if (!Array.isArray(traceTarget.__homeTrace)) {
      traceTarget.__homeTrace = [];
    }
    traceTarget.__homeTrace.push(payload);
    // eslint-disable-next-line no-console
    console.debug('[home-debug]', payload);
  }
}
