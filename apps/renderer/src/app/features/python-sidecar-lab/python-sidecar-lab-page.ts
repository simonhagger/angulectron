import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
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
  private readonly destroyRef = inject(DestroyRef);

  readonly signalCanvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('signalCanvas');

  readonly desktopAvailable = signal(!!getDesktopApi());
  readonly status = signal('Idle.');
  readonly running = signal(false);
  readonly started = signal(false);
  readonly endpoint = signal('http://127.0.0.1:43124/health');
  readonly pid = signal('N/A');
  readonly pythonCommand = signal('N/A');
  readonly pythonVersion = signal('N/A');
  readonly pythonExecutable = signal('N/A');
  readonly pymupdfAvailable = signal('Unknown');
  readonly pymupdfVersion = signal('N/A');
  readonly rawDiagnostics = signal('');
  readonly selectedPdfName = signal('No file selected.');
  readonly selectedPdfToken = signal<string | null>(null);
  readonly inspectStatus = signal('Idle.');
  readonly inspectedFileSize = signal('N/A');
  readonly inspectedHeaderHex = signal('N/A');
  readonly inspectedAccepted = signal('N/A');
  readonly streaming = signal(false);
  readonly streamStatus = signal('Stream idle.');

  private streamTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopStreaming());
  }

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
    this.pythonExecutable.set(data.health?.pythonExecutable ?? 'N/A');
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
    this.pythonExecutable.set(data.pythonExecutable ?? 'N/A');
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

  toggleStreaming() {
    if (this.streaming()) {
      this.stopStreaming();
      return;
    }

    const ctx = this.signalCanvas().nativeElement.getContext('2d');
    if (!ctx) {
      this.streamStatus.set('Canvas unavailable.');
      return;
    }

    this.streaming.set(true);
    this.streamStatus.set('Streaming waveform from Python sidecar…');
    void this.pollWaveform();
    this.streamTimer = setInterval(() => void this.pollWaveform(), 150);
  }

  stopStreaming() {
    if (this.streamTimer !== null) {
      clearInterval(this.streamTimer);
      this.streamTimer = null;
    }
    if (this.streaming()) {
      this.streaming.set(false);
      this.streamStatus.set('Stream stopped.');
    }
  }

  private async pollWaveform() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.stopStreaming();
      return;
    }

    const startedAt = performance.now();
    const result = await desktop.python.waveform(256);
    if (!result.ok) {
      this.streamStatus.set(`Stream error: ${result.error.message}`);
      this.stopStreaming();
      return;
    }

    const latencyMs = Math.round(performance.now() - startedAt);
    this.drawSignal(result.data.samples, result.data.spectrum);
    this.streamStatus.set(
      `${result.data.samples.length} samples · ${result.data.spectrum.length} bins · ${latencyMs} ms round-trip`,
    );
  }

  private drawSignal(samples: number[], spectrum: number[]) {
    const canvas = this.signalCanvas().nativeElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.fillStyle = '#080b12';
    ctx.fillRect(0, 0, width, height);

    const traceHeight = height * 0.58;
    const baseline = traceHeight / 2;

    ctx.strokeStyle = '#1d2635';
    ctx.beginPath();
    ctx.moveTo(0, baseline);
    ctx.lineTo(width, baseline);
    ctx.stroke();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.max(1.25, 1.5 * dpr);
    ctx.beginPath();
    samples.forEach((sample, index) => {
      const x = (index / (samples.length - 1 || 1)) * width;
      const y = baseline - sample * baseline * 0.9;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    const spectrumTop = traceHeight + height * 0.06;
    const spectrumHeight = height - spectrumTop - 4;
    const binWidth = width / spectrum.length;
    ctx.fillStyle = '#2dd4bf';
    spectrum.forEach((magnitude, index) => {
      const barHeight = Math.min(1, magnitude * 8) * spectrumHeight;
      ctx.fillRect(
        index * binWidth + binWidth * 0.15,
        height - 4 - barHeight,
        binWidth * 0.7,
        barHeight,
      );
    });
  }
}
