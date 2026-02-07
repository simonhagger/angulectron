import { getDesktopApi } from './desktop-api';

describe('getDesktopApi', () => {
  it('returns null when no desktop API is available', () => {
    expect(getDesktopApi()).toBeNull();
  });
});
