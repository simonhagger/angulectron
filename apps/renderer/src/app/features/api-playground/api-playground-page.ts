import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  API_OPERATION_IDS,
  type ApiOperationId,
} from '@electron-foundation/contracts';
import { getDesktopApi } from '@electron-foundation/desktop-api';
import type { JwtProtectedRouteComponent } from '../../guards/jwt-route.guards';

@Component({
  selector: 'app-api-playground-page',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './api-playground-page.html',
  styleUrl: './api-playground-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiPlaygroundPage implements JwtProtectedRouteComponent {
  readonly desktopAvailable = signal(!!getDesktopApi());
  readonly operations = API_OPERATION_IDS;
  readonly operation = signal<ApiOperationId>('portfolio.user');
  readonly paramsText = signal('{\n  "user_id": "me"\n}');
  readonly requestState = signal('Idle.');
  readonly requestPending = signal(false);
  readonly responseStatus = signal<number | null>(null);
  readonly responseBody = signal('');

  async invokeOperation() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.requestState.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    const parsedParams = this.parseParams(this.paramsText());
    if (parsedParams === 'invalid') {
      this.requestState.set(
        'Params must be a JSON object with primitive values.',
      );
      return;
    }

    this.requestState.set('Calling operation...');
    this.requestPending.set(true);
    this.responseStatus.set(null);
    this.responseBody.set('');

    try {
      const response = await desktop.api.invoke(this.operation(), parsedParams);
      if (!response.ok) {
        this.requestState.set(response.error.message);
        this.responseBody.set(this.pretty(response.error.details ?? {}));
        return;
      }

      this.requestState.set('Request completed.');
      this.responseStatus.set(response.data.status);
      this.responseBody.set(this.pretty(response.data.data));
    } finally {
      this.requestPending.set(false);
    }
  }

  canDeactivateJwt(): boolean {
    if (!this.requestPending()) {
      return true;
    }

    return window.confirm(
      'An API request is still in progress. Leave this page and cancel the current review?',
    );
  }

  private parseParams(
    text: string,
  ): Record<string, string | number | boolean | null> | undefined | 'invalid' {
    const trimmed = text.trim();
    if (!trimmed) {
      return undefined;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return 'invalid';
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return 'invalid';
    }

    const result: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
      ) {
        result[key] = value;
        continue;
      }

      return 'invalid';
    }

    return result;
  }

  private pretty(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
}
