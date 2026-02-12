import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
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
  protected readonly title = 'Angulectron';
  protected readonly navOpen = signal(true);
  protected readonly mobileViewport = signal(false);

  constructor() {
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
}
