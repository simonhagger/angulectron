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
  type ApiGetOperationDiagnosticsResponse,
  type ApiOperationId,
  type AuthGetTokenDiagnosticsResponse,
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
  readonly operation = signal<ApiOperationId>('call.secure-endpoint');
  readonly paramsText = signal('{\n}');
  readonly headersText = signal('{\n  "x-client-trace": "api-playground"\n}');
  readonly requestState = signal('Idle.');
  readonly requestPending = signal(false);
  readonly responseStatus = signal<number | null>(null);
  readonly responseBody = signal('');
  readonly resolvedRequestPath = signal('');
  readonly diagnosticsPending = signal(false);
  readonly diagnosticsState = signal('Diagnostics not loaded.');
  readonly operationDiagnostics =
    signal<ApiGetOperationDiagnosticsResponse | null>(null);
  readonly tokenDiagnostics = signal<AuthGetTokenDiagnosticsResponse | null>(
    null,
  );
  readonly operationDiagnosticsBody = signal('');
  readonly tokenDiagnosticsBody = signal('');

  constructor() {
    void this.refreshDiagnostics();
  }

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

    const parsedHeaders = this.parseHeaders(this.headersText());
    if (parsedHeaders === 'invalid') {
      this.requestState.set(
        'Headers must be a JSON object with x-* string header values.',
      );
      return;
    }

    this.requestState.set('Calling operation...');
    this.requestPending.set(true);
    this.responseStatus.set(null);
    this.responseBody.set('');
    this.resolvedRequestPath.set('');

    try {
      const response = await desktop.api.invoke(
        this.operation(),
        parsedParams,
        {
          headers: parsedHeaders,
        },
      );
      if (!response.ok) {
        this.requestState.set(response.error.message);
        this.responseBody.set(this.pretty(response.error.details ?? {}));
        const requestUrl = (response.error.details as { requestUrl?: unknown })
          ?.requestUrl;
        if (typeof requestUrl === 'string') {
          try {
            const parsed = new URL(requestUrl);
            this.resolvedRequestPath.set(`${parsed.pathname}${parsed.search}`);
          } catch {
            this.resolvedRequestPath.set('');
          }
        }
        return;
      }

      this.requestState.set('Request completed.');
      this.responseStatus.set(response.data.status);
      this.resolvedRequestPath.set(response.data.requestPath ?? '');
      this.responseBody.set(this.pretty(response.data.data));
    } finally {
      this.requestPending.set(false);
    }
  }

  async refreshDiagnostics() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.diagnosticsState.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    this.diagnosticsPending.set(true);
    try {
      const [operationResult, tokenResult] = await Promise.all([
        desktop.api.getOperationDiagnostics(this.operation()),
        desktop.auth.getTokenDiagnostics(),
      ]);

      if (!operationResult.ok) {
        this.diagnosticsState.set(operationResult.error.message);
        this.operationDiagnostics.set(null);
        this.operationDiagnosticsBody.set('');
      } else {
        this.operationDiagnostics.set(operationResult.data);
        this.operationDiagnosticsBody.set(this.pretty(operationResult.data));
      }

      if (!tokenResult.ok) {
        this.tokenDiagnostics.set(null);
        this.tokenDiagnosticsBody.set('');
      } else {
        this.tokenDiagnostics.set(tokenResult.data);
        this.tokenDiagnosticsBody.set(this.pretty(tokenResult.data));
      }

      this.diagnosticsState.set('Diagnostics refreshed.');
    } finally {
      this.diagnosticsPending.set(false);
    }
  }

  async onOperationChange(operationId: ApiOperationId) {
    this.operation.set(operationId);
    await this.refreshDiagnostics();
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

  private parseHeaders(
    text: string,
  ): Record<string, string> | undefined | 'invalid' {
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

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!/^x-[a-z0-9-]+$/i.test(key) || typeof value !== 'string') {
        return 'invalid';
      }

      result[key] = value;
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
