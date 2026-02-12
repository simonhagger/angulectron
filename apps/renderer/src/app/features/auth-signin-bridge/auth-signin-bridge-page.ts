import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-auth-signin-bridge-page',
  templateUrl: './auth-signin-bridge-page.html',
  styleUrl: './auth-signin-bridge-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthSigninBridgePage {
  private readonly route = inject(ActivatedRoute);

  readonly message = signal('Preparing authentication redirect...');
  readonly error = signal<string | null>(null);

  constructor() {
    const redirectUrl = this.route.snapshot.queryParamMap.get('redirect_url');
    if (!redirectUrl) {
      this.error.set('Missing redirect_url query parameter.');
      this.message.set('Unable to continue sign-in.');
      return;
    }

    try {
      const parsed = new URL(redirectUrl);
      if (parsed.protocol !== 'https:') {
        throw new Error('Only HTTPS redirect URLs are allowed.');
      }

      const signInHost = parsed.hostname.endsWith('.clerk.accounts.dev')
        ? parsed.hostname.replace('.clerk.accounts.dev', '.accounts.dev')
        : parsed.hostname;
      const hostedSignInUrl = new URL(`https://${signInHost}/sign-in`);
      hostedSignInUrl.searchParams.set('redirect_url', parsed.toString());

      window.location.replace(hostedSignInUrl.toString());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
      this.message.set('Unable to continue sign-in.');
    }
  }
}
