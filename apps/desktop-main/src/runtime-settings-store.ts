import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import {
  appFeatureConfigSchema,
  apiFeatureConfigSchema,
  authFeatureConfigSchema,
  runtimeConfigDocumentSchema,
  type AppFeatureConfig,
  type ApiFeatureConfig,
  type AuthFeatureConfig,
  type RuntimeConfigDocument,
  type RuntimeConfigFeatureKey,
} from '@electron-foundation/contracts';

const defaultRuntimeConfigDocument: RuntimeConfigDocument = {
  version: 1,
};

const runtimeConfigFileName = 'runtime-config.json';

type RuntimeConfigFeatureConfigByKey = {
  app: AppFeatureConfig;
  auth: AuthFeatureConfig;
  api: ApiFeatureConfig;
};

const featureParsers = {
  app: appFeatureConfigSchema,
  auth: authFeatureConfigSchema,
  api: apiFeatureConfigSchema,
} as const;

const decodeUrlTemplateBraces = (value: string): string =>
  value.replace(/%7B/gi, '{').replace(/%7D/gi, '}');

const normalizeApiConfig = (
  config: ApiFeatureConfig | undefined,
): { config: ApiFeatureConfig | undefined; migrated: boolean } => {
  if (!config?.secureEndpointUrlTemplate) {
    return { config, migrated: false };
  }

  const decoded = decodeUrlTemplateBraces(config.secureEndpointUrlTemplate);
  if (decoded === config.secureEndpointUrlTemplate) {
    return { config, migrated: false };
  }

  return {
    config: {
      ...config,
      secureEndpointUrlTemplate: decoded,
    },
    migrated: true,
  };
};

const normalizeRuntimeConfigDocument = (
  document: RuntimeConfigDocument,
): { document: RuntimeConfigDocument; migrated: boolean } => {
  const next = { ...document };
  const legacyApp = next.app;
  let migrated = false;

  if (next.api) {
    const normalizedApi = normalizeApiConfig(next.api);
    if (normalizedApi.migrated) {
      next.api = normalizedApi.config;
      migrated = true;
    }
  }

  if (legacyApp?.secureEndpointUrlTemplate) {
    const decodedLegacyTemplate = decodeUrlTemplateBraces(
      legacyApp.secureEndpointUrlTemplate,
    );
    if (decodedLegacyTemplate !== legacyApp.secureEndpointUrlTemplate) {
      next.app = {
        ...legacyApp,
        secureEndpointUrlTemplate: decodedLegacyTemplate,
      };
      migrated = true;
    }
  }

  if (
    !next.api &&
    next.app &&
    (legacyApp.secureEndpointUrlTemplate || legacyApp.secureEndpointClaimMap)
  ) {
    next.api = {
      secureEndpointUrlTemplate: next.app.secureEndpointUrlTemplate,
      secureEndpointClaimMap: legacyApp.secureEndpointClaimMap,
    };
    next.app = {};
    migrated = true;
  }

  if (next.api) {
    const normalizedApi = normalizeApiConfig(next.api);
    if (normalizedApi.migrated) {
      next.api = normalizedApi.config;
      migrated = true;
    }
  }

  return migrated ? { document: next, migrated: true } : { document, migrated };
};

const cloneDefaultDocument = (): RuntimeConfigDocument => ({
  ...defaultRuntimeConfigDocument,
});

const parseRuntimeConfigDocument = (raw: string): RuntimeConfigDocument => {
  const parsedJson = JSON.parse(raw) as unknown;
  return runtimeConfigDocumentSchema.parse(parsedJson);
};

const parseFeatureConfig = <TFeature extends RuntimeConfigFeatureKey>(
  feature: TFeature,
  data: unknown,
): RuntimeConfigFeatureConfigByKey[TFeature] => {
  const parser = featureParsers[feature];
  return parser.parse(data) as RuntimeConfigFeatureConfigByKey[TFeature];
};

export class RuntimeSettingsStore {
  private readonly configDirPath: string;
  private readonly configFilePath: string;

