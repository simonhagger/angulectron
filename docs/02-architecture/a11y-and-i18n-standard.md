# A11y And I18n Standard

## Accessibility

- Target: WCAG 2.2 AA minimum.
- Keyboard-only operation required.
- Focus states visible and logical.
- Dialogs/drawers support Escape and focus containment.

## Automated Checks

- Playwright + axe gate for serious/critical violations.
- No merge if a11y gate fails.

## Internationalization

- Transloco runtime strategy.
- Baseline locale: `en-US`.
- All UI strings from translation keys.
- Locale files validated in CI with schema checks.

## Localization Readiness

- No string concatenation for translatable content.
- Message formats should support pluralization and interpolation.
