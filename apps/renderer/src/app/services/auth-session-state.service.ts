import {
  InjectionToken,
  Injectable,
  inject,
  computed,
  signal,
} from '@angular/core';
import type {
  AuthGetTokenDiagnosticsResponse,
  AuthSessionSummary,
  DesktopResult,
} from '@electron-foundation/contracts';
import { getDesktopApi } from '@electron-foundation/desktop-api';

const MAX_INITIALIZATION_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 100;
const RETRY_BACKOFF_MULTIPLIER = 1.5;

type AuthBridge = {
  auth: {
    getSessionSummary: () => Promise<DesktopResult<AuthSessionSummary>>;
    getTokenDiagnostics: () => Promise<
      DesktopResult<AuthGetTokenDiagnosticsResponse>
    >;
  };
};

export const AUTH_BRIDGE_PROVIDER = new InjectionToken<() => AuthBridge | null>(
  'AUTH_BRIDGE_PROVIDER',
  { factory: () => getDesktopApi },
);

@Injectable({ providedIn: 'root' })
export class AuthSessionStateService {
  readonly initialized = signal(false);
  readonly refreshPending = signal(false);
  readonly summary = signal<AuthSessionSummary | null>(null);
  readonly tokenDiagnostics = signal<AuthGetTokenDiagnosticsResponse | null>(
    null,
  );
  readonly isActive = computed(() => this.summary()?.state === 'active');
  readonly initializationError = signal<string | null>(null);

  private initializationPromise: Promise<void> | null = null;

  private readonly bridgeProvider = inject(AUTH_BRIDGE_PROVIDER);

  async ensureInitialized(includeTokenDiagnostics = false): Promise<void> {
    if (this.initialized()) {
      return;
    }

    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeWithRetry(
        includeTokenDiagnostics,
      ).finally(() => {
        this.initializationPromise = null;
      });
    }

    return this.initializationPromise;
  }

  async refreshSummary(
    includeTokenDiagnostics = false,
  ): Promise<DesktopResult<AuthSessionSummary>> {
    const desktop = this.bridgeProvider();
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

  reset(): void {
    this.initialized.set(false);
    this.refreshPending.set(false);
    this.summary.set(null);
    this.tokenDiagnostics.set(null);
    this.initializationError.set(null);
    this.initializationPromise = null;
  }

  private async initializeWithRetry(
    includeTokenDiagnostics: boolean,
  ): Promise<void> {
    for (let attempt = 1; attempt <= MAX_INITIALIZATION_ATTEMPTS; attempt++) {
      try {
        const result = await this.refreshSummary(includeTokenDiagnostics);

        if (
          result.ok ||
          !result.error.retryable ||
          attempt === MAX_INITIALIZATION_ATTEMPTS
        ) {
          this.initialized.set(true);
          this.initializationError.set(result.ok ? null : result.error.message);
          return;
        }
      } catch (error) {
        if (attempt === MAX_INITIALIZATION_ATTEMPTS) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.initializationError.set(
            `Initialization failed after ${MAX_INITIALIZATION_ATTEMPTS} attempts: ${message}`,
          );
          throw error;
        }
      }

      await this.waitForRetryDelay(attempt);
    }
  }

  private waitForRetryDelay(attempt: number): Promise<void> {
    const delayMs = Math.floor(
      BASE_RETRY_DELAY_MS * RETRY_BACKOFF_MULTIPLIER ** (attempt - 1),
    );
    this.initializationError.set(
      `Attempt ${attempt} failed; retrying in ${delayMs}ms`,
    );
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