  constructor(userDataPath: string) {
    this.configDirPath = path.join(userDataPath, 'config');
    this.configFilePath = path.join(this.configDirPath, runtimeConfigFileName);
  }

  getConfigFilePath(): string {
    return this.configFilePath;
  }

  async getState(): Promise<{
    sourcePath: string;
    exists: boolean;
    config: RuntimeConfigDocument;
  }> {
    const exists = await this.exists();
    if (!exists) {
      return {
        sourcePath: this.configFilePath,
        exists: false,
        config: cloneDefaultDocument(),
      };
    }

    return {
      sourcePath: this.configFilePath,
      exists: true,
      config: await this.loadNormalized(),
    };
  }

  async saveFeature<TFeature extends RuntimeConfigFeatureKey>(
    feature: TFeature,
    config: RuntimeConfigFeatureConfigByKey[TFeature],
  ): Promise<RuntimeConfigDocument> {
    const validated = parseFeatureConfig(feature, config);
    const document = await this.loadOrDefault();

    if (Object.keys(validated).length === 0) {
      delete document[feature];
    } else {
      document[feature] = validated;
    }

    await this.save(document);
    return document;
  }

  async resetFeature(
    feature: RuntimeConfigFeatureKey,
  ): Promise<RuntimeConfigDocument> {
    const document = await this.loadOrDefault();
    delete document[feature];
    await this.save(document);
    return document;
  }

  async importRuntimeConfigFromFile(
    filePath: string,
  ): Promise<RuntimeConfigDocument> {
    const imported = parseRuntimeConfigDocument(
      await readFile(filePath, 'utf8'),
    );
    await this.save(imported);
    return imported;
  }

  async importFeatureConfigFromFile<TFeature extends RuntimeConfigFeatureKey>(
    feature: TFeature,
    filePath: string,
  ): Promise<RuntimeConfigDocument> {
    const raw = await readFile(filePath, 'utf8');
    const parsedJson = JSON.parse(raw) as unknown;

    const documentPayload = runtimeConfigDocumentSchema.safeParse(parsedJson);
    const featurePayload = documentPayload.success
      ? documentPayload.data[feature]
      : parsedJson;

    if (!featurePayload || typeof featurePayload !== 'object') {
      throw new Error(
        `Imported file does not contain a valid "${feature}" feature payload.`,
      );
    }

    const validatedFeature = parseFeatureConfig(feature, featurePayload);
    return this.saveFeature(feature, validatedFeature);
  }

  async exportRuntimeConfigToFile(filePath: string): Promise<void> {
    const document = await this.loadOrDefault();
    await this.writeFile(filePath, JSON.stringify(document, null, 2));
  }

  async exportFeatureConfigToFile(
    feature: RuntimeConfigFeatureKey,
    filePath: string,
  ): Promise<void> {
    const document = await this.loadOrDefault();
    const featureConfig = document[feature] ?? {};
    await this.writeFile(filePath, JSON.stringify(featureConfig, null, 2));
  }

  private async loadOrDefault(): Promise<RuntimeConfigDocument> {
    if (!(await this.exists())) {
      return cloneDefaultDocument();
    }

    return this.loadNormalized();
  }

  private async load(): Promise<RuntimeConfigDocument> {
    const raw = await readFile(this.configFilePath, 'utf8');
    return parseRuntimeConfigDocument(raw);
  }

  private async loadNormalized(): Promise<RuntimeConfigDocument> {
    const loaded = await this.load();
    const normalized = normalizeRuntimeConfigDocument(loaded);
    if (normalized.migrated) {
      await this.save(normalized.document);
    }

    return normalized.document;
  }

  private async save(document: RuntimeConfigDocument): Promise<void> {
    const validated = runtimeConfigDocumentSchema.parse(document);
    await this.writeFile(
      this.configFilePath,
      JSON.stringify(validated, null, 2),
    );
  }

  private async exists(): Promise<boolean> {
    try {
      await access(this.configFilePath, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  private async writeFile(filePath: string, content: string): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${content}\n`, 'utf8');
  }
}
