import { mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  asFailure,
  asSuccess,
  type DesktopResult,
  type StorageClassification,
  type StorageClearDomainRequest,
  type StorageDeleteRequest,
  type StorageGetRequest,
  type StorageSetRequest,
} from '@electron-foundation/contracts';

type SqliteRunResult = { changes: number };
type SqliteStatement = {
  run: (...params: unknown[]) => SqliteRunResult;
  get: (...params: unknown[]) => unknown;
};
type SqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
};
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

const STORAGE_SCHEMA_VERSION = 1;

type StorageGatewayDeps = {
  dbPath: string;
  encryptString?: (plainText: string) => Buffer;
  decryptString?: (cipherText: Buffer) => string;
};

type StoredRow = {
  value: string;
  is_encrypted: number;
  classification: StorageClassification;
};

export class StorageGateway {
  private db: SqliteDatabase | null = null;

  constructor(private readonly deps: StorageGatewayDeps) {}

  setItem(request: StorageSetRequest): DesktopResult<{ updated: boolean }> {
    const readyFailure = this.ensureReady(request.correlationId);
    if (readyFailure) {
      return readyFailure;
    }

    const serialized = this.serializeValue(
      request.payload.value,
      request.payload.classification,
      request.correlationId,
    );
    if (!serialized.ok) {
      return serialized as DesktopResult<never>;
    }

    this.db!.prepare(
      `
      INSERT INTO kv_store (domain, key, value, is_encrypted, classification, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(domain, key) DO UPDATE SET
        value = excluded.value,
        is_encrypted = excluded.is_encrypted,
        classification = excluded.classification,
        updated_at = excluded.updated_at
      `,
    ).run(
      request.payload.domain,
      request.payload.key,
      serialized.data.value,
      serialized.data.isEncrypted,
      request.payload.classification,
      Date.now(),
    );

    return asSuccess({ updated: true });
  }

  getItem(request: StorageGetRequest): DesktopResult<{
    found: boolean;
    value?: unknown;
    classification?: StorageClassification;
  }> {
    const readyFailure = this.ensureReady(request.correlationId);
    if (readyFailure) {
      return readyFailure;
    }

    const row = this.db!.prepare(
      'SELECT value, is_encrypted, classification FROM kv_store WHERE domain = ? AND key = ?',
    ).get(request.payload.domain, request.payload.key) as StoredRow | undefined;

    if (!row) {
      return asSuccess({ found: false });
    }

    const deserialized = this.deserializeValue(row, request.correlationId);
    if (!deserialized.ok) {
      return deserialized as DesktopResult<never>;
    }

    return asSuccess({
      found: true,
      value: deserialized.data,
      classification: row.classification,
    });
  }

  deleteItem(
    request: StorageDeleteRequest,
  ): DesktopResult<{ deleted: boolean }> {
    const readyFailure = this.ensureReady(request.correlationId);
    if (readyFailure) {
      return readyFailure;
    }

    const result = this.db!.prepare(
      'DELETE FROM kv_store WHERE domain = ? AND key = ?',
    ).run(request.payload.domain, request.payload.key);

    return asSuccess({ deleted: result.changes > 0 });
  }

  clearDomain(
    request: StorageClearDomainRequest,
  ): DesktopResult<{ cleared: number }> {
    const readyFailure = this.ensureReady(request.correlationId);
    if (readyFailure) {
      return readyFailure;
    }

    const result = this.db!.prepare(
      'DELETE FROM kv_store WHERE domain = ?',
    ).run(request.payload.domain);

    return asSuccess({ cleared: result.changes });
  }

  close() {
    this.db?.close();
    this.db = null;
  }

  private ensureReady(correlationId?: string): DesktopResult<never> | null {
    if (!this.db) {
      const dbDir = path.dirname(this.deps.dbPath);
      mkdirSync(dbDir, { recursive: true });
      this.db = new DatabaseSync(this.deps.dbPath);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS kv_store (
          domain TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          is_encrypted INTEGER NOT NULL DEFAULT 0,
          classification TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (domain, key)
        );
      `);

      const versionRow = this.db
        .prepare("SELECT value FROM metadata WHERE key = 'schema_version'")
        .get() as { value: string } | undefined;

      if (!versionRow) {
        this.db
          .prepare(
            "INSERT INTO metadata (key, value) VALUES ('schema_version', ?)",
          )
          .run(String(STORAGE_SCHEMA_VERSION));
      } else if (Number(versionRow.value) > STORAGE_SCHEMA_VERSION) {
        return asFailure(
          'STORAGE/INCOMPATIBLE_SCHEMA',
          'Storage schema version is newer than this app supports.',
          { schemaVersion: versionRow.value },
          false,
          correlationId,
        );
      }
    }

    return null;
  }

  private serializeValue(
    value: unknown,
    classification: StorageClassification,
    correlationId: string,
  ): DesktopResult<{ value: string; isEncrypted: number }> {
    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch (error) {
      return asFailure(
        'STORAGE/SERIALIZE_FAILED',
        'Storage value could not be serialized.',
        error,
        false,
        correlationId,
      );
    }

    if (classification === 'sensitive') {
      if (!this.deps.encryptString) {
        return asFailure(
          'STORAGE/ENCRYPTION_UNAVAILABLE',
          'Sensitive storage encryption is unavailable.',
          undefined,
          false,
          correlationId,
        );
      }

      const encrypted = this.deps.encryptString(serialized);
      return asSuccess({ value: encrypted.toString('base64'), isEncrypted: 1 });
    }

    return asSuccess({ value: serialized, isEncrypted: 0 });
  }

  private deserializeValue(
    row: StoredRow,
    correlationId: string,
  ): DesktopResult<unknown> {
    let raw = row.value;
    if (row.is_encrypted === 1) {
      if (!this.deps.decryptString) {
        return asFailure(
          'STORAGE/DECRYPTION_UNAVAILABLE',
          'Sensitive storage decryption is unavailable.',
          undefined,
          false,
          correlationId,
        );
      }

      try {
        raw = this.deps.decryptString(Buffer.from(row.value, 'base64'));
      } catch (error) {
        return asFailure(
          'STORAGE/DECRYPT_FAILED',
          'Unable to decrypt stored value.',
          error,
          false,
          correlationId,
        );
      }
    }

    try {
      return asSuccess(JSON.parse(raw));
    } catch (error) {
      return asFailure(
        'STORAGE/CORRUPTED_DATA',
        'Stored value is not valid JSON.',
        error,
        false,
        correlationId,
      );
    }
  }
}
