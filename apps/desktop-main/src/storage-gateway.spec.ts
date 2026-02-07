import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { StorageSetRequest } from '@electron-foundation/contracts';
import { StorageGateway } from './storage-gateway';

const req = (payload: StorageSetRequest['payload']): StorageSetRequest => ({
  contractVersion: '1.0.0',
  correlationId: 'corr-storage',
  payload,
});

describe('StorageGateway', () => {
  it('stores and retrieves internal values', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'storage-gateway-'));
    const dbPath = path.join(dir, 'app-storage.sqlite');
    const gateway = new StorageGateway({ dbPath });

    const set = gateway.setItem(
      req({
        domain: 'settings',
        key: 'theme',
        value: { mode: 'light' },
        classification: 'internal',
      }),
    );
    expect(set.ok).toBe(true);

    const get = gateway.getItem({
      contractVersion: '1.0.0',
      correlationId: 'corr-storage',
      payload: { domain: 'settings', key: 'theme' },
    });
    expect(get.ok).toBe(true);
    if (get.ok) {
      expect(get.data.found).toBe(true);
      expect(get.data.value).toEqual({ mode: 'light' });
      expect(get.data.classification).toBe('internal');
    }

    gateway.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('encrypts sensitive values via provided encrypt/decrypt functions', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'storage-gateway-'));
    const dbPath = path.join(dir, 'app-storage.sqlite');
    const gateway = new StorageGateway({
      dbPath,
      encryptString: (plainText) => Buffer.from(`enc:${plainText}`, 'utf8'),
      decryptString: (cipherText) =>
        cipherText.toString('utf8').replace(/^enc:/, ''),
    });

    const set = gateway.setItem(
      req({
        domain: 'settings',
        key: 'token',
        value: 'secret-value',
        classification: 'sensitive',
      }),
    );
    expect(set.ok).toBe(true);

    const db = new DatabaseSync(dbPath);
    const rawRow = db
      .prepare(
        'SELECT value, is_encrypted FROM kv_store WHERE domain = ? AND key = ?',
      )
      .get('settings', 'token') as { value: string; is_encrypted: number };
    expect(rawRow.is_encrypted).toBe(1);
    expect(rawRow.value).not.toContain('secret-value');
    db.close();

    const get = gateway.getItem({
      contractVersion: '1.0.0',
      correlationId: 'corr-storage',
      payload: { domain: 'settings', key: 'token' },
    });
    expect(get.ok).toBe(true);
    if (get.ok) {
      expect(get.data.value).toBe('secret-value');
      expect(get.data.classification).toBe('sensitive');
    }

    gateway.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects newer unsupported schema versions', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'storage-gateway-'));
    const dbPath = path.join(dir, 'app-storage.sqlite');
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO metadata(key, value) VALUES ('schema_version', '999');
      CREATE TABLE kv_store (
        domain TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        is_encrypted INTEGER NOT NULL DEFAULT 0,
        classification TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (domain, key)
      );
    `);
    db.close();

    const gateway = new StorageGateway({ dbPath });
    const result = gateway.getItem({
      contractVersion: '1.0.0',
      correlationId: 'corr-storage',
      payload: { domain: 'settings', key: 'theme' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('STORAGE/INCOMPATIBLE_SCHEMA');
    }

    gateway.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
