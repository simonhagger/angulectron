import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

type FailureClass = 'offline' | 'timeout' | 'auth' | 'server';

@Component({
  selector: 'app-offline-retry-simulator-page',
  imports: [
    CommonModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
  ],
  templateUrl: './offline-retry-simulator-page.html',
  styleUrl: './offline-retry-simulator-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfflineRetrySimulatorPage {
  readonly selectedClass = signal<FailureClass>('offline');
  readonly status = signal('Idle.');
  readonly retryCount = signal(0);
  readonly busy = signal(false);
  readonly timeline = signal<string[]>([]);

  readonly classes: FailureClass[] = ['offline', 'timeout', 'auth', 'server'];

  setClass(value: string) {
    if (
      value === 'offline' ||
      value === 'timeout' ||
      value === 'auth' ||
      value === 'server'
    ) {
      this.selectedClass.set(value);
    }
  }

  async simulate() {
    if (this.busy()) {
      return;
    }

    this.busy.set(true);
    this.retryCount.set(0);
    this.timeline.set([]);
    this.push(`Start request with error class: ${this.selectedClass()}`);

    const retryable =
      this.selectedClass() === 'offline' ||
      this.selectedClass() === 'timeout' ||
      this.selectedClass() === 'server';
    const maxAttempts = retryable ? 3 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      this.retryCount.set(attempt - 1);
      this.push(`Attempt ${attempt}/${maxAttempts}`);
      await this.delay(450);

      if (attempt === maxAttempts) {
        this.status.set(this.messageFor(this.selectedClass()));
        this.push(`Final result: ${this.status()}`);
        break;
      }

      this.push('Retry scheduled (backoff + jitter simulation).');
      await this.delay(350 + attempt * 180);
    }

    this.busy.set(false);
  }

  clearTimeline() {
    this.timeline.set([]);
    this.status.set('Idle.');
    this.retryCount.set(0);
  }

  private messageFor(kind: FailureClass): string {
    if (kind === 'offline') {
      return 'OFFLINE: show reconnect banner and retry action.';
    }
    if (kind === 'timeout') {
      return 'TIMEOUT: request timed out, suggest retry.';
    }
    if (kind === 'auth') {
      return 'AUTH: do not retry automatically, request sign-in.';
    }
    return 'SERVER: transient error, retry budget exhausted.';
  }

  private push(entry: string) {
    this.timeline.update((lines) => [
      ...lines,
      `${new Date().toLocaleTimeString()} - ${entry}`,
    ]);
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
