import { createShellBadge } from './shell';

describe('createShellBadge', () => {
  it('returns success badge when connected', () => {
    expect(createShellBadge(true).tone).toBe('success');
  });
});
