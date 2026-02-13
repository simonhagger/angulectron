import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import type {
  AuthGetTokenDiagnosticsResponse,
  AuthSignOutMode,
  AuthSessionSummary,
} from '@electron-foundation/contracts';
import { getDesktopApi } from '@electron-foundation/desktop-api';
import { AuthSessionStateService } from '../../services/auth-session-state.service';

type StatusTone = 'info' | 'success' | 'warn' | 'error';
const signInUiPendingMaxMs = 2_000;

@Component({
  selector: 'app-auth-session-lab-page',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
  ],
  templateUrl: './auth-session-lab-page.html',
  styleUrl: './auth-session-lab-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthSessionLabPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authSessionState = inject(AuthSessionStateService);
  readonly showTokenDiagnostics = signal(isDevMode());
  readonly desktopAvailable = signal(!!getDesktopApi());
  readonly sessionInitialized = this.authSessionState.initialized;
  readonly signInPending = signal(false);
  readonly browserFlowPending = signal(false);
  readonly refreshPending = this.authSessionState.refreshPending;
  readonly signOutPending = signal(false);
  readonly statusText = signal('Idle.');
  readonly statusTone = signal<StatusTone>('info');
  readonly summary = this.authSessionState.summary;
  readonly tokenDiagnostics = this.authSessionState.tokenDiagnostics;
  readonly tokenDiagnosticsJson = computed(() => {
    const diagnostics = this.tokenDiagnostics();
    if (!diagnostics) {
      return '';
    }

    return JSON.stringify(diagnostics, null, 2);
  });
  readonly isActive = this.authSessionState.isActive;
  readonly returnUrl = signal<string | null>(null);
  readonly scopes = computed(() => this.summary()?.scopes ?? []);
  readonly entitlements = computed(() => this.summary()?.entitlements ?? []);

  constructor() {
    const queryReturnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.returnUrl.set(this.toSafeInternalUrl(queryReturnUrl));
    this.statusText.set('Loading session state...');
    void this.initializeSessionState();
  }

  async refreshSummary() {
    const result = await this.authSessionState.refreshSummary(
      this.showTokenDiagnostics(),
    );
    if (!result.ok) {
      this.statusText.set(result.error.message);
      this.statusTone.set(
        result.error.code === 'DESKTOP/UNAVAILABLE' ? 'warn' : 'error',
      );
      return;
    }

    this.applySummaryStatus(result.data.state);
  }

  async signIn() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.statusText.set('Desktop bridge unavailable in browser mode.');
      this.statusTone.set('warn');
      return;
    }

    if (this.isActive()) {
      this.statusText.set('Session is already active.');
      this.statusTone.set('info');
      return;
    }

    if (this.signInPending()) {
      this.statusText.set(
        'Sign-in is already in progress. Complete it in the browser window or retry shortly.',
      );
      this.statusTone.set('info');
      return;
    }

    this.signInPending.set(true);
    this.browserFlowPending.set(false);
    this.statusText.set(
      'Sign-in started. Continue in your browser window, then return to the app.',
    );
    this.statusTone.set('info');
    const uiTimeoutHandle = setTimeout(() => {
      this.signInPending.set(false);
      this.browserFlowPending.set(true);
      this.statusText.set(
        'Browser sign-in is still in progress. If you cancelled in browser, choose "I cancelled sign-in" and retry.',
      );
      this.statusTone.set('info');
    }, signInUiPendingMaxMs);

    try {
      const result = await desktop.auth.signIn();
      clearTimeout(uiTimeoutHandle);
      if (!result.ok) {
        if (result.error.code === 'AUTH/SIGNIN_IN_PROGRESS') {
          this.browserFlowPending.set(true);
          this.statusText.set(
            'A sign-in flow is already in progress in browser. Complete or cancel it, then retry.',
          );
          this.statusTone.set('info');
        } else {
          this.statusText.set(result.error.message);
          this.statusTone.set('error');
        }
        return;
      }

      this.browserFlowPending.set(false);
      this.statusText.set(
        result.data.initiated
          ? 'Sign-in completed.'
          : 'Session is already active.',
      );
      this.statusTone.set(result.data.initiated ? 'success' : 'info');
      await this.refreshSummary();
      const returnUrl = this.returnUrl();
      if (this.isActive() && returnUrl) {
        await this.router.navigateByUrl(returnUrl);
      }
    } finally {
      clearTimeout(uiTimeoutHandle);
      this.signInPending.set(false);
    }
  }

  acknowledgeBrowserCancel() {
    this.browserFlowPending.set(false);
    this.statusText.set(
      'Browser sign-in marked as cancelled. You can retry sign-in.',
    );
    this.statusTone.set('info');
  }

  async signOutLocal() {
    await this.signOut('local');
  }

  async signOutGlobal() {
    await this.signOut('global');
  }

  private async signOut(mode: AuthSignOutMode) {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.statusText.set('Desktop bridge unavailable in browser mode.');
      this.statusTone.set('warn');
      return;
    }
    if (!this.isActive()) {
      this.statusText.set('No active session to sign out.');
      this.statusTone.set('info');
      return;
    }

    this.signOutPending.set(true);
    try {
      const result = await desktop.auth.signOut(mode);
      if (!result.ok) {
        this.statusText.set(result.error.message);
        this.statusTone.set('error');
        return;
      }

      const providerMessage =
        result.data.mode === 'global'
          ? result.data.endSessionSupported
            ? result.data.endSessionInitiated
              ? 'Provider end-session flow was launched in browser.'
              : 'Provider end-session flow was not launched.'
            : 'Provider does not advertise an end-session endpoint.'
          : 'Local session cleared.';
      const revokeMessage = result.data.revocationSupported
        ? result.data.refreshTokenPresent
          ? result.data.refreshTokenRevoked
            ? 'Refresh token was revoked.'
            : 'Refresh token revocation failed.'
          : 'No refresh token was present to revoke.'
        : 'Provider does not advertise a revocation endpoint.';
      this.statusText.set(`${providerMessage} ${revokeMessage}`);
      this.statusTone.set('info');
      await this.refreshSummary();
    } finally {
      this.signOutPending.set(false);
    }
  }

  private toSafeInternalUrl(url: string | null): string | null {
    if (!url || !url.startsWith('/')) {
      return null;
    }

    if (url.startsWith('//') || /[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) {
      return null;
    }

    if (url === '/auth-session-lab') {
      return null;
    }

    return url;
  }

  private async initializeSessionState() {
    await this.authSessionState.ensureInitialized(this.showTokenDiagnostics());
    const result = await this.authSessionState.refreshSummary(
      this.showTokenDiagnostics(),
    );
    if (!result.ok) {
      this.statusText.set(result.error.message);
      this.statusTone.set(
        result.error.code === 'DESKTOP/UNAVAILABLE' ? 'warn' : 'error',
      );
      return;
    }

    this.applySummaryStatus(result.data.state);
  }

  private applySummaryStatus(state: AuthSessionSummary['state']) {
    this.statusText.set(`Session state: ${state}`);
    this.statusTone.set(state === 'active' ? 'success' : 'info');
  }
}
