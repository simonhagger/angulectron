import { isNonEmptyString } from './common';

describe('isNonEmptyString', () => {
  it('validates non-empty strings', () => {
    expect(isNonEmptyString('ok')).toBe(true);
    expect(isNonEmptyString('')).toBe(false);
  });
});
