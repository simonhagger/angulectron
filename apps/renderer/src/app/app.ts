import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { distinctUntilChanged, map } from 'rxjs';
import { getDesktopApi } from '@electron-foundation/desktop-api';
import { AuthSessionStateService } from './services/auth-session-state.service';
import { APP_SHELL_CONFIG } from './app-shell.config';

const LABS_MODE_STORAGE_KEY = 'angulectron.labsMode';
type NavLink = {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
  lab?: boolean;
};

@Component({
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatListModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authSessionState = inject(AuthSessionStateService);
  private readonly navLinks: ReadonlyArray<NavLink> = APP_SHELL_CONFIG.navLinks;
  protected readonly title = 'Angulectron';
  protected readonly navOpen = signal(true);
  protected readonly mobileViewport = signal(false);
  protected readonly labsMode = signal(false);
  protected readonly labsModeLocked = signal(false);
  protected readonly labsFeatureEnabled = APP_SHELL_CONFIG.labsFeatureEnabled;
  protected readonly labsToggleLabel = APP_SHELL_CONFIG.labsToggleLabel;
  protected readonly labsToggleOnLabel = APP_SHELL_CONFIG.labsToggleOnLabel;
  protected readonly labsToggleOffLabel = APP_SHELL_CONFIG.labsToggleOffLabel;
  protected readonly visibleNavLinks = computed(() =>
    this.navLinks.filter((item) => this.labsMode() || !item.lab),
  );

  constructor() {
    void this.initializeLabsModePolicy();
    void this.authSessionState.ensureInitialized();

    this.breakpointObserver
      .observe('(max-width: 1023px)')
      .pipe(
        map((state) => state.matches),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((isMobile) => {
        this.mobileViewport.set(isMobile);
        this.navOpen.set(!isMobile);
      });
  }

  protected toggleNav() {
    this.navOpen.update((open) => !open);
  }

  protected closeNavForMobile() {
    if (this.mobileViewport()) {
      this.navOpen.set(false);
    }
  }

  protected handleNavListClick(event: Event) {
    if (!this.mobileViewport()) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest('a[mat-list-item]')) {
      this.navOpen.set(false);
    }
  }

  protected toggleLabsMode() {
    if (this.labsModeLocked()) {
      return;
    }

    this.labsMode.update((value) => {
      const next = !value;
      this.persistLabsModePreference(next);
      return next;
    });
  }

  private async initializeLabsModePolicy() {
    if (!this.labsFeatureEnabled) {
      this.labsModeLocked.set(true);
      this.labsMode.set(false);
      this.persistLabsModePreference(false);
      return;
    }

    const desktop = getDesktopApi();
    if (!desktop) {
      this.labsMode.set(this.loadLabsModePreference());
      return;
    }

    const runtime = await desktop.app.getRuntimeVersions();
    if (!runtime.ok) {
      this.labsMode.set(this.loadLabsModePreference());
      return;
    }

    const forcedLabsMode = runtime.data.appEnvironment !== 'production';
    this.labsModeLocked.set(true);
    this.labsMode.set(forcedLabsMode);
    this.persistLabsModePreference(forcedLabsMode);
  }

  private loadLabsModePreference(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }

    return localStorage.getItem(LABS_MODE_STORAGE_KEY) === '1';
  }

  private persistLabsModePreference(enabled: boolean) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(LABS_MODE_STORAGE_KEY, enabled ? '1' : '0');
  }
}
