import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface RefreshTokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
  kind: 'keytar' | 'file-encrypted' | 'file-plain';
}

type FileStoreOptions = {
  userDataPath: string;
  encryptString?: (plainText: string) => Buffer;
  decryptString?: (cipherText: Buffer) => string;
  allowInsecurePlaintext?: boolean;
  logger?: (level: 'warn' | 'info', message: string) => void;
};

const REFRESH_TOKEN_FILE_NAME = 'oidc-refresh-token.bin';
const KEYTAR_SERVICE = 'Angulectron Desktop';
const KEYTAR_ACCOUNT = 'oidc-refresh-token';

const createFileStore = async (
  options: FileStoreOptions,
): Promise<RefreshTokenStore> => {
  const directory = path.join(options.userDataPath, 'auth');
  const filePath = path.join(directory, REFRESH_TOKEN_FILE_NAME);
  await fs.mkdir(directory, { recursive: true });

  const encrypted =
    typeof options.encryptString === 'function' &&
    typeof options.decryptString === 'function';
  const allowPlain = options.allowInsecurePlaintext === true;

  if (!encrypted && !allowPlain) {
    throw new Error(
      'No secure token storage is available. Enable platform encryption or set OIDC_ALLOW_INSECURE_TOKEN_STORAGE=1 for local development only.',
    );
  }

  return {
    kind: encrypted ? 'file-encrypted' : 'file-plain',
    async get() {
      if (!existsSync(filePath)) {
        return null;
      }

      const raw = await fs.readFile(filePath);
      if (raw.byteLength === 0) {
        return null;
      }

      if (encrypted) {
        return options.decryptString!(raw);
      }

      return raw.toString('utf8');
    },
    async set(token) {
      if (encrypted) {
        await fs.writeFile(filePath, options.encryptString!(token));
        return;
      }

      options.logger?.(
        'warn',
        'Using plaintext refresh-token storage for local development.',
      );
      await fs.writeFile(filePath, token, 'utf8');
    },
    async clear() {
      if (!existsSync(filePath)) {
        return;
      }
      await fs.unlink(filePath);
    },
  };
};

const createKeytarStore = async (): Promise<RefreshTokenStore> => {
  const keytarModule = (await import('keytar')) as {
    default?: {
      getPassword(service: string, account: string): Promise<string | null>;
      setPassword(
        service: string,
        account: string,
        password: string,
      ): Promise<void>;
      deletePassword(service: string, account: string): Promise<boolean>;
    };
    getPassword(service: string, account: string): Promise<string | null>;
    setPassword(
      service: string,
      account: string,
      password: string,
    ): Promise<void>;
    deletePassword(service: string, account: string): Promise<boolean>;
  };

  const keytar = keytarModule.default ?? keytarModule;
  return {
    kind: 'keytar',
    async get() {
      return keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    },
    async set(token) {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, token);
    },
    async clear() {
      await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    },
  };
};

export const createRefreshTokenStore = async (
  options: FileStoreOptions,
): Promise<RefreshTokenStore> => {
  if (process.platform === 'win32') {
    try {
      return await createKeytarStore();
    } catch (error) {
      const fallbackStore = await createFileStore(options);
      const fallbackLevel =
        fallbackStore.kind === 'file-encrypted' ? 'info' : 'warn';
      options.logger?.(
        fallbackLevel,
        `Keytar unavailable; using ${fallbackStore.kind} token store instead: ${
          error instanceof Error ? error.message : String(error)
        }. Run "pnpm native:rebuild:keytar" to restore keytar in local development.`,
      );
      return fallbackStore;
    }
  }

  return createFileStore(options);
};
