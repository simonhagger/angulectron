import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import type { ApiFeatureConfig } from '@electron-foundation/contracts';
import { RuntimeSettingsService } from '../runtime-settings.service';

type MappingRow = {
  placeholder: string;
  claimPath: string;
};

const placeholderPattern = /\{\{([a-zA-Z0-9_.-]+)\}\}/g;

const extractPlaceholders = (urlTemplate: string): string[] => {
  const unique = new Set<string>();
  for (const match of urlTemplate.matchAll(placeholderPattern)) {
    const value = match[1]?.trim();
    if (value) {
      unique.add(value);
    }
  }

  return Array.from(unique);
};

const toMappingRows = (
  placeholders: string[],
  existingMap: Record<string, string>,
): MappingRow[] =>
  placeholders.map((placeholder) => ({
    placeholder,
    claimPath: existingMap[placeholder] ?? '',
  }));

@Component({
  selector: 'app-settings-api-page',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './settings-api-page.html',
  styleUrl: './settings-api-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsApiPage {
  protected readonly settings = inject(RuntimeSettingsService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly localStatus = signal('');
  protected readonly mappingRows = signal<MappingRow[]>([]);

  protected readonly form = this.formBuilder.nonNullable.group({
    secureEndpointUrlTemplate: [''],
  });

  protected readonly resolvedPreview = signal('N/A');

  constructor() {
    effect(() => {
      const config = this.settings.apiConfig();
      const urlTemplate = config.secureEndpointUrlTemplate ?? '';
      const claimMap = config.secureEndpointClaimMap ?? {};
      const placeholders = extractPlaceholders(urlTemplate);

      this.form.patchValue(
        {
          secureEndpointUrlTemplate: urlTemplate,
        },
        { emitEvent: false },
      );
      this.mappingRows.set(toMappingRows(placeholders, claimMap));
      this.updateResolvedPreview();
    });
  }

  protected onUrlTemplateChanged(value: string) {
    const placeholders = extractPlaceholders(value);
    const currentRows = this.mappingRows();
    const currentMap: Record<string, string> = {};
    for (const row of currentRows) {
      currentMap[row.placeholder] = row.claimPath;
    }

    this.mappingRows.set(toMappingRows(placeholders, currentMap));
    this.updateResolvedPreview(value);
  }

  protected async save() {
    const secureEndpointUrlTemplate =
      this.form.controls.secureEndpointUrlTemplate.value.trim();
    const claimMap: Record<string, string> = {};

    for (const row of this.mappingRows()) {
      const claimPath = row.claimPath.trim();
      if (!claimPath) {
        continue;
      }
      claimMap[row.placeholder] = claimPath;
    }

    const config: ApiFeatureConfig = {
      secureEndpointUrlTemplate: secureEndpointUrlTemplate || undefined,
      secureEndpointClaimMap:
        Object.keys(claimMap).length > 0 ? claimMap : undefined,
    };

    await this.settings.saveApiConfig(config);
    this.localStatus.set('API settings saved.');
  }

  protected updateResolvedPreview(urlTemplateOverride?: string) {
    const template =
      (
        urlTemplateOverride ??
        this.form.controls.secureEndpointUrlTemplate.value
      )?.trim() ?? '';
    if (!template) {
      this.resolvedPreview.set('N/A');
      return;
    }

    let resolved = template;
    for (const row of this.mappingRows()) {
      const replacement = row.claimPath.trim() || `claim:${row.placeholder}`;
      resolved = resolved.replaceAll(`{{${row.placeholder}}}`, replacement);
    }
    this.resolvedPreview.set(resolved);
  }
}
