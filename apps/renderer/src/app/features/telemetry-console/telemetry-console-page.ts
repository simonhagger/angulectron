import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { getDesktopApi } from '@electron-foundation/desktop-api';

type TelemetryLogItem = {
  timestamp: string;
  eventName: string;
  status: string;
};

@Component({
  selector: 'app-telemetry-console-page',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './telemetry-console-page.html',
  styleUrl: './telemetry-console-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TelemetryConsolePage {
  readonly desktopAvailable = signal(!!getDesktopApi());
  readonly eventName = signal('demo.user-action');
  readonly propertiesText = signal(
    '{\n  "surface": "telemetry-console",\n  "version": 1\n}',
  );
  readonly status = signal('Idle.');
  readonly logs = signal<TelemetryLogItem[]>([]);

  async trackEvent() {
    const desktop = getDesktopApi();
    const eventName = this.eventName().trim();

    if (!eventName) {
      this.status.set('Event name is required.');
      return;
    }

    if (!desktop) {
      this.status.set('Desktop bridge unavailable in browser mode.');
      this.appendLog(eventName, 'bridge-unavailable');
      return;
    }

    const properties = this.parseProperties(this.propertiesText());
    if (properties === 'invalid') {
      this.status.set(
        'Properties must be a JSON object with primitive values.',
      );
      return;
    }

    const result = await desktop.telemetry.track(eventName, properties);
    if (!result.ok) {
      this.status.set(result.error.message);
      this.appendLog(eventName, 'failed');
      return;
    }

    this.status.set('Event accepted.');
    this.appendLog(eventName, 'accepted');
  }

  clearLog() {
    this.logs.set([]);
    this.status.set('Log cleared.');
  }

  private appendLog(eventName: string, status: string) {
    const next: TelemetryLogItem = {
      timestamp: new Date().toISOString(),
      eventName,
      status,
    };
    this.logs.update((current) => [next, ...current].slice(0, 25));
  }

  private parseProperties(
    text: string,
  ): Record<string, string | number | boolean> | undefined | 'invalid' {
    const trimmed = text.trim();
    if (!trimmed) {
      return undefined;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return 'invalid';
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return 'invalid';
    }

    const properties: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        properties[key] = value;
        continue;
      }

      return 'invalid';
    }

    return properties;
  }
}
