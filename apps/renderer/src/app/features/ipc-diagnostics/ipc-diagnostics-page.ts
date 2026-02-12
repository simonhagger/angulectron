import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { getDesktopApi } from '@electron-foundation/desktop-api';

type ProbeResult = {
  name: string;
  ok: boolean;
  detail: string;
  durationMs: number;
};

@Component({
  selector: 'app-ipc-diagnostics-page',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './ipc-diagnostics-page.html',
  styleUrl: './ipc-diagnostics-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IpcDiagnosticsPage {
  readonly desktopAvailable = signal(!!getDesktopApi());
  readonly status = signal('Idle.');
  readonly probes = signal<ProbeResult[]>([]);

  async runDiagnostics() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.status.set('Desktop bridge unavailable in browser mode.');
      this.probes.set([]);
      return;
    }

    this.status.set('Running diagnostics...');
    const results: ProbeResult[] = [];

    results.push(
      await this.probe('App Version', async () => {
        const response = await desktop.app.getVersion();
        return response.ok
          ? { ok: true, detail: response.data }
          : { ok: false, detail: response.error.message };
      }),
    );

    results.push(
      await this.probe('Contract Version', async () => {
        const response = await desktop.app.getContractVersion();
        return response.ok
          ? { ok: true, detail: response.data }
          : { ok: false, detail: response.error.message };
      }),
    );

    results.push(
      await this.probe('Updates Channel', async () => {
        const response = await desktop.updates.check();
        if (!response.ok) {
          return { ok: false, detail: response.error.message };
        }

        const status = response.data.status;
        const detail = response.data.message ?? status;

        if (
          status === 'error' &&
          detail.includes('not configured for this build')
        ) {
          return { ok: true, detail };
        }

        return {
          ok: status !== 'error',
          detail,
        };
      }),
    );

    results.push(
      await this.probe('Auth Session Channel', async () => {
        const response = await desktop.auth.getSessionSummary();
        return response.ok
          ? { ok: true, detail: response.data.state }
          : { ok: false, detail: response.error.message };
      }),
    );

    this.probes.set(results);
    const failed = results.some((result) => !result.ok);
    this.status.set(
      failed ? 'Diagnostics completed with failures.' : 'Diagnostics passed.',
    );
  }

  private async probe(
    name: string,
    fn: () => Promise<{ ok: boolean; detail: string }>,
  ): Promise<ProbeResult> {
    const started = performance.now();
    try {
      const result = await fn();
      return {
        name,
        ok: result.ok,
        detail: result.detail,
        durationMs: Math.round((performance.now() - started) * 10) / 10,
      };
    } catch (error) {
      return {
        name,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
        durationMs: Math.round((performance.now() - started) * 10) / 10,
      };
    }
  }
}
