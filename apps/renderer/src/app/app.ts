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

type NavLink = {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
  lab?: boolean;
};

const LABS_MODE_STORAGE_KEY = 'angulectron.labsMode';

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
  private readonly navLinks: NavLink[] = [
    { path: '/', label: 'Home', icon: 'home', exact: true },
    {
      path: '/material-showcase',
      label: 'Material Showcase',
      icon: 'palette',
      lab: true,
    },
    {
      path: '/material-carbon-lab',
      label: 'Material Carbon Lab',
      icon: 'tune',
      lab: true,
    },
    {
      path: '/carbon-showcase',
      label: 'Carbon Showcase',
      icon: 'view_quilt',
      lab: true,
    },
    {
      path: '/tailwind-showcase',
      label: 'Tailwind Showcase',
      icon: 'waterfall_chart',
      lab: true,
    },
    {
      path: '/form-validation-lab',
      label: 'Form Validation Lab',
      icon: 'fact_check',
      lab: true,
    },
    {
      path: '/async-validation-lab',
      label: 'Async Validation Lab',
      icon: 'pending_actions',
      lab: true,
    },
    {
      path: '/data-table-workbench',
      label: 'Data Table Workbench',
      icon: 'table_chart',
      lab: true,
    },
    {
      path: '/theme-tokens-playground',
      label: 'Theme Tokens Playground',
      icon: 'format_paint',
      lab: true,
    },
    {
      path: '/offline-retry-simulator',
      label: 'Offline Retry Simulator',
      icon: 'wifi_off',
      lab: true,
    },
    {
      path: '/file-workflow-studio',
      label: 'File Workflow Studio',
      icon: 'schema',
      lab: true,
    },
    {
      path: '/storage-explorer',
      label: 'Storage Explorer',
      icon: 'storage',
      lab: true,
    },
    {
      path: '/api-playground',
      label: 'API Playground',
      icon: 'api',
      lab: true,
    },
    {
      path: '/updates-release',
      label: 'Updates & Release',
      icon: 'system_update',
      lab: true,
    },
    {
      path: '/telemetry-console',
      label: 'Telemetry Console',
      icon: 'analytics',
      lab: true,
    },
    {
      path: '/ipc-diagnostics',
      label: 'IPC Diagnostics',
      icon: 'cable',
      lab: true,
    },
    {
      path: '/auth-session-lab',
      label: 'Auth Session Lab',
      icon: 'badge',
      lab: true,
    },
    {
      path: '/file-tools',
      label: 'File Tools',
      icon: 'folder_open',
      lab: true,
    },
  ];
  protected readonly title = 'Angulectron';
  protected readonly navOpen = signal(true);
  protected readonly mobileViewport = signal(false);
  protected readonly labsMode = signal(false);
  protected readonly labsModeLocked = signal(false);
  protected readonly visibleNavLinks = computed(() =>
    this.navLinks.filter((item) => this.labsMode() || !item.lab),
  );

  constructor() {
    void this.initializeLabsModePolicy();

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
