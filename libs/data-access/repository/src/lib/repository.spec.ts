import { createSidecarSnapshot } from './repository';

describe('createSidecarSnapshot', () => {
  it('creates sidecar state payloads', () => {
    const snapshot = createSidecarSnapshot('/tmp/test.pdf', 1, 2, { page: 5 });
    expect(snapshot.identity.path).toBe('/tmp/test.pdf');
    expect(snapshot.state.page).toBe(5);
  });
});
