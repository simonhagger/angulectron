import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { TranslocoLoader, type Translation } from '@jsverse/transloco';
import { catchError, forkJoin, map, of } from 'rxjs';

const featureTranslationPaths = ['home/i18n'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mergeTranslations = (
  base: Translation,
  incoming: Translation,
): Translation => {
  const result: Translation = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    const baseValue = result[key];
    if (isRecord(baseValue) && isRecord(value)) {
      result[key] = mergeTranslations(baseValue, value);
      continue;
    }

    result[key] = value;
  }

  return result;
};

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  private buildAssetUrl(path: string): string {
    return new URL(path, this.document.baseURI).toString();
  }

  getTranslation(lang: string) {
    const baseTranslation$ = this.http
      .get<Translation>(this.buildAssetUrl(`i18n/${lang}.json`))
      .pipe(catchError(() => of({} as Translation)));

    const featureTranslations$ = featureTranslationPaths.map((featurePath) =>
      this.http
        .get<Translation>(
          this.buildAssetUrl(`i18n/features/${featurePath}/${lang}.json`),
        )
        .pipe(catchError(() => of({} as Translation))),
    );

    return forkJoin([baseTranslation$, ...featureTranslations$]).pipe(
      map((translations) =>
        translations.reduce<Translation>(
          (merged, current) => mergeTranslations(merged, current),
          {} as Translation,
        ),
      ),
    );
  }
}
