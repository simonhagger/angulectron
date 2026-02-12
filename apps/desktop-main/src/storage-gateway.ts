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

const STORAGE_SCHEMA_VERSION = 2;
const DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

type StorageGatewayDeps = {
  dbPath: string;
  encryptString?: (plainText: string) => Buffer;
  decryptString?: (cipherText: Buffer) => string;
};

type StoredRow = {
  value: string;
  is_encrypted: number;
  classification: StorageClassification;
  expires_at: number | null;
};

export class StorageGateway {
  private db: SqliteDatabase | null = null;
  private readonly deps: StorageGatewayDeps;

  constructor(deps: StorageGatewayDeps) {
    this.deps = deps;
  }

  setItem(request: StorageSetRequest): DesktopResult<{ updated: boolean }> {
    const readyFailure = this.ensureReady(request.correlationId);
    if (readyFailure) {
      return readyFailure;
    }
    const db = this.db;
    if (!db) {
      return asFailure(
        'STORAGE/INITIALIZATION_FAILED',
        'Storage is not initialized.',
        undefined,
        false,
        request.correlationId,
      );
    }

    const serialized = this.serializeValue(
      request.payload.value,
      request.payload.classification,
      request.correlationId,
    );
    if (!serialized.ok) {
      return serialized as DesktopResult<never>;
    }

    const now = Date.now();
    let expiresAt: number | null = null;
    if (request.payload.ttlSeconds !== undefined) {
      if (request.payload.domain !== 'cache') {
        return asFailure(
          'STORAGE/INVALID_TTL_DOMAIN',
          'TTL can only be set for cache domain values.',
          { domain: request.payload.domain },
          false,
          request.correlationId,
        );
      }

      expiresAt = now + request.payload.ttlSeconds * 1000;
    } else if (request.payload.domain === 'cache') {
      expiresAt = now + DEFAULT_CACHE_TTL_SECONDS * 1000;
    }

    db.prepare(
      `
      INSERT INTO kv_store (domain, key, value, is_encrypted, classification, expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(domain, key) DO UPDATE SET
        value = excluded.value,
        is_encrypted = excluded.is_encrypted,
        classification = excluded.classification,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
      `,
    ).run(
      request.payload.domain,
      request.payload.key,
      serialized.data.value,
      serialized.data.isEncrypted,
      request.payload.classification,
      expiresAt,
      now,
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
    const db = this.db;
    if (!db) {
      return asFailure(
        'STORAGE/INITIALIZATION_FAILED',
        'Storage is not initialized.',
        undefined,
        false,
        request.correlationId,
      );
    }

    const row = db
      .prepare(
        'SELECT value, is_encrypted, classification, expires_at FROM kv_store WHERE domain = ? AND key = ?',
      )
      .get(request.payload.domain, request.payload.key) as
      | StoredRow
      | undefined;

    if (!row) {
      return asSuccess({ found: false });
    }

    if (typeof row.expires_at === 'number' && row.expires_at <= Date.now()) {
      db.prepare('DELETE FROM kv_store WHERE domain = ? AND key = ?').run(
        request.payload.domain,
        request.payload.key,
      );
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
    const db = this.db;
    if (!db) {
      return asFailure(
        'STORAGE/INITIALIZATION_FAILED',
        'Storage is not initialized.',
        undefined,
        false,
        request.correlationId,
      );
    }

    const result = db
      .prepare('DELETE FROM kv_store WHERE domain = ? AND key = ?')
      .run(request.payload.domain, request.payload.key);

    return asSuccess({ deleted: result.changes > 0 });
  }

  clearDomain(
    request: StorageClearDomainRequest,
  ): DesktopResult<{ cleared: number }> {
    const readyFailure = this.ensureReady(request.correlationId);
    if (readyFailure) {
      return readyFailure;
    }
    const db = this.db;
    if (!db) {
      return asFailure(
        'STORAGE/INITIALIZATION_FAILED',
        'Storage is not initialized.',
        undefined,
        false,
        request.correlationId,
      );
    }

    const result = db
      .prepare('DELETE FROM kv_store WHERE domain = ?')
      .run(request.payload.domain);

    return asSuccess({ cleared: result.changes });
  }

  close() {
    this.db?.close();
    this.db = null;
  }

  private ensureReady(correlationId?: string): DesktopResult<never> | null {
    if (!this.db) {
      try {
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
          expires_at INTEGER,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (domain, key)
        );

      `);

        const versionRow = this.db
          .prepare("SELECT value FROM metadata WHERE key = 'schema_version'")
          .get() as { value: string } | undefined;

        const currentVersion = versionRow ? Number(versionRow.value) : 1;
        if (!versionRow) {
          this.db
            .prepare(
              "INSERT INTO metadata (key, value) VALUES ('schema_version', ?)",
            )
            .run(String(STORAGE_SCHEMA_VERSION));
        } else if (currentVersion > STORAGE_SCHEMA_VERSION) {
          return asFailure(
            'STORAGE/INCOMPATIBLE_SCHEMA',
            'Storage schema version is newer than this app supports.',
            { schemaVersion: versionRow.value },
            false,
            correlationId,
          );
        } else if (currentVersion < STORAGE_SCHEMA_VERSION) {
          const migrationFailure = this.applyMigrations(
            currentVersion,
            correlationId,
          );
          if (migrationFailure) {
            return migrationFailure;
          }
        }

        this.ensureExpiryIndex();

        const integrityFailure = this.verifyIntegrity(correlationId);
        if (integrityFailure) {
          return integrityFailure;
        }

        this.pruneExpiredCacheEntries();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const code =
          message.includes('file is not a database') ||
          message.includes('database disk image is malformed')
            ? 'STORAGE/CORRUPTED_DB'
            : 'STORAGE/INITIALIZATION_FAILED';

        return asFailure(
          code,
          'Storage could not be initialized safely.',
          { message },
          false,
          correlationId,
        );
      }
    }

    return null;
  }

  private applyMigrations(
    currentVersion: number,
    correlationId?: string,
  ): DesktopResult<never> | null {
    if (!this.db) {
      return asFailure(
        'STORAGE/INITIALIZATION_FAILED',
        'Storage is not initialized.',
        undefined,
        false,
        correlationId,
      );
    }

    try {
      this.db.exec('BEGIN IMMEDIATE;');

      if (currentVersion < 2) {
        const tableDefinition = this.db
          .prepare(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'kv_store'",
          )
          .get() as { sql?: string } | undefined;

        const hasExpiresAtColumn = tableDefinition?.sql?.includes('expires_at');

        if (!hasExpiresAtColumn) {
          this.db.exec('ALTER TABLE kv_store ADD COLUMN expires_at INTEGER;');
        }

        this.db.exec(
          'CREATE INDEX IF NOT EXISTS idx_kv_store_domain_expires ON kv_store(domain, expires_at);',
        );
      }

      this.db
        .prepare("UPDATE metadata SET value = ? WHERE key = 'schema_version'")
        .run(String(STORAGE_SCHEMA_VERSION));
      this.db.exec('COMMIT;');
      return null;
    } catch (error) {
      this.db.exec('ROLLBACK;');
      return asFailure(
        'STORAGE/MIGRATION_FAILED',
        'Storage schema migration failed.',
        error,
        false,
        correlationId,
      );
    }
  }

  private ensureExpiryIndex() {
    if (!this.db) {
      return;
    }

    const tableDefinition = this.db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'kv_store'",
      )
      .get() as { sql?: string } | undefined;

    if (tableDefinition?.sql?.includes('expires_at')) {
      this.db.exec(
        'CREATE INDEX IF NOT EXISTS idx_kv_store_domain_expires ON kv_store(domain, expires_at);',
      );
    }
  }

  private verifyIntegrity(correlationId?: string): DesktopResult<never> | null {
    if (!this.db) {
      return asFailure(
        'STORAGE/INITIALIZATION_FAILED',
        'Storage is not initialized.',
        undefined,
        false,
        correlationId,
      );
    }

    const row = this.db.prepare('PRAGMA quick_check(1);').get() as
      | Record<string, string>
      | undefined;
    const value = row ? String(Object.values(row)[0]) : 'unknown';

    if (value !== 'ok') {
      return asFailure(
        'STORAGE/CORRUPTED_DB',
        'Storage integrity check failed.',
        { quickCheck: value },
        false,
        correlationId,
      );
    }

    return null;
  }

  private pruneExpiredCacheEntries() {
    if (!this.db) {
      return;
    }

    this.db
      .prepare(
        'DELETE FROM kv_store WHERE domain = ? AND expires_at IS NOT NULL AND expires_at <= ?',
      )
      .run('cache', Date.now());
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
