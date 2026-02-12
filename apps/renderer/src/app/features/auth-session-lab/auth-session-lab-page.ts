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
  AuthSessionSummary,
} from '@electron-foundation/contracts';
import { getDesktopApi } from '@electron-foundation/desktop-api';

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
  readonly showTokenDiagnostics = signal(isDevMode());
  readonly desktopAvailable = signal(!!getDesktopApi());
  readonly signInPending = signal(false);
  readonly refreshPending = signal(false);
  readonly signOutPending = signal(false);
  readonly statusText = signal('Idle.');
  readonly statusTone = signal<StatusTone>('info');
  readonly summary = signal<AuthSessionSummary | null>(null);
  readonly tokenDiagnostics = signal<AuthGetTokenDiagnosticsResponse | null>(
    null,
  );
  readonly tokenDiagnosticsJson = computed(() => {
    const diagnostics = this.tokenDiagnostics();
    if (!diagnostics) {
      return '';
    }

    return JSON.stringify(diagnostics, null, 2);
  });
  readonly isActive = computed(() => this.summary()?.state === 'active');
  readonly returnUrl = signal('/');
  readonly scopes = computed(() => this.summary()?.scopes ?? []);
  readonly entitlements = computed(() => this.summary()?.entitlements ?? []);

  constructor() {
    const queryReturnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.returnUrl.set(this.toSafeInternalUrl(queryReturnUrl));
  }

  async refreshSummary() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.statusText.set('Desktop bridge unavailable in browser mode.');
      this.statusTone.set('warn');
      return;
    }

    this.refreshPending.set(true);
    try {
      const [summaryResult, diagnosticsResult] = await Promise.all([
        desktop.auth.getSessionSummary(),
        this.showTokenDiagnostics()
          ? desktop.auth.getTokenDiagnostics()
          : Promise.resolve(null),
      ]);
      if (!summaryResult.ok) {
        this.statusText.set(summaryResult.error.message);
        this.statusTone.set('error');
        return;
      }

      this.summary.set(summaryResult.data);
      if (diagnosticsResult && diagnosticsResult.ok) {
        this.tokenDiagnostics.set(diagnosticsResult.data);
      } else {
        this.tokenDiagnostics.set(null);
      }
      this.statusText.set(`Session state: ${summaryResult.data.state}`);
      this.statusTone.set(
        summaryResult.data.state === 'active' ? 'success' : 'info',
      );
    } finally {
      this.refreshPending.set(false);
    }
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
    let uiPendingReleased = false;
    const releaseUiPending = () => {
      if (uiPendingReleased) {
        return;
      }
      uiPendingReleased = true;
      this.signInPending.set(false);
    };
    const uiTimeoutHandle = setTimeout(() => {
      releaseUiPending();
      this.statusText.set(
        'Continue sign-in in the browser window. You can retry now or refresh summary after completion.',
      );
      this.statusTone.set('info');
    }, signInUiPendingMaxMs);

    try {
      const result = await desktop.auth.signIn();
      clearTimeout(uiTimeoutHandle);
      if (!result.ok) {
        this.statusText.set(result.error.message);
        this.statusTone.set('error');
        return;
      }

      this.statusText.set(
        result.data.initiated
          ? 'Sign-in completed.'
          : 'Session is already active.',
      );
      this.statusTone.set(result.data.initiated ? 'success' : 'info');
      await this.refreshSummary();
      if (this.isActive()) {
        await this.router.navigateByUrl(this.returnUrl());
      }
    } finally {
      clearTimeout(uiTimeoutHandle);
      releaseUiPending();
    }
  }

  async signOut() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.statusText.set('Desktop bridge unavailable in browser mode.');
      this.statusTone.set('warn');
      return;
    }

    this.signOutPending.set(true);
    try {
      const result = await desktop.auth.signOut();
      if (!result.ok) {
        this.statusText.set(result.error.message);
        this.statusTone.set('error');
        return;
      }

      this.statusText.set('Signed out.');
      this.statusTone.set('info');
      await this.refreshSummary();
    } finally {
      this.signOutPending.set(false);
    }
  }

  private toSafeInternalUrl(url: string | null): string {
    if (!url || !url.startsWith('/')) {
      return '/';
    }

    if (url.startsWith('//') || /[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) {
      return '/';
    }

    return url;
  }
}
