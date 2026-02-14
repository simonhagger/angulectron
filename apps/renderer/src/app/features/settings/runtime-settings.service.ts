import { Injectable, computed, signal } from '@angular/core';
import {
  getDesktopApi,
  type DesktopSettingsApi,
} from '@electron-foundation/desktop-api';
import type {
  AppFeatureConfig,
  ApiFeatureConfig,
  AuthFeatureConfig,
  RuntimeConfigDocument,
  RuntimeConfigFeatureKey,
} from '@electron-foundation/contracts';

const defaultRuntimeConfig: RuntimeConfigDocument = {
  version: 1,
};

@Injectable({ providedIn: 'root' })
export class RuntimeSettingsService {
  private readonly desktopSettingsApi: DesktopSettingsApi | null =
    getDesktopApi()?.settings ?? null;

  readonly desktopAvailable = signal(this.desktopSettingsApi !== null);
  readonly busy = signal(false);
  readonly status = signal('Idle.');
  readonly sourcePath = signal('N/A');
  readonly exists = signal(false);
  readonly runtimeConfig = signal<RuntimeConfigDocument>(defaultRuntimeConfig);

  readonly appConfig = computed(() => this.runtimeConfig().app ?? {});
  readonly apiConfig = computed(
    () => this.runtimeConfig().api ?? this.runtimeConfig().app ?? {},
  );
  readonly authConfig = computed(() => this.runtimeConfig().auth ?? {});

  async refresh() {
    if (!this.desktopSettingsApi) {
      this.status.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    this.busy.set(true);
    this.status.set('Loading runtime config...');
    try {
      const result = await this.desktopSettingsApi.getRuntimeConfig();
      if (!result.ok) {
        this.status.set(result.error.message);
        return;
      }

      this.applyConfigState(result.data);
      this.status.set(
        result.data.exists
          ? 'Runtime config loaded.'
          : 'Runtime config not found yet.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  async saveAppConfig(config: AppFeatureConfig) {
    await this.saveFeatureConfig('app', config);
  }

  async saveAuthConfig(config: AuthFeatureConfig) {
    await this.saveFeatureConfig('auth', config);
  }

  async saveApiConfig(config: ApiFeatureConfig) {
    await this.saveFeatureConfig('api', config);
  }

  async resetFeatureConfig(feature: RuntimeConfigFeatureKey) {
    if (!this.desktopSettingsApi) {
      this.status.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    this.busy.set(true);
    this.status.set(`Resetting ${feature} settings...`);
    try {
      const result = await this.desktopSettingsApi.resetFeatureConfig(feature);
      if (!result.ok) {
        this.status.set(result.error.message);
        return;
      }

      this.applyConfigState(result.data);
      this.status.set(`${feature} settings reset.`);
    } finally {
      this.busy.set(false);
    }
  }

  async importFeatureConfig(feature: RuntimeConfigFeatureKey) {
    if (!this.desktopSettingsApi) {
      this.status.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    this.busy.set(true);
    this.status.set(`Importing ${feature} settings...`);
    try {
      const result = await this.desktopSettingsApi.importFeatureConfig(feature);
      if (!result.ok) {
        this.status.set(result.error.message);
        return;
      }

      if (result.data.canceled) {
        this.status.set('Import canceled.');
        return;
      }

      if (result.data.config) {
        this.runtimeConfig.set(result.data.config);
        this.exists.set(true);
      }
      if (result.data.sourcePath) {
        this.sourcePath.set(result.data.sourcePath);
      }

      this.status.set(`${feature} settings imported.`);
    } finally {
      this.busy.set(false);
    }
  }

  async exportFeatureConfig(feature: RuntimeConfigFeatureKey) {
    if (!this.desktopSettingsApi) {
      this.status.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    this.busy.set(true);
    this.status.set(`Exporting ${feature} settings...`);
    try {
      const result = await this.desktopSettingsApi.exportFeatureConfig(feature);
      if (!result.ok) {
        this.status.set(result.error.message);
        return;
      }

      if (result.data.canceled) {
        this.status.set('Export canceled.');
        return;
      }

      this.status.set(
        result.data.targetPath
          ? `${feature} settings exported to ${result.data.targetPath}`
          : `${feature} settings exported.`,
      );
    } finally {
      this.busy.set(false);
    }
  }

  async importRuntimeConfig() {
    if (!this.desktopSettingsApi) {
      this.status.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    this.busy.set(true);
    this.status.set('Importing full runtime config...');
    try {
      const result = await this.desktopSettingsApi.importRuntimeConfig();
      if (!result.ok) {
        this.status.set(result.error.message);
        return;
      }

      if (result.data.canceled) {
        this.status.set('Import canceled.');
        return;
      }

      if (result.data.config) {
        this.runtimeConfig.set(result.data.config);
        this.exists.set(true);
      }

      if (result.data.sourcePath) {
        this.sourcePath.set(result.data.sourcePath);
      }

      this.status.set('Full runtime config imported.');
    } finally {
      this.busy.set(false);
    }
  }

  async exportRuntimeConfig() {
    if (!this.desktopSettingsApi) {
      this.status.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    this.busy.set(true);
    this.status.set('Exporting full runtime config...');
    try {
      const result = await this.desktopSettingsApi.exportRuntimeConfig();
      if (!result.ok) {
        this.status.set(result.error.message);
        return;
      }

      if (result.data.canceled) {
        this.status.set('Export canceled.');
        return;
      }

      this.status.set(
        result.data.targetPath
          ? `Full runtime config exported to ${result.data.targetPath}`
          : 'Full runtime config exported.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  private async saveFeatureConfig(
    feature: RuntimeConfigFeatureKey,
    config: AppFeatureConfig | AuthFeatureConfig | ApiFeatureConfig,
  ) {
    if (!this.desktopSettingsApi) {
      this.status.set('Desktop bridge unavailable in browser mode.');
      return;
    }

    this.busy.set(true);
    this.status.set(`Saving ${feature} settings...`);
    try {
      const result = await this.desktopSettingsApi.saveFeatureConfig(
        feature,
        config,
      );
      if (!result.ok) {
        this.status.set(result.error.message);
        return;
      }

      this.applyConfigState(result.data);
      this.status.set(`${feature} settings saved.`);
    } finally {
      this.busy.set(false);
    }
  }

  private applyConfigState(state: {
    sourcePath: string;
    exists: boolean;
    config: RuntimeConfigDocument;
  }) {
    this.sourcePath.set(state.sourcePath);
    this.exists.set(state.exists);
    this.runtimeConfig.set(state.config);
  }
}
