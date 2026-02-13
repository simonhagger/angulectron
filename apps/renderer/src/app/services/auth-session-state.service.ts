import { Injectable, computed, signal } from '@angular/core';
import type {
  AuthGetTokenDiagnosticsResponse,
  AuthSessionSummary,
  DesktopResult,
} from '@electron-foundation/contracts';
import { getDesktopApi } from '@electron-foundation/desktop-api';

@Injectable({ providedIn: 'root' })
export class AuthSessionStateService {
  readonly initialized = signal(false);
  readonly refreshPending = signal(false);
  readonly summary = signal<AuthSessionSummary | null>(null);
  readonly tokenDiagnostics = signal<AuthGetTokenDiagnosticsResponse | null>(
    null,
  );
  readonly isActive = computed(() => this.summary()?.state === 'active');

  private initializationPromise: Promise<void> | null = null;

  async ensureInitialized(includeTokenDiagnostics = false): Promise<void> {
    if (this.initialized()) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.refreshSummary(includeTokenDiagnostics)
      .then(() => {
        this.initialized.set(true);
      })
      .finally(() => {
        this.initializationPromise = null;
      });

    return this.initializationPromise;
  }

  async refreshSummary(
    includeTokenDiagnostics = false,
  ): Promise<DesktopResult<AuthSessionSummary>> {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.summary.set(null);
      this.tokenDiagnostics.set(null);
      return {
        ok: false,
        error: {
          code: 'DESKTOP/UNAVAILABLE',
          message: 'Desktop bridge unavailable in browser mode.',
          retryable: false,
        },
      };
    }

    this.refreshPending.set(true);
    try {
      const summaryResult = await desktop.auth.getSessionSummary();

      if (!summaryResult.ok) {
        this.summary.set(null);
        this.tokenDiagnostics.set(null);
        return summaryResult;
      }

      this.summary.set(summaryResult.data);
      if (includeTokenDiagnostics) {
        const diagnosticsResult = await desktop.auth.getTokenDiagnostics();
        if (diagnosticsResult.ok) {
          this.tokenDiagnostics.set(diagnosticsResult.data);
        } else {
          this.tokenDiagnostics.set(null);
        }
      }

      return summaryResult;
    } finally {
      this.refreshPending.set(false);
    }
  }
}
