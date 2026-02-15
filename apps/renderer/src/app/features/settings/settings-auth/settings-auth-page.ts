import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import type { AuthFeatureConfig } from '@electron-foundation/contracts';
import { RuntimeSettingsService } from '../runtime-settings.service';

@Component({
  selector: 'app-settings-auth-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatSelectModule,
  ],
  templateUrl: './settings-auth-page.html',
  styleUrl: './settings-auth-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAuthPage {
  protected readonly settings = inject(RuntimeSettingsService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.nonNullable.group({
    issuer: [''],
    clientId: [''],
    redirectUri: [''],
    scopes: ['openid profile email offline_access'],
    audience: [''],
    sendAudienceInAuthorize: [false],
    apiBearerTokenSource: ['access_token' as 'access_token' | 'id_token'],
    allowedSignOutOrigins: [''],
  });

  constructor() {
    effect(() => {
      const config = this.settings.authConfig();
      this.form.patchValue(
        {
          issuer: config.issuer ?? '',
          clientId: config.clientId ?? '',
          redirectUri: config.redirectUri ?? '',
          scopes: config.scopes ?? 'openid profile email offline_access',
          audience: config.audience ?? '',
          sendAudienceInAuthorize: config.sendAudienceInAuthorize ?? false,
          apiBearerTokenSource: config.apiBearerTokenSource ?? 'access_token',
          allowedSignOutOrigins: config.allowedSignOutOrigins ?? '',
        },
        { emitEvent: false },
      );
    });
  }

  protected async save() {
    const config: AuthFeatureConfig = {
      issuer: this.form.controls.issuer.value.trim() || undefined,
      clientId: this.form.controls.clientId.value.trim() || undefined,
      redirectUri: this.form.controls.redirectUri.value.trim() || undefined,
      scopes: this.form.controls.scopes.value.trim() || undefined,
      audience: this.form.controls.audience.value.trim() || undefined,
      sendAudienceInAuthorize: this.form.controls.sendAudienceInAuthorize.value,
      apiBearerTokenSource: this.form.controls.apiBearerTokenSource.value,
      allowedSignOutOrigins:
        this.form.controls.allowedSignOutOrigins.value.trim() || undefined,
    };

    await this.settings.saveAuthConfig(config);
  }
}
