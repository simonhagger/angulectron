import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import type { AuthSessionSummary } from '@electron-foundation/contracts';
import { getDesktopApi } from '@electron-foundation/desktop-api';

type StatusTone = 'info' | 'success' | 'warn' | 'error';

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
  readonly desktopAvailable = signal(!!getDesktopApi());
  readonly signInPending = signal(false);
  readonly refreshPending = signal(false);
  readonly signOutPending = signal(false);
  readonly statusText = signal('Idle.');
  readonly statusTone = signal<StatusTone>('info');
  readonly summary = signal<AuthSessionSummary | null>(null);
  readonly isActive = computed(() => this.summary()?.state === 'active');
  readonly scopes = computed(() => this.summary()?.scopes ?? []);
  readonly entitlements = computed(() => this.summary()?.entitlements ?? []);

  async refreshSummary() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.statusText.set('Desktop bridge unavailable in browser mode.');
      this.statusTone.set('warn');
      return;
    }

    this.refreshPending.set(true);
    try {
      const result = await desktop.auth.getSessionSummary();
      if (!result.ok) {
        this.statusText.set(result.error.message);
        this.statusTone.set('error');
        return;
      }

      this.summary.set(result.data);
      this.statusText.set(`Session state: ${result.data.state}`);
      this.statusTone.set(result.data.state === 'active' ? 'success' : 'info');
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

    this.signInPending.set(true);
    try {
      const result = await desktop.auth.signIn();
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
    } finally {
      this.signInPending.set(false);
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
}
