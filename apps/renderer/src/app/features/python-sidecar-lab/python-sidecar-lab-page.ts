import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { getDesktopApi } from '@electron-foundation/desktop-api';

@Component({
  selector: 'app-python-sidecar-lab-page',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './python-sidecar-lab-page.html',
  styleUrl: './python-sidecar-lab-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PythonSidecarLabPage {
  readonly desktopAvailable = signal(!!getDesktopApi());
  readonly status = signal('Idle.');
  readonly running = signal(false);
  readonly started = signal(false);
  readonly endpoint = signal('http://127.0.0.1:43124/health');
  readonly pid = signal('N/A');
  readonly pythonCommand = signal('N/A');
  readonly pythonVersion = signal('N/A');
  readonly pymupdfAvailable = signal('Unknown');
  readonly pymupdfVersion = signal('N/A');
  readonly rawDiagnostics = signal('');
  readonly selectedPdfName = signal('No file selected.');
  readonly selectedPdfToken = signal<string | null>(null);
  readonly inspectStatus = signal('Idle.');
  readonly inspectedFileSize = signal('N/A');
  readonly inspectedHeaderHex = signal('N/A');
  readonly inspectedAccepted = signal('N/A');

  async probeSidecar() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.status.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    this.status.set('Probing Python sidecar...');
    const result = await desktop.python.probe();
    if (!result.ok) {
      this.status.set(result.error.message);
      return;
    }

    const data = result.data;
    this.running.set(data.running);
    this.started.set(data.started);
    this.endpoint.set(data.endpoint);
    this.pid.set(data.pid ? String(data.pid) : 'N/A');
    this.pythonCommand.set(data.pythonCommand ?? 'N/A');
    this.pythonVersion.set(data.health?.pythonVersion ?? 'N/A');
    this.pymupdfAvailable.set(
      data.health ? String(data.health.pymupdfAvailable) : 'Unknown',
    );
    this.pymupdfVersion.set(data.health?.pymupdfVersion ?? 'N/A');
    this.rawDiagnostics.set(JSON.stringify(data, null, 2));
    this.status.set(
      data.message ??
        (data.running
          ? 'Python sidecar is running.'
          : 'Python sidecar is not running.'),
    );
  }

  async selectPdf() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.status.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    const result = await desktop.dialog.openFile({
      title: 'Select PDF for Python sidecar inspection',
      filters: [{ name: 'PDF files', extensions: ['pdf'] }],
    });

    if (!result.ok) {
      this.selectedPdfName.set(result.error.message);
      this.selectedPdfToken.set(null);
      return;
    }

    if (result.data.canceled || !result.data.fileToken) {
      this.selectedPdfName.set('No file selected.');
      this.selectedPdfToken.set(null);
      return;
    }

    this.selectedPdfName.set(result.data.fileName ?? 'Selected PDF');
    this.selectedPdfToken.set(result.data.fileToken);
  }

  async inspectSelectedPdf() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.inspectStatus.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    const fileToken = this.selectedPdfToken();
    if (!fileToken) {
      this.inspectStatus.set('Select a PDF first.');
      return;
    }

    this.inspectStatus.set('Inspecting PDF through Python sidecar...');
    const result = await desktop.python.inspectPdf(fileToken);
    if (!result.ok) {
      this.inspectStatus.set(result.error.message);
      return;
    }

    const data = result.data;
    this.inspectedAccepted.set(String(data.accepted));
    this.inspectedFileSize.set(String(data.fileSizeBytes));
    this.inspectedHeaderHex.set(data.headerHex);
    this.pythonVersion.set(data.pythonVersion);
    this.pymupdfAvailable.set(String(data.pymupdfAvailable));
    this.pymupdfVersion.set(data.pymupdfVersion ?? 'N/A');
    this.rawDiagnostics.set(JSON.stringify(data, null, 2));
    this.inspectStatus.set(data.message ?? 'PDF inspection completed.');
    this.selectedPdfToken.set(null);
  }

  async stopSidecar() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.status.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    this.status.set('Stopping Python sidecar...');
    const result = await desktop.python.stop();
    if (!result.ok) {
      this.status.set(result.error.message);
      return;
    }

    this.running.set(result.data.running);
    this.started.set(false);
    this.pid.set('N/A');
    this.status.set(result.data.message ?? 'Python sidecar stopped.');
  }
}
