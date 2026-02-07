import {
  createDocumentIdentity,
  type DocumentIdentity,
} from '@electron-foundation/core';

export interface SidecarSnapshot {
  identity: DocumentIdentity;
  state: Record<string, unknown>;
}

export const createSidecarSnapshot = (
  path: string,
  size: number,
  modifiedAt: number,
  state: Record<string, unknown>,
): SidecarSnapshot => ({
  identity: createDocumentIdentity(path, size, modifiedAt),
  state,
});
