import { createDocumentIdentity } from './core';

describe('createDocumentIdentity', () => {
  it('creates a stable domain identity object', () => {
    expect(createDocumentIdentity('/tmp/test.pdf', 10, 20)).toEqual({
      path: '/tmp/test.pdf',
      size: 10,
      modifiedAt: 20,
    });
  });
});
