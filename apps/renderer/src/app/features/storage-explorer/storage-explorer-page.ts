import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { getDesktopApi } from '@electron-foundation/desktop-api';

type StorageDomain = 'settings' | 'cache';
type StorageClassification = 'internal' | 'sensitive';

@Component({
  selector: 'app-storage-explorer-page',
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
  templateUrl: './storage-explorer-page.html',
  styleUrl: './storage-explorer-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorageExplorerPage {
  readonly desktopAvailable = signal(!!getDesktopApi());
  readonly domain = signal<StorageDomain>('settings');
  readonly key = signal('ui.sidebar.collapsed');
  readonly valueText = signal('{"collapsed": false}');
  readonly classification = signal<StorageClassification>('internal');
  readonly ttlSeconds = signal('');
  readonly result = signal('Ready.');
  readonly fetchedValue = signal('');

  async setItem() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.result.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    const key = this.key().trim();
    if (!key) {
      this.result.set('Key is required.');
      return;
    }

    const value = this.parseValue(this.valueText());
    const ttl = this.parseTtl(this.ttlSeconds());
    if (ttl === 'invalid') {
      this.result.set('TTL must be a positive whole number.');
      return;
    }

    const options =
      this.domain() === 'cache' && typeof ttl === 'number'
        ? { ttlSeconds: ttl }
        : undefined;

    const response = await desktop.storage.setItem(
      this.domain(),
      key,
      value,
      this.classification(),
      options,
    );

    if (!response.ok) {
      this.result.set(response.error.message);
      return;
    }

    this.result.set('Value saved.');
  }

  async getItem() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.result.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    const key = this.key().trim();
    if (!key) {
      this.result.set('Key is required.');
      return;
    }

    const response = await desktop.storage.getItem(this.domain(), key);
    if (!response.ok) {
      this.result.set(response.error.message);
      this.fetchedValue.set('');
      return;
    }

    if (!response.data.found) {
      this.result.set('No value found for key.');
      this.fetchedValue.set('');
      return;
    }

    this.result.set('Value loaded.');
    this.fetchedValue.set(this.pretty(response.data.value));
  }

  async deleteItem() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.result.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    const key = this.key().trim();
    if (!key) {
      this.result.set('Key is required.');
      return;
    }

    const response = await desktop.storage.deleteItem(this.domain(), key);
    if (!response.ok) {
      this.result.set(response.error.message);
      return;
    }

    this.result.set(
      response.data.deleted ? 'Value deleted.' : 'Key did not exist.',
    );
    this.fetchedValue.set('');
  }

  async clearDomain() {
    const desktop = getDesktopApi();
    if (!desktop) {
      this.result.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    const response = await desktop.storage.clearDomain(this.domain());
    if (!response.ok) {
      this.result.set(response.error.message);
      return;
    }

    this.result.set(
      `Cleared ${response.data.cleared} item(s) from ${this.domain()}.`,
    );
    this.fetchedValue.set('');
  }

  private parseValue(text: string): unknown {
    const value = text.trim();
    if (!value) {
      return '';
    }

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private parseTtl(raw: string): number | undefined | 'invalid' {
    const trimmed = raw.trim();
    if (!trimmed) {
      return undefined;
    }

    const value = Number(trimmed);
    if (!Number.isInteger(value) || value <= 0) {
      return 'invalid';
    }

    return value;
  }

  private pretty(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
}
